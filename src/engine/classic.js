// Orquestrador incremental do Modo Clássico.
//
// Diferente do Modo Rápido (cup.js), onde a copa inteira é decidida de uma vez,
// aqui os jogos do USUÁRIO são jogados um a um, com o elenco que entra em campo
// em cada partida — porque substituições, boost, fadiga, cartões e a oscilação
// visível de OVR dependem desse elenco. Tudo que NÃO envolve o usuário (os 11
// outros grupos e as sub-chaves adversárias do mata-mata) é pré-simulado, já
// que é independente do time do usuário.
import bracketData from '../data/bracket.json'
import {
  buildNationalTeam,
  getGroupOpponents,
  simulateMatch,
  simulateRoundRobin,
  buildGroupTable,
  pickBestThirds,
  assignThirdPlaceSlots,
} from './simulator'
import groupsData from '../data/groups.json'
import { USER_TEAM_NAME, normalizeMatch, stageLabelKey } from './cup'
import { FORMATION_LAYOUTS, ROLE_TO_POSITION } from '../components/formationLayouts'

// Seleções que recebem o boost progressivo no mata-mata (lista fixa — não há
// um limiar de força pronto no motor; o PEDIGREE é multiplicador, não limiar).
const MAIN_NATIONS = new Set([
  'Brasil', 'Argentina', 'França', 'Espanha', 'Alemanha',
  'Inglaterra', 'Portugal', 'Holanda', 'Bélgica',
])

// Boost acumulado por fase (a partir das oitavas). 16-avos = round_of_32 = 0.
const KNOCKOUT_BOOST = {
  round_of_32: 0,
  round_of_16: 0.5,
  quarterfinals: 1.0,
  semifinals: 1.5,
  final: 2.0,
}

const MAX_SWAPS = 3
const CLASSIC_YELLOW_RATE = 0.15
const SECTORS = ['DEF', 'MID', 'FWD']

const clampOvr = (v) => Math.min(99, Math.max(30, v))

// ---------------------------------------------------------------------------
// Oscilação do jogo com fadiga (9.3 + camadas de fadiga do Modo Clássico)
// ---------------------------------------------------------------------------

// Chance de o jogador SER afetado pela fadiga (camada 1)
const fatigueAfflictChance = (ovr) => (ovr >= 85 ? 0.05 : ovr >= 75 ? 0.4 : 0.7)
// Se afetado, fração da chance de oscilação positiva que sobra (camada 2)
const fatiguePositiveFactor = (ovr) => (ovr >= 85 ? 0.6 : ovr >= 75 ? 0.45 : 0.3)

// Retorna o delta de OVR do jogo. positiveFactor < 1 reduz a chance de uma
// oscilação positiva sair (efeito da fadiga).
function gameDelta(ovr, positiveFactor = 1) {
  let tier
  if (ovr <= 69) tier = { chance: 0.3, min: -3, max: 3 }
  else if (ovr <= 79) tier = { chance: 0.2, min: -2, max: 2 }
  else if (ovr <= 89) tier = { chance: 0.15, min: -1, max: 2 }
  else tier = { chance: 0.05, min: -1, max: 1 }

  if (Math.random() > tier.chance) return 0
  let delta = Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min
  if (delta > 0 && Math.random() > positiveFactor) delta = 0
  return delta
}

// ---------------------------------------------------------------------------
// Boost do adversário (camada 3)
// ---------------------------------------------------------------------------

function applyBoost(team, round) {
  const boost = KNOCKOUT_BOOST[round] || 0
  if (!boost || !MAIN_NATIONS.has(team.name)) return team
  return { ...team, players: team.players.map((p) => ({ ...p, ovr: p.ovr + boost })) }
}

const teamStrengthValue = (team) =>
  Math.round((team.players.reduce((s, p) => s + p.ovr, 0) / team.players.length) * 10) / 10

// ---------------------------------------------------------------------------
// Resolução do chaveamento (sub-chaves adversárias do usuário)
// ---------------------------------------------------------------------------

const KO_ROUNDS = ['round_of_32', 'round_of_16', 'quarterfinals', 'semifinals']

function findMatchById(id) {
  for (const r of KO_ROUNDS) if (bracketData[r][id]) return bracketData[r][id]
  if (id === 'final') return bracketData.final
  if (id === 'third_place') return bracketData.third_place
  return null
}

