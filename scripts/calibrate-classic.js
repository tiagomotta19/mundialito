// Ferramenta de desenvolvimento — NÃO faz parte do app.
// Calibra o MODO CLÁSSICO: simula copas em massa coletando a curva completa de
// fases (grupos → 16-avos → oitavas → quartas → semi → final → campeão).
//
// Uso: node scripts/calibrate-classic.js [n]   (n = copas por perfil, padrão 1000)
//
// Baseline: SEM trocas manuais (play([]) a cada jogo) — só entram as
// substituições automáticas por suspensão. É o piso de engajamento; um jogador
// que faz trocas (rotacionar evita fadiga, trocar quem cai de forma) só melhora.
//
// Mesmos hooks de resolução do calibrate.js (JSON sem atributo + import sem .js).
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
const { createClassicGame } = await import('../src/engine/classic.js')
const { isCompatible, ROLE_TO_POSITION } = await import('../src/engine/compatibility.js')

const squads = JSON.parse(
  readFileSync(new URL('../src/data/squads_final.json', import.meta.url), 'utf8')
)

// ---------------------------------------------------------------------------
// Perfis (1 GK, 4 DEF, 3 MID, 3 FWD — formação 4-3-3) + 3 reservas (DEF/MID/FWD)
// ---------------------------------------------------------------------------

const SLOTS = { GK: 1, DEF: 4, MID: 3, FWD: 3 }
const RESERVE_SECTORS = ['DEF', 'MID', 'FWD']
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

// Elite: melhores de cada posição (espaço extra para variar + reservas)
function elitePool() {
  const pool = {}
  Object.entries(byPosition).forEach(([pos, list]) => {
    const need = (SLOTS[pos] || 0) + (RESERVE_SECTORS.includes(pos) ? 1 : 0)
    pool[pos] = list.slice(0, Math.max(need * 4, need))
  })
  return pool
}

const PROFILES = [
  { id: 'ELITE', label: 'Elite', pool: elitePool() },
  { id: 'BOM', label: 'Bom (80-85)', pool: rangePool(80, 85) },
  { id: 'MEDIO', label: 'Médio (73-79)', pool: rangePool(73, 79) },
  { id: 'FRACO', label: 'Fraco (65-72)', pool: rangePool(65, 72) },
  { id: 'GREEDY', label: 'Draft Real', greedy: true },
]

function sampleExcluding(list, count, usedNames) {
  const copy = list.filter((p) => !usedNames.has(p.name))
  const picked = []
  for (let i = 0; i < count && copy.length; i++) {
    picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  }
  return picked
}

function buildProfileTeam(pool) {
  const used = new Set()
  const players = []
  Object.entries(SLOTS).forEach(([pos, count]) => {
    const picked = sampleExcluding(pool[pos], count, used)
    if (picked.length < count) throw new Error(`Pool insuficiente para ${pos}`)
    picked.forEach((p) => used.add(p.name))
    players.push(...picked)
  })
  const reserves = []
  RESERVE_SECTORS.forEach((sector) => {
    const [p] = sampleExcluding(pool[sector], 1, used)
    if (!p) throw new Error(`Pool insuficiente para reserva ${sector}`)
    used.add(p.name)
    reserves.push({ ...p, sector, position: sector })
  })
  return { players, reserves }
}

// ---------------------------------------------------------------------------
// Perfil "Draft Real" (GREEDY): mesma lógica do "Completar automaticamente"
// ---------------------------------------------------------------------------

const GREEDY_SLOTS = ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'] // 4-3-3
const ALL_TEAMS = Object.keys(squads)
const randomTeam = () => ALL_TEAMS[Math.floor(Math.random() * ALL_TEAMS.length)]

function bestAvailable(team, slotRole, used) {
  const candidates = squads[team].filter(
    (p) => isCompatible(p, slotRole) && !used.has(`${team}::${p.name}`)
  )
  if (!candidates.length) return null
  return candidates.reduce((best, p) => (p.ovr > best.ovr ? p : best))
}

function bestAvailableSector(team, sector, used) {
  const candidates = squads[team].filter(
    (p) =>
      (p.position === sector ||
        [p.role, ...(p.altRoles || [])].some((r) => ROLE_TO_POSITION[r] === sector)) &&
      !used.has(`${team}::${p.name}`)
  )
  if (!candidates.length) return null
  return candidates.reduce((best, p) => (p.ovr > best.ovr ? p : best))
}

function pickGreedy(pickFn) {
  let pick = null
  let pickTeam = null
  for (let attempt = 0; attempt < 15 && !pick; attempt++) {
    const team = randomTeam()
    const best = pickFn(team)
    if (best) {
      pick = best
      pickTeam = team
    }
  }
  if (!pick) {
    ALL_TEAMS.forEach((team) => {
      const best = pickFn(team)
      if (best && (!pick || best.ovr > pick.ovr)) {
        pick = best
        pickTeam = team
      }
    })
  }
  return { pick, pickTeam }
}

