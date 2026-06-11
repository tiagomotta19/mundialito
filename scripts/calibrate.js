// Ferramenta de desenvolvimento — NÃO faz parte do app.
// Simula copas em massa para calibrar o motor contra as metas da spec (9.9).
//
// Uso: node scripts/calibrate.js [n]   (n = copas por perfil, padrão 1000)
//
// O motor usa duas convenções que o Vite aceita mas o Node puro não:
// imports de JSON sem atributo ("with { type: 'json' }") e imports relativos
// sem extensão ('./simulator'). Os hooks abaixo contornam as duas na
// resolução, sem alterar o motor.
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'

registerHooks({
  resolve(specifier, context, nextResolve) {
    let result
    try {
      result = nextResolve(specifier, context)
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
        result = nextResolve(`${specifier}.js`, context)
      } else {
        throw err
      }
    }
    if (result.url?.endsWith('.json')) {
      return { ...result, importAttributes: { type: 'json' } }
    }
    return result
  },
})

const { pickGroup } = await import('../src/engine/simulator.js')
const { runTournament } = await import('../src/engine/cup.js')

const squads = JSON.parse(
  readFileSync(new URL('../src/data/squads_final.json', import.meta.url), 'utf8')
)

// ---------------------------------------------------------------------------
// Perfis (1 GK, 4 DEF, 3 MID, 3 FWD — formação 4-3-3)
// ---------------------------------------------------------------------------

const SLOTS = { GK: 1, DEF: 4, MID: 3, FWD: 3 }
const FORMATION = '4-3-3'

const allPlayers = Object.values(squads).flat()
const byPosition = { GK: [], DEF: [], MID: [], FWD: [] }
allPlayers.forEach((p) => byPosition[p.position]?.push(p))
Object.values(byPosition).forEach((list) => list.sort((a, b) => b.ovr - a.ovr))

function rangePool(min, max) {
  const pool = {}
  Object.entries(byPosition).forEach(([pos, list]) => {
    pool[pos] = list.filter((p) => p.ovr >= min && p.ovr <= max)
  })
  return pool
}

// Elite: os melhores de cada posição (4x o necessário por setor, para variar
// o time a cada copa sem sair do topo do ranking global).
function elitePool() {
  const pool = {}
  Object.entries(SLOTS).forEach(([pos, count]) => {
    pool[pos] = byPosition[pos].slice(0, count * 4)
  })
  return pool
}

const PROFILES = [
  { id: 'ELITE', label: 'Elite', pool: elitePool(), target: [12, 15] },
  { id: 'BOM', label: 'Bom (80-85)', pool: rangePool(80, 85), target: [5, 8] },
  { id: 'MEDIO', label: 'Médio (73-79)', pool: rangePool(73, 79), target: [2, 4] },
  { id: 'FRACO', label: 'Fraco (65-72)', pool: rangePool(65, 72), target: [0.5, 1] },
]

function sample(list, count) {
  const copy = [...list]
  const picked = []
  for (let i = 0; i < count && copy.length; i++) {
    picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  }
  return picked
}

function buildProfileSquad(pool) {
  const players = []
  Object.entries(SLOTS).forEach(([pos, count]) => {
    if (pool[pos].length < count) {
      throw new Error(`Pool insuficiente para ${pos}: ${pool[pos].length} < ${count}`)
    }
    players.push(...sample(pool[pos], count))
  })
  return players
}

// ---------------------------------------------------------------------------
// Simulação em massa
// ---------------------------------------------------------------------------

const RUNS = Number(process.argv[2]) || 1000