// Vencedor da sub-árvore referenciada por `code` (leaf 1X/2X/3_… ou W_<id>).
// Só é chamado para o LADO ADVERSÁRIO do usuário, que nunca contém o usuário —
// então pode simular livremente. Resultados ficam em cache para consistência.
function resolveSubtreeWinner(pool, code, cache) {
  if (cache.has(code)) return cache.get(code)
  let team
  if (code.startsWith('W_')) {
    const m = findMatchById(code.slice(2))
    const home = resolveSubtreeWinner(pool, m.home, cache)
    const away = resolveSubtreeWinner(pool, m.away, cache)
    const res = simulateMatch(home, away, { knockout: true })
    team = res.winner === home.name ? home : away
  } else {
    team = pool[code]
  }
  cache.set(code, team)
  return team
}

// Cadeia estrutural dos jogos do usuário no mata-mata, a partir do slot dele.
// Independe de resultados: a árvore é fixa. Para cada fase devolve o código do
// lado adversário a resolver.
function buildUserChain(userSlotCode) {
  const chainRounds = [
    ['round_of_32', bracketData.round_of_32],
    ['round_of_16', bracketData.round_of_16],
    ['quarterfinals', bracketData.quarterfinals],
    ['semifinals', bracketData.semifinals],
    ['final', { final: bracketData.final }],
  ]

  const chain = []
  let userCode = userSlotCode
  let prevId = null
  for (let i = 0; i < chainRounds.length; i++) {
    const [round, dict] = chainRounds[i]
    const target = i === 0 ? userSlotCode : `W_${prevId}`
    const found = Object.entries(dict).find(
      ([, m]) => m.home === target || m.away === target
    )
    if (!found) break
    const [id, m] = found
    const oppCode = m.home === userCode ? m.away : m.home
    chain.push({ round, id, oppCode })
    prevId = id
    userCode = `W_${id}`
  }
  return chain
}

// ---------------------------------------------------------------------------
// Controlador do jogo Clássico
// ---------------------------------------------------------------------------