function buildGreedyTeam() {
  const used = new Set()
  const players = []
  GREEDY_SLOTS.forEach((slotRole) => {
    const { pick, pickTeam } = pickGreedy((team) => bestAvailable(team, slotRole, used))
    if (!pick) throw new Error(`Nenhum jogador compatível com ${slotRole}`)
    used.add(`${pickTeam}::${pick.name}`)
    players.push({ ...pick, slotRole, position: ROLE_TO_POSITION[slotRole] })
  })
  const reserves = []
  RESERVE_SECTORS.forEach((sector) => {
    const { pick, pickTeam } = pickGreedy((team) => bestAvailableSector(team, sector, used))
    if (!pick) throw new Error(`Nenhum reserva para ${sector}`)
    used.add(`${pickTeam}::${pick.name}`)
    reserves.push({ ...pick, sector, position: sector })
  })
  return { players, reserves }
}

// ---------------------------------------------------------------------------
// Simulação em massa
// ---------------------------------------------------------------------------

const RUNS = Number(process.argv[2]) || 1000
const ENGAGED = process.argv.includes('engaged')
const MAXROT = process.argv.includes('max')

// Política agressiva: a cada jogo troca o titular mais fraco de cada setor pelo
// reserva daquele setor. Como o trocado vai pro banco e volta no jogo seguinte,
// os dois alternam e ficam SEMPRE "entrando" — mede o teto do frescor (exploit
// de alternância) e o risco de balanceamento.
function maxRotationPolicy(info) {
  const starters = info.roster.filter((r) => r.starter)
  const benchBySector = {}
  info.roster
    .filter((r) => !r.starter && !r.suspended)
    .forEach((b) => (benchBySector[b.sector] = b))
  const swaps = []
  const used = new Set()
  for (const sector of ['DEF', 'MID', 'FWD']) {
    if (swaps.length >= info.maxSwaps) break
    const res = benchBySector[sector]
    if (!res) continue
    const cand = starters
      .filter((r) => r.sector === sector && !used.has(r.id))
      .sort((a, b) => a.ovr - b.ovr)[0]
    if (cand) {
      swaps.push({ outId: cand.id, inId: res.id })
      used.add(cand.id)
    }
  }
  return swaps
}
const STAGE_ORDER = ['group_stage', 'round_of_32', 'round_of_16', 'quarterfinals', 'semifinals', 'final']
const stageIdx = (s) => STAGE_ORDER.indexOf(s)
const KO_FROM_R16 = ['round_of_16', 'quarterfinals', 'semifinals', 'final']

// Política de gestão ativa (variante "jogador engajado"):
// 1) saca qualquer titular que oscilou negativo (gameOvr < base) em 2 jogos
//    seguidos, pelo reserva do mesmo setor;
// 2) a partir das oitavas, rotaciona 1 titular (descanso → imune à fadiga).
// Respeita mesmo setor, máx. 3 trocas, 1 reserva por setor, reserva não suspenso.
function engagedPolicy(info, baseById, streak) {
  const starters = info.roster.filter((r) => r.starter)
  const bench = info.roster.filter((r) => !r.starter)
  const benchBySector = {}
  bench.forEach((b) => {
    if (!b.suspended) benchBySector[b.sector] = b
  })

  // Atualiza a sequência de oscilação negativa (vs base) dos titulares
  starters.forEach((r) => {
    const down = r.ovr < baseById.get(r.id)
    streak.set(r.id, down ? (streak.get(r.id) || 0) + 1 : 0)
  })
  bench.forEach((b) => streak.set(b.id, 0)) // descanso zera a sequência

  const swaps = []
  const usedSectors = new Set()

  // 1) forma ruim: 2 jogos negativos seguidos
  starters
    .filter((r) => (streak.get(r.id) || 0) >= 2)
    .sort((a, b) => a.ovr - b.ovr)
    .forEach((r) => {
      if (swaps.length >= info.maxSwaps || usedSectors.has(r.sector)) return
      const res = benchBySector[r.sector]
      if (!res) return
      swaps.push({ outId: r.id, inId: res.id })
      usedSectors.add(r.sector)
      streak.set(r.id, 0)
    })

  // 2) rotação de descanso a partir das oitavas
  if (info.isKnockout && KO_FROM_R16.includes(info.round) && swaps.length < info.maxSwaps) {
    const cand = starters
      .filter((r) => !usedSectors.has(r.sector) && benchBySector[r.sector])
      .sort((a, b) => a.ovr - b.ovr)[0]
    if (cand) swaps.push({ outId: cand.id, inId: benchBySector[cand.sector].id })
  }

  return swaps
}

