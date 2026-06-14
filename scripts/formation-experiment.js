// Ferramenta de desenvolvimento — NÃO faz parte do app.
// Mede empiricamente se alguma FORMAÇÃO é consistentemente melhor: para cada
// formação, monta o XI com a MESMA estratégia (draft real / "completar
// automaticamente" — melhor jogador compatível por slot) e roda N copas,
// reportando % de título, OVR médio e gols. Mesma lógica de montagem em todas:
// a única variável é a formação.
//
// Uso: node scripts/formation-experiment.js [n]   (n = copas por formação, padrão 2000)

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
const { isCompatible, ROLE_TO_POSITION } = await import('../src/engine/compatibility.js')
const { FORMATION_LAYOUTS } = await import('../src/components/formationLayouts.js')

const squads = JSON.parse(
  readFileSync(new URL('../src/data/squads_final.json', import.meta.url), 'utf8')
)

// Papéis de slot de cada formação, derivados do layout real do app (sem o GK,
// que o builder coloca primeiro). Ordem com GK na frente.
const FORMATIONS = Object.fromEntries(
  Object.entries(FORMATION_LAYOUTS).map(([name, layout]) => [name, layout.map((s) => s.role)])
)

const ALL_TEAMS = Object.keys(squads)
const randomTeam = () => ALL_TEAMS[Math.floor(Math.random() * ALL_TEAMS.length)]

function bestAvailable(team, slotRole, used) {
  const candidates = squads[team].filter(
    (p) => isCompatible(p, slotRole) && !used.has(`${team}::${p.name}`)
  )
  if (!candidates.length) return null
  return candidates.reduce((best, p) => (p.ovr > best.ovr ? p : best))
}

// Draft guloso idêntico ao do app (DraftScreen "Completar automaticamente"):
// para cada slot, sorteia seleções e escala o melhor compatível disponível;
// fallback global se 15 tentativas falharem. position = setor do slot.
function buildGreedySquad(slotRoles) {
  const used = new Set()
  const players = []
  slotRoles.forEach((slotRole) => {
    let pick = null
    let pickTeam = null
    for (let attempt = 0; attempt < 15 && !pick; attempt++) {
      const team = randomTeam()
      const best = bestAvailable(team, slotRole, used)
      if (best) {
        pick = best
        pickTeam = team
      }
    }
    if (!pick) {
      ALL_TEAMS.forEach((team) => {
        const best = bestAvailable(team, slotRole, used)
        if (best && (!pick || best.ovr > pick.ovr)) {
          pick = best
          pickTeam = team
        }
      })
    }
    if (!pick) throw new Error(`Nenhum jogador compatível com ${slotRole}`)
    used.add(`${pickTeam}::${pick.name}`)
    players.push({ ...pick, slotRole, position: ROLE_TO_POSITION[slotRole] })
  })
  return players
}

const RUNS = Number(process.argv[2]) || 2000

function runFormation(name, slotRoles) {
  const s = {
    champion: 0, reachedFinal: 0, reachedSemi: 0, passedGroups: 0,
    games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, ovrSum: 0,
  }
  for (let i = 0; i < RUNS; i++) {
    const players = buildGreedySquad(slotRoles)
    s.ovrSum += players.reduce((acc, p) => acc + p.ovr, 0) / players.length

    const { campaign } = runTournament({ players, formation: name, groupId: pickGroup() })

    if (campaign.champion) s.champion++
    if (campaign.stageReached === 'final') s.reachedFinal++
    if (['semifinals', 'final'].includes(campaign.stageReached)) s.reachedSemi++
    if (campaign.stageReached !== 'group_stage') s.passedGroups++

    campaign.matches.forEach((m) => {
      const home = m.homeName === '__user__'
      s.games++
      if (m.winner === '__user__') s.wins++
      else if (!m.winner) s.draws++
      else s.losses++
      s.gf += home ? m.goalsA : m.goalsB
      s.ga += home ? m.goalsB : m.goalsA
    })
  }
  return s
}

const f = (v, d = 1) => v.toFixed(d)
const cell = (text, width) => String(text).padStart(width)

console.log(`\nMundialito — experimento de formação (${RUNS} copas por formação, draft real)\n`)

const results = []
for (const [name, slotRoles] of Object.entries(FORMATIONS)) {
  process.stdout.write(`Simulando ${name}... `)
  const start = Date.now()
  const s = runFormation(name, slotRoles)
  console.log(`ok (${((Date.now() - start) / 1000).toFixed(1)}s)`)
  results.push({ name, s })
}

// Erro padrão da proporção (campeão) para saber se as diferenças são reais.
const seChamp = (p, n) => 100 * Math.sqrt((p / 100) * (1 - p / 100) / n)

console.log('\n== Resultado por formação ==\n')
const h = ['Formação', 'OVR médio', '% campeão', '±2σ', '% semi', '% passou', 'GF/jogo', 'GA/jogo', '% V', '±2σ']
const w = [10, 10, 10, 8, 8, 9, 8, 8, 7, 7]
console.log(h.map((x, i) => cell(x, w[i])).join('  '))
results.forEach(({ name, s }) => {
  const champ = (100 * s.champion) / RUNS
  const winPct = (100 * s.wins) / s.games
  const row = [
    name,
    f(s.ovrSum / RUNS),
    f(champ),
    '±' + f(2 * seChamp(champ, RUNS), 2),
    f((100 * s.reachedSemi) / RUNS),
    f((100 * s.passedGroups) / RUNS),
    f(s.gf / s.games, 2),
    f(s.ga / s.games, 2),
    f(winPct),
    '±' + f(2 * seChamp(winPct, s.games), 2),
  ]
  console.log(row.map((v, i) => cell(v, w[i])).join('  '))
})
console.log('\n(±2σ = margem de ~95%; diferenças menores que a margem são ruído.)\n')