export function createClassicGame(gameConfig) {
  const { formation, groupId: userGroupId } = gameConfig
  const layout = FORMATION_LAYOUTS[formation] || FORMATION_LAYOUTS['4-3-3']

  // --- Elenco do usuário: 11 slots (alinhados ao layout) + banco (reservas) ---
  let nextId = 0
  const mkPlayer = (p, sector) => ({
    ...p,
    id: nextId++,
    sector, // setor intrínseco (para troca/cobertura); o setor TÁTICO é o do slot
    yellowCount: 0,
    suspendedNext: false,
    rotated: false, // já saiu/foi reserva em algum jogo → imune à fadiga
    lastShownOvr: null,
  })

  const slots = layout.map((slot, i) => {
    const player = gameConfig.players[i]
    return {
      role: slot.role,
      x: slot.x,
      y: slot.y,
      sector: ROLE_TO_POSITION[slot.role],
      player: mkPlayer(player, player.position),
    }
  })
  const bench = (gameConfig.reserves || []).map((p) => mkPlayer(p, p.sector))

  const allPlayers = () => [...slots.map((s) => s.player), ...bench]

  // --- Pré-simulação: 11 outros grupos + jogos internos do grupo do usuário ---
  const otherTables = {}
  Object.entries(groupsData).forEach(([gid, group]) => {
    if (gid === userGroupId) return
    const teams = group.teams.map((name) => buildNationalTeam(name))
    otherTables[gid] = simulateRoundRobin(teams).table
  })

  const userTableTeam = { name: USER_TEAM_NAME }
  const opponents = getGroupOpponents(userGroupId).map((name) => buildNationalTeam(name))
  // Os 3 jogos entre os adversários (que o usuário não disputa)
  const groupOtherResults = []
  for (let i = 0; i < opponents.length; i++) {
    for (let j = i + 1; j < opponents.length; j++) {
      const r = simulateMatch(opponents[i], opponents[j], { knockout: false })
      groupOtherResults.push({ teamA: opponents[i], teamB: opponents[j], goalsA: r.goalsA, goalsB: r.goalsB })
    }
  }
  const userGroupResults = []

  // --- Estado da campanha ---
  let groupMatchday = 0 // 0..3
  let phase = 'group' // group | groupDone | knockout | result
  let userGroupTable = null
  let qualified = false
  let pool = null
  let userSlotCode = null
  let chain = []
  let kIdx = 0
  const subtreeCache = new Map()
  const koOpponents = [] // adversário resolvido por fase do usuário

  const campaignMatches = []
  let stageReached = 'group_stage'
  let eliminated = false
  let champion = false

  let pending = null // snapshot do jogo atual (memo entre renders)

  // --- Helpers de elenco ---
  const sectorDistance = (a, b) => Math.abs(SECTORS.indexOf(a) - SECTORS.indexOf(b))

  // Move um jogador do banco para um slot, mandando o ocupante atual ao banco.
  function moveIntoSlot(slot, benchPlayer) {
    const idx = bench.indexOf(benchPlayer)
    if (idx === -1) return
    bench.splice(idx, 1)
    bench.push(slot.player)
    slot.player = benchPlayer
  }

  // Melhor reserva para cobrir um setor: mesmo setor primeiro, senão o mais
  // próximo. Ignora reservas suspensas.
  function pickReserveFor(sector) {
    const avail = bench.filter((p) => !p.suspendedNext)
    if (!avail.length) return null
    return avail.sort((a, b) => sectorDistance(a.sector, sector) - sectorDistance(b.sector, sector))[0]
  }

  function currentRound() {
    return phase === 'knockout' ? chain[kIdx]?.round : null
  }

  // --- Qualificação após os 3 jogos de grupo ---
  function resolveQualification() {
    userGroupTable = buildGroupTable(
      [userTableTeam, ...opponents],
      [...groupOtherResults, ...userGroupResults]
    )
    const allTables = { ...otherTables, [userGroupId]: userGroupTable }

    const thirds = Object.entries(allTables).map(([gid, table]) => ({ ...table[2], group: gid }))
    const bestThirds = pickBestThirds(thirds)

    pool = {}
    Object.entries(allTables).forEach(([gid, table]) => {
      pool[`1${gid}`] = table[0].team
      pool[`2${gid}`] = table[1].team
    })
    assignThirdPlaceSlots(pool, bestThirds)

    userSlotCode = Object.keys(pool).find((code) => pool[code]?.name === USER_TEAM_NAME) || null
    qualified = !!userSlotCode

    if (qualified) {
      chain = buildUserChain(userSlotCode)
      phase = 'knockout'
      kIdx = 0
    } else {
      phase = 'result'
      stageReached = 'group_stage'
      eliminated = true
    }
  }

  function knockoutOpponent() {
    if (koOpponents[kIdx]) return koOpponents[kIdx]
    const opp = resolveSubtreeWinner(pool, chain[kIdx].oppCode, subtreeCache)
    koOpponents[kIdx] = opp
    return opp
  }

  // --- Preparação do jogo atual (suspensões + oscilação + snapshot) ---
  function prepareMatch() {
    if (pending) return pending

    const isKnockout = phase === 'knockout'
    const round = currentRound()

    // 1. Suspensões: tira o titular suspenso e promove um reserva (mesmo setor
    //    ou o mais próximo). O usuário nunca começa com 10 — se não houver
    //    reserva, o suspenso permanece (caso de borda raríssimo a 15%).
    const autoSubs = []
    slots
      .filter((s) => s.player.suspendedNext)
      .forEach((slot) => {
        const repl = pickReserveFor(slot.sector)
        if (repl) {
          autoSubs.push({ outId: slot.player.id, inId: repl.id, role: slot.role })
          moveIntoSlot(slot, repl)
        }
      })

    // 2. Oscilação do jogo para os 14 (fadiga só na semi/final, para quem nunca
    //    foi rodado). Calculada aqui para ser exibida; o motor usa estes valores.
    const fatigueActive = round === 'semifinals' || round === 'final'
    const gameOvr = new Map()
    const afflicted = new Set()
    allPlayers().forEach((p) => {
      let factor = 1
      if (fatigueActive && !p.rotated && Math.random() < fatigueAfflictChance(p.ovr)) {
        factor = fatiguePositiveFactor(p.ovr)
        afflicted.add(p.id)
      }
      gameOvr.set(p.id, clampOvr(p.ovr + gameDelta(p.ovr, factor)))
    })

    const opponent = isKnockout ? applyBoost(knockoutOpponent(), round) : opponents[groupMatchday]

    pending = {
      isKnockout,
      round,
      stageKey: isKnockout ? stageLabelKey(round) : 'stage_group',
      matchday: isKnockout ? null : groupMatchday + 1,
      opponent: { name: opponent.name, strength: teamStrengthValue(opponent) },
      opponentTeam: opponent,
      boost: isKnockout ? KNOCKOUT_BOOST[round] || 0 : 0,
      gameOvr,
      afflicted,
      autoSubs,
    }
    return pending
  }

  // Snapshot dos 14 jogadores para a tela entre-jogos
  function rosterView() {
    const p = prepareMatch()
    const view = (player, slot) => ({
      id: player.id,
      name: player.name,
      sector: slot ? slot.sector : player.sector,
      ovr: p.gameOvr.get(player.id),
      delta: player.lastShownOvr == null ? null : p.gameOvr.get(player.id) - player.lastShownOvr,
      slotRole: slot ? slot.role : null,
      starter: !!slot,
      suspended: player.suspendedNext,
      autoSubIn: p.autoSubs.some((a) => a.inId === player.id),
      fatigued: p.afflicted.has(player.id),
      yellowCount: player.yellowCount,
    })
    return [
      ...slots.map((s) => view(s.player, s)),
      ...bench.map((pl) => view(pl, null)),
    ]
  }

  function matchInfo() {
    const p = prepareMatch()
    return {
      isKnockout: p.isKnockout,
      round: p.round,
      stageKey: p.stageKey,
      matchday: p.matchday,
      opponent: p.opponent,
      boost: p.boost,
      maxSwaps: MAX_SWAPS,
      roster: rosterView(),
    }
  }

  // Troca manual titular↔reserva (mesmo setor). swaps = [{ outId, inId }]
  function applySwaps(swaps) {
    swaps.forEach(({ outId, inId }) => {
      const slot = slots.find((s) => s.player.id === outId)
      const benchPlayer = bench.find((pl) => pl.id === inId)
      if (!slot || !benchPlayer) return
      if (benchPlayer.sector !== slot.sector || benchPlayer.suspendedNext) return
      moveIntoSlot(slot, benchPlayer)
    })
  }

  // --- Jogar a partida atual com o elenco definitivo ---
  function play(swaps = []) {
    const prep = prepareMatch()
    applySwaps(swaps)

    const userTeam = {
      name: USER_TEAM_NAME,
      formation,
      isUser: true,
      // position = setor TÁTICO do slot; ovr = OVR do jogo (já exibido)
      players: slots.map((s) => ({
        ...s.player,
        position: s.sector,
        ovr: prep.gameOvr.get(s.player.id),
      })),
    }

    const result = simulateMatch(userTeam, prep.opponentTeam, {
      knockout: prep.isKnockout,
      teamAOscillate: false, // OVRs do usuário já são os do jogo
      teamBOscillate: true,
      yellowRate: CLASSIC_YELLOW_RATE,
    })

    const stage = prep.isKnockout ? prep.round : 'group_stage'
    const match = normalizeMatch({ ...result, home: userTeam.name, away: prep.opponentTeam.name, stage })
    campaignMatches.push(match)

    // --- Pós-jogo ---
    // Cartões: acumula amarelos do lado do usuário; 2 → suspenso no próximo.
    result.events
      .filter((e) => e.type === 'yellow' && e.side === 'home')
      .forEach((e) => {
        const pl = slots.find((s) => s.player.name === e.player)?.player
        if (!pl) return
        pl.yellowCount++
        if (pl.yellowCount >= 2) {
          pl.suspendedNext = true
          pl.yellowCount = 0
        }
      })

    // Quem está no banco serviu eventual suspensão e foi rodado (imune à fadiga)
    bench.forEach((pl) => {
      pl.suspendedNext = false
      pl.rotated = true
    })

    // Registra o OVR exibido deste jogo (base da seta do próximo)
    allPlayers().forEach((pl) => {
      pl.lastShownOvr = prep.gameOvr.get(pl.id)
    })

    pending = null

    // --- Avanço de fase ---
    if (!prep.isKnockout) {
      const opp = opponents[groupMatchday]
      userGroupResults.push({ teamA: userTableTeam, teamB: opp, goalsA: result.goalsA, goalsB: result.goalsB })
      groupMatchday++
      if (groupMatchday >= 3) {
        resolveQualification()
        return { match, isKnockout: false, groupDone: true, qualified, finished: !qualified }
      }
      return { match, isKnockout: false, groupDone: false }
    }

    const won = result.winner === USER_TEAM_NAME
    stageReached = prep.round
    if (!won) {
      eliminated = true
      phase = 'result'
      return { match, isKnockout: true, won: false, finished: true }
    }
    if (prep.round === 'final') {
      champion = true
      phase = 'result'
      return { match, isKnockout: true, won: true, finished: true }
    }
    kIdx++
    return { match, isKnockout: true, won: true, finished: false }
  }

  return {
    matchInfo,
    play,
    getGroupId: () => userGroupId,
    getGroupTable: () => userGroupTable,
    isQualified: () => qualified,
    getLineupPlayers: () => slots.map((s) => s.player),
    getCampaign: () => ({ champion, stageReached, eliminated, matches: campaignMatches }),
  }
}