function runProfile(profile) {
  const s = {
    reached: { round_of_32: 0, round_of_16: 0, quarterfinals: 0, semifinals: 0, final: 0 },
    champion: 0,
    outInGroups: 0,
    games: 0,
    matchWins: 0,
    matchDraws: 0,
    matchLosses: 0,
    gf: 0,
    ga: 0,
    score00: 0,
    blowouts: 0,
    yellow: 0,
    swaps: 0,
    avgOvrSum: 0,
  }

  for (let i = 0; i < RUNS; i++) {
    const { players, reserves } = profile.greedy ? buildGreedyTeam() : buildProfileTeam(profile.pool)
    s.avgOvrSum += players.reduce((a, p) => a + p.ovr, 0) / players.length

    const baseById = new Map()
    players.forEach((p, idx) => baseById.set(idx, p.ovr))
    reserves.forEach((p, idx) => baseById.set(11 + idx, p.ovr))
    const streak = new Map()

    const game = createClassicGame({
      mode: 'classic',
      formation: FORMATION,
      groupId: pickGroup(),
      players,
      reserves,
    })

    let guard = 0
    while (true) {
      if (++guard > 40) throw new Error('loop')
      const info = game.matchInfo()
      const swaps = MAXROT
        ? maxRotationPolicy(info)
        : ENGAGED
          ? engagedPolicy(info, baseById, streak)
          : []
      s.swaps += swaps.length
      const res = game.play(swaps)
      if (res.finished || (res.groupDone && !res.qualified)) break
    }

    const camp = game.getCampaign()
    const reachedIdx = stageIdx(camp.stageReached)
    if (camp.stageReached === 'group_stage') s.outInGroups++
    ;['round_of_32', 'round_of_16', 'quarterfinals', 'semifinals', 'final'].forEach((st) => {
      if (reachedIdx >= stageIdx(st)) s.reached[st]++
    })
    if (camp.champion) s.champion++

    camp.matches.forEach((m) => {
      const userIsHome = m.homeName === '__user__'
      s.games++
      if (m.winner === '__user__') s.matchWins++
      else if (!m.winner) s.matchDraws++
      else s.matchLosses++
      s.gf += userIsHome ? m.goalsA : m.goalsB
      s.ga += userIsHome ? m.goalsB : m.goalsA
      const hi = Math.max(m.goalsA, m.goalsB)
      if (hi === 0) s.score00++
      if (hi >= 4) s.blowouts++
      s.yellow += m.events.filter((e) => e.type === 'yellow' && e.side === 'home').length
    })
  }
  return s
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

const f = (v, d = 1) => v.toFixed(d)
const cell = (text, width) => String(text).padStart(width)

console.log(
  `\nMundialito — calibração do MODO CLÁSSICO (${RUNS} copas/perfil, ${FORMATION}, ${
    ENGAGED ? 'GESTÃO ATIVA' : 'sem trocas manuais'
  })\n`
)

const results = []
for (const profile of PROFILES) {
  process.stdout.write(`Simulando ${profile.label}... `)
  const start = Date.now()
  const stats = runProfile(profile)
  console.log(`ok (${((Date.now() - start) / 1000).toFixed(1)}s)`)
  results.push({ profile, stats })
}

const pct = (n, total = RUNS) => (100 * n) / total

console.log('\n== Curva de fases alcançadas (cumulativo) ==\n')
const h1 = ['Perfil', 'OVR méd', '16-avos', 'oitavas', 'quartas', 'semis', 'final', 'campeão']
const w1 = [14, 8, 9, 9, 9, 8, 8, 9]
console.log(h1.map((h, i) => cell(h, w1[i])).join('  '))
results.forEach(({ profile, stats: s }) => {
  const row = [
    profile.label,
    f(s.avgOvrSum / RUNS),
    f(pct(s.reached.round_of_32)),
    f(pct(s.reached.round_of_16)),
    f(pct(s.reached.quarterfinals)),
    f(pct(s.reached.semifinals)),
    f(pct(s.reached.final)),
    f(pct(s.champion)),
  ]
  console.log(row.map((v, i) => cell(v, w1[i])).join('  '))
})

console.log('\n== Placares e jogo (jogos do usuário) ==\n')
const h2 = ['Perfil', '% V', '% E', '% D', 'GF/jg', 'GA/jg', '% 0x0', '% gol4+', '🟨/jg', 'trocas/jg']
const w2 = [14, 6, 6, 6, 7, 7, 7, 8, 7, 10]
console.log(h2.map((h, i) => cell(h, w2[i])).join('  '))
results.forEach(({ profile, stats: s }) => {
  const row = [
    profile.label,
    f(pct(s.matchWins, s.games)),
    f(pct(s.matchDraws, s.games)),
    f(pct(s.matchLosses, s.games)),
    f(s.gf / s.games, 2),
    f(s.ga / s.games, 2),
    f(pct(s.score00, s.games)),
    f(pct(s.blowouts, s.games)),
    f(s.yellow / s.games, 2),
    f(s.swaps / s.games, 2),
  ]
  console.log(row.map((v, i) => cell(v, w2[i])).join('  '))
})

console.log('')
