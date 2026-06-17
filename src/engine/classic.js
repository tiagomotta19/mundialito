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
// Frescor: reserva que ENTRA no XI joga o jogo com este bônus de OVR, só no jogo
// em que entra. Agora é PROBABILÍSTICO, não garantido — vira aposta/leitura:
// - chance ALTA quando a entrada tem mérito: cobre suspensão (forçada) ou
//   substitui um titular em baixa (seta ↓ neste jogo);
// - chance BAIXA na rotação "à toa" (titular que não caiu).
// O dado é travado por reserva no jogo (cobertura: aqui; troca manual: na tela),
// então desfazer e repor o mesmo jogador não re-rola (sem save-scum).
const FRESHNESS_BONUS = 2
const FRESH_CHANCE_MERIT = 0.75
const FRESH_CHANCE_RANDOM = 0.3

// "Com moral": o reserva que entrou, teve o frescor CONFIRMADO e se firmou no XI
// joga o(s) próximo(s) jogo(s) embalado — oscilação enviesada pro positivo
// (negativos sempre anulados: quem está com moral nunca cai). NÃO é buff
// permanente: ~90% de pegar moral
// no 1º jogo como titular pleno e só ~10% de esticar pra um 2º; depois normaliza.
// Mesma força média de ~1 jogo do modelo fixo, porém com cauda (momentos raros de
// "mão quente"). O momentum não sobrevive ao banco: sentar zera a moral.
const MORALE_FACTOR = 1.0 // prob. de anular um delta NEGATIVO quando com moral (nunca cai)
const MORALE_GRANT_CHANCE = 0.9 // frescor pegou → moral no próximo jogo
const MORALE_EXTEND_CHANCE = 0.1 // jogou com moral → estica mais um jogo

const clampOvr = (v) => Math.min(99, Math.max(30, v))

// ---------------------------------------------------------------------------
// Oscilação do jogo com fadiga (9.3 + camadas de fadiga do Modo Clássico)
// ---------------------------------------------------------------------------

// Chance de o jogador SER afetado pela fadiga (camada 1)
const fatigueAfflictChance = (ovr) => (ovr >= 85 ? 0.05 : ovr >= 75 ? 0.4 : 0.7)
// Se afetado, fração da chance de oscilação positiva que sobra (camada 2)
const fatiguePositiveFactor = (ovr) => (ovr >= 85 ? 0.6 : ovr >= 75 ? 0.45 : 0.3)

// Retorna o delta de OVR do jogo. positiveFactor < 1 reduz a chance de uma
// oscilação positiva sair (efeito da fadiga). moraleFactor > 0 anula deltas
// negativos com essa probabilidade (efeito do "com moral") — espelho da fadiga.
function gameDelta(ovr, positiveFactor = 1, moraleFactor = 0) {
  let tier
  if (ovr <= 69) tier = { chance: 0.45, min: -3, max: 3 }
  else if (ovr <= 79) tier = { chance: 0.4, min: -2, max: 2 }
  else if (ovr <= 89) tier = { chance: 0.3, min: -1, max: 2 }
  else tier = { chance: 0.18, min: -1, max: 1 }

  if (Math.random() > tier.chance) return 0
  let delta = Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min
  if (delta > 0 && Math.random() > positiveFactor) delta = 0 // fadiga anula positivos
  if (delta < 0 && Math.random() < moraleFactor) delta = 0 // moral anula negativos
  return delta
}

// Goleiro: oscilação SÓ positiva. Não há reserva de goleiro (o draft de reservas
// é 1 DEF/1 MID/1 FWD), então uma queda seria castigo sem saída — diferente do
// jogador de linha, que pode ser substituído ou rodado. Não sofrer gol no jogo
// anterior (clean sheet) rende +1 garantido, com 50% de virar +2; senão (ou no
// 1º jogo, sem histórico) há uma leve chance de +1. Substitui a oscilação padrão
// e fica fora da fadiga e do "com moral".
const GK_CLEAN_SHEET_DOUBLE = 0.5 // após clean sheet: chance de +2 em vez de +1
const GK_RANDOM_UP_CHANCE = 0.35 // sem clean sheet (ou 1º jogo): chance de +1