function runProfile(profile) {
  const stats = {
    champion: 0,
    reachedFinal: 0,
    reachedSemi: 0,
    passedGroups: 0,
    outInGroups: 0,
    games: 0,
    gf: 0,
    ga: 0,
    score00: 0,
    score10: 0,
    score21: 0,
    blowouts: 0, // alguém marcou 4+
    avgOvrSum: 0,
  }

  for (let i = 0; i < RUNS; i++) {
    const players = buildProfileSquad(profile.pool)
    stats.avgOvrSum += players.reduce((s, p) => s + p.ovr, 0) / players.length

    const { campaign } = runTournament({
      players,
      formation: FORMATION,
      groupId: pickGroup(),
    })

    if (campaign.champion) stats.champion++
    if (campaign.stageReached === 'final') stats.reachedFinal++
    if (['semifinals', 'final'].includes(campaign.stageReached)) stats.reachedSemi++
    if (campaign.stageReached === 'group_stage') stats.outInGroups++
    else stats.passedGroups++

    campaign.matches.forEach((m) => {
      const userIsHome = m.homeName === '__user__'
      stats.games++
      stats.gf += userIsHome ? m.goalsA : m.goalsB
      stats.ga += userIsHome ? m.goalsB : m.goalsA

      const hi = Math.max(m.goalsA, m.goalsB)
      const lo = Math.min(m.goalsA, m.goalsB)
      if (hi === 0) stats.score00++
      else if (hi === 1 && lo === 0) stats.score10++
      else if (hi === 2 && lo === 1) stats.score21++
      if (hi >= 4) stats.blowouts++
    })
  }

  return stats
}

// "chegou à final" e "chegou à semi" são cumulativos (campeão também chegou à final).
function summarize(profile, s) {
  const pct = (n, total = RUNS) => (100 * n) / total
  return {
    label: profile.label,
    avgOvr: s.avgOvrSum / RUNS,
    champion: pct(s.champion),
    final: pct(s.reachedFinal + s.champion * 0), // stageReached 'final' já inclui campeões
    semi: pct(s.reachedSemi),
    passed: pct(s.passedGroups),
    out: pct(s.outInGroups),
    gfPerGame: s.gf / s.games,
    gaPerGame: s.ga / s.games,
    p00: pct(s.score00, s.games),
    p10: pct(s.score10, s.games),
    p21: pct(s.score21, s.games),
    pBlowout: pct(s.blowouts, s.games),
    target: profile.target,
  }
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

const f = (v, d = 1) => v.toFixed(d)
const cell = (text, width) => String(text).padStart(width)

console.log(`\nMundialito — calibração do motor (${RUNS} copas por perfil, formação ${FORMATION})\n`)

const results = []
for (const profile of PROFILES) {
  process.stdout.write(`Simulando ${profile.label}... `)
  const start = Date.now()
  const stats = runProfile(profile)
  console.log(`ok (${((Date.now() - start) / 1000).toFixed(1)}s)`)
  results.push(summarize(profile, stats))
}

console.log('\n== Campanha ==\n')
const h1 = ['Perfil', 'OVR médio', '% campeão', 'meta', '% final', '% semi', '% passou grupos', '% caiu grupos']
const w1 = [15, 10, 10, 9, 8, 8, 16, 14]
console.log(h1.map((h, i) => cell(h, w1[i])).join('  '))
results.forEach((r) => {
  const inTarget = r.champion >= r.target[0] && r.champion <= r.target[1]
  const row = [
    r.label,
    f(r.avgOvr),
    f(r.champion) + (inTarget ? ' ✓' : ' ✗'),
    `${r.target[0]}-${r.target[1]}%`,
    f(r.final),
    f(r.semi),
    f(r.passed),
    f(r.out),
  ]
  console.log(row.map((v, i) => cell(v, w1[i])).join('  '))
})

console.log('\n== Placares (jogos do usuário) ==\n')
const h2 = ['Perfil', 'GF/jogo', 'GA/jogo', '% 0x0', '% 1x0', '% 2x1', '% goleada 4+']
const w2 = [15, 8, 8, 7, 7, 7, 13]
console.log(h2.map((h, i) => cell(h, w2[i])).join('  '))
results.forEach((r) => {
  const row = [r.label, f(r.gfPerGame, 2), f(r.gaPerGame, 2), f(r.p00), f(r.p10), f(r.p21), f(r.pBlowout)]
  console.log(row.map((v, i) => cell(v, w2[i])).join('  '))
})

console.log('')