function goalkeeperDelta(cleanSheet) {
  if (cleanSheet) return Math.random() < GK_CLEAN_SHEET_DOUBLE ? 2 : 1
  return Math.random() < GK_RANDOM_UP_CHANCE ? 1 : 0
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
    comMoral: false, // momentum pós-frescor: oscila enviesado pro positivo no jogo
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
  // Gols sofridos pelo usuário no jogo anterior — base do bônus de clean sheet
  // do goleiro. null = ainda não houve jogo (tratado como "não foi clean sheet").
  let lastConceded = null

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

    // XI persistido do jogo anterior — quem não estava nele e entra agora
    // (cobertura de suspensão ou troca manual) ganha o frescor.
    const prevXI = new Set(slots.map((s) => s.player.id))

    // 1. Suspensões: tira o titular suspenso e promove um reserva (mesmo setor
    //    ou o mais próximo). O usuário nunca começa com 10 — se não houver
    //    reserva, o suspenso permanece (caso de borda raríssimo a 15%).
    // Frescor realizado neste jogo, por id de quem ENTRA. Cobertura de suspensão
    // é entrada forçada → conta como mérito (chance alta). Trocas manuais entram
    // depois, com o dado rolado na tela (em `play`).
    const freshById = new Map()
    const autoSubs = []
    slots
      .filter((s) => s.player.suspendedNext)
      .forEach((slot) => {
        const repl = pickReserveFor(slot.sector)
        if (repl) {
          const fresh = Math.random() < FRESH_CHANCE_MERIT
          freshById.set(repl.id, fresh)
          autoSubs.push({ outId: slot.player.id, inId: repl.id, role: slot.role, fresh })
          moveIntoSlot(slot, repl)
        }
      })

    // 2. Oscilação do jogo. SÓ titulares que vinham do XI oscilam: reserva no
    //    banco e quem ENTRA agora (cobertura de suspensão ou troca manual) jogam
    //    liso — quem entra é representado pelo FRESCOR, não por oscilação. Fadiga
    //    só na semi/final, para quem nunca foi rodado. "Com moral" enviesa a
    //    oscilação do titular embalado pro positivo. O goleiro tem modelo próprio
    //    (só-positivo, com clean sheet), fora da fadiga e do "com moral".
    //    Calculada aqui para ser exibida; o motor usa estes valores.
    const fatigueActive = round === 'semifinals' || round === 'final'
    const slotIds = new Set(slots.map((s) => s.player.id))
    const gameOvr = new Map()
    const afflicted = new Set()
    const moraleActive = new Set()
    allPlayers().forEach((p) => {
      const carriedOver = slotIds.has(p.id) && prevXI.has(p.id)
      if (!carriedOver) {
        gameOvr.set(p.id, clampOvr(p.ovr))
        return
      }
      // Goleiro: modelo próprio só-positivo (clean sheet), sem fadiga nem moral.
      if (p.position === 'GK') {
        gameOvr.set(p.id, clampOvr(p.ovr + goalkeeperDelta(lastConceded === 0)))
        return
      }
      let factor = 1
      if (fatigueActive && !p.rotated && Math.random() < fatigueAfflictChance(p.ovr)) {
        factor = fatiguePositiveFactor(p.ovr)
        afflicted.add(p.id)
      }
      let moraleFactor = 0
      if (p.comMoral) {
        moraleActive.add(p.id)
        moraleFactor = MORALE_FACTOR
      }
      gameOvr.set(p.id, clampOvr(p.ovr + gameDelta(p.ovr, factor, moraleFactor)))
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
      moraleActive,
      autoSubs,
      freshById,
      prevXI,
    }
    return pending
  }

  // Snapshot dos 14 jogadores para a tela entre-jogos
  function rosterView() {
    const p = prepareMatch()
    const view = (player, slot) => {
      const ovr = p.gameOvr.get(player.id)
      // Seta: reserva nunca mostra (não oscila — joga no OVR-base). Goleiro mostra
      // relativa ao OVR-base (bônus do jogo: 0/+1/+2), nunca negativa, coerente com
      // a oscilação só-positiva. Demais titulares: variação vs jogo anterior.
      let delta = null
      if (slot) {
        if (player.position === 'GK') delta = ovr - player.ovr
        else if (player.lastShownOvr != null) delta = ovr - player.lastShownOvr
      }
      return {
        id: player.id,
        name: player.name,
        sector: slot ? slot.sector : player.sector,
        ovr,
        delta,
        slotRole: slot ? slot.role : null,
        starter: !!slot,
        suspended: player.suspendedNext,
        autoSubIn: p.autoSubs.some((a) => a.inId === player.id),
        fatigued: p.afflicted.has(player.id),
        // Frescor realizado (cobertura de suspensão). Trocas manuais resolvem o
        // dado na tela; aqui só os titulares pré-trocas (entradas automáticas).
        fresh: !!slot && p.freshById.get(player.id) === true,
        // "Com moral": titular embalado neste jogo (oscilação enviesada pro positivo).
        comMoral: p.moraleActive.has(player.id),
        yellowCount: player.yellowCount,
      }
    }
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
      freshnessBonus: FRESHNESS_BONUS,
      freshChanceMerit: FRESH_CHANCE_MERIT,
      freshChanceRandom: FRESH_CHANCE_RANDOM,
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

    // Frescor realizado: coberturas de suspensão (roladas em prepareMatch) +
    // trocas manuais (o dado foi rolado na tela, sem save-scum, e chega em `fresh`).
    // A troca manual só decide para quem entra DE FATO no XI — recolocar um
    // titular do jogo anterior ou um já coberto por suspensão não sobrescreve.
    const freshMap = new Map(prep.freshById)
    swaps.forEach(({ inId, fresh }) => {
      if (prep.prevXI.has(inId) || prep.freshById.has(inId)) return
      freshMap.set(inId, fresh === true)
    })

    const userTeam = {
      name: USER_TEAM_NAME,
      formation,
      isUser: true,
      // position = setor TÁTICO do slot; ovr = OVR do jogo (já exibido) + frescor
      // só para quem entrou no XI neste jogo E teve o frescor confirmado
      players: slots.map((s) => {
        const entered = !prep.prevXI.has(s.player.id)
        const fresh = entered && freshMap.get(s.player.id) === true
        return {
          ...s.player,
          position: s.sector,
          ovr: prep.gameOvr.get(s.player.id) + (fresh ? FRESHNESS_BONUS : 0),
        }
      }),
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

    // "Com moral": atualizado ao fim do jogo e travado no jogador (sem save-scum —
    // acompanha o avanço da campanha). Quem ENTROU com frescor confirmado tem 90%
    // de embalar no próximo jogo; quem JÁ jogou com moral tem 10% de esticar mais
    // um, senão encerra. enteredFresh usa o XI definitivo (pós-trocas manuais).
    const enteredFresh = new Set(
      slots
        .filter((s) => !prep.prevXI.has(s.player.id) && freshMap.get(s.player.id) === true)
        .map((s) => s.player.id)
    )
    allPlayers().forEach((pl) => {
      if (prep.moraleActive.has(pl.id)) {
        pl.comMoral = Math.random() < MORALE_EXTEND_CHANCE
      } else if (enteredFresh.has(pl.id)) {
        pl.comMoral = Math.random() < MORALE_GRANT_CHANCE
      }
    })

    // Quem está no banco serviu eventual suspensão e foi rodado (imune à fadiga).
    // O momentum não sobrevive ao banco: sentar zera a moral.
    bench.forEach((pl) => {
      pl.suspendedNext = false
      pl.rotated = true
      pl.comMoral = false
    })

    // Registra o OVR exibido deste jogo (base da seta do próximo)
    allPlayers().forEach((pl) => {
      pl.lastShownOvr = prep.gameOvr.get(pl.id)
    })

    // Gols sofridos neste jogo: base do bônus de clean sheet do goleiro no próximo.
    lastConceded = result.goalsB

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
