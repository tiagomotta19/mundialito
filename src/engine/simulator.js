import squadsData from '../data/squads_final.json'
import groupsData from '../data/groups.json'
import bracketData from '../data/bracket.json'

// ---------------------------------------------------------------------------
// Formações
// ---------------------------------------------------------------------------

export const FORMATIONS = {
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '4-2-3-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
}

// ---------------------------------------------------------------------------
// Oscilação de OVR (9.3)
// ---------------------------------------------------------------------------

export function applyOscillation(ovr) {
  let tier
  if (ovr <= 69) tier = { chance: 0.30, min: -3, max: 3 }
  else if (ovr <= 79) tier = { chance: 0.20, min: -2, max: 2 }
  else if (ovr <= 89) tier = { chance: 0.15, min: -1, max: 2 }
  else tier = { chance: 0.05, min: -1, max: 1 }

  if (Math.random() > tier.chance) return { ovr, delta: 0 }

  const delta = Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min
  return { ovr: Math.min(99, Math.max(30, ovr + delta)), delta }
}

// ---------------------------------------------------------------------------
// Times nacionais
// ---------------------------------------------------------------------------

export function getSquadPlayers(teamName) {
  return squadsData[teamName] || []
}

export function getAllTeamNames() {
  return Object.keys(squadsData)
}

export function buildNationalTeam(teamName, formation = '4-3-3') {
  const squad = getSquadPlayers(teamName)
  const slots = FORMATIONS[formation]
  const byPosition = { GK: [], DEF: [], MID: [], FWD: [] }
  squad.forEach((p) => byPosition[p.position]?.push(p))
  Object.values(byPosition).forEach((list) => list.sort((a, b) => b.ovr - a.ovr))

  const players = []
  Object.entries(slots).forEach(([position, count]) => {
    players.push(...byPosition[position].slice(0, count))
  })

  return { name: teamName, players, formation, isUser: false }
}

/** Força média (OVR) do time titular de uma seleção, ex: 74.3 */
export function getTeamStrength(teamName, formation = '4-3-3') {
  const team = buildNationalTeam(teamName, formation)
  if (!team.players.length) return 0
  const total = team.players.reduce((sum, p) => sum + p.ovr, 0)
  return Math.round((total / team.players.length) * 10) / 10
}

/** Classifica a dificuldade de um grupo a partir da força média. */
export function getGroupDifficulty(avgStrength) {
  if (avgStrength > 74) return 'hard'
  if (avgStrength >= 72) return 'balanced'
  return 'easy'
}

// ---------------------------------------------------------------------------
// Coesão e força por setor (9.1, 9.2)
// ---------------------------------------------------------------------------

function buildSectors(players) {
  return {
    def: players.filter((p) => p.position === 'GK' || p.position === 'DEF'),
    mid: players.filter((p) => p.position === 'MID'),
    fwd: players.filter((p) => p.position === 'FWD'),
  }
}

function calculateCohesion(sectorPlayers, isUserTeam) {
  if (!isUserTeam) return 1.0

  const leagueCounts = {}
  sectorPlayers.forEach((p) => {
    leagueCounts[p.league] = (leagueCounts[p.league] || 0) + 1
  })
  const max = Math.max(0, ...Object.values(leagueCounts))

  let bonus = 0
  if (max >= 3) bonus = 0.05
  else if (max >= 2) bonus = 0.03

  return Math.min(0.97, 0.88 + bonus)
}

function getSectorStrength(sectorPlayers, isUserTeam) {
  if (!sectorPlayers.length) return 0
  const oscillated = sectorPlayers.map((p) => applyOscillation(p.ovr).ovr)
  const avg = oscillated.reduce((sum, v) => sum + v, 0) / oscillated.length
  return avg * calculateCohesion(sectorPlayers, isUserTeam)
}

export function calculateTeamStrengths(team) {
  const { def, mid, fwd } = buildSectors(team.players)
  return {
    def: getSectorStrength(def, !!team.isUser),
    mid: getSectorStrength(mid, !!team.isUser),
    fwd: getSectorStrength(fwd, !!team.isUser),
  }
}

// ---------------------------------------------------------------------------
// Confronto entre times (9.4, 9.5)
// ---------------------------------------------------------------------------

const ADVANTAGE_SCALE = 6
const BASE_OPPORTUNITIES = 4

function effectiveAdvantage(atk, def) {
  if (!def) return 0
  const raw = (atk - def) / def
  return Math.sign(raw) * Math.log(1 + Math.abs(raw)) * ADVANTAGE_SCALE
}

function midPressureBonus(midA, midB) {
  const diff = midA - midB
  if (Math.abs(diff) < 0.5) return { a: 0, b: 0 }
  const bonus = 0.03 + Math.random() * 0.02
  return diff > 0 ? { a: bonus, b: 0 } : { a: 0, b: bonus }
}

function generateGoals(atk, def, midBonus = 0, opportunitiesOverride = null) {
  const adv = effectiveAdvantage(atk, def)
  const opportunities =
    opportunitiesOverride ?? Math.max(1, Math.round(BASE_OPPORTUNITIES + adv + midBonus * 15))

  let goals = 0
  for (let i = 0; i < opportunities; i++) {
    const conversion = 0.30 + Math.random() * 0.10 // 30-40%
    if (Math.random() < conversion) goals++
  }
  return goals
}

// ---------------------------------------------------------------------------
// Pênaltis (9.7)
// ---------------------------------------------------------------------------

function takePenalty(shooter, goalkeeper) {
  let chance = 0.75 + (shooter.ovr - goalkeeper.ovr) * 0.003
  chance = Math.min(0.92, Math.max(0.60, chance))
  return Math.random() < chance
}

export function simulatePenalties(teamA, teamB) {
  const gkA = teamA.players.find((p) => p.position === 'GK') || teamA.players[0]
  const gkB = teamB.players.find((p) => p.position === 'GK') || teamB.players[0]
  const shootersA = [...teamA.players].filter((p) => p !== gkA).sort((a, b) => b.ovr - a.ovr)
  const shootersB = [...teamB.players].filter((p) => p !== gkB).sort((a, b) => b.ovr - a.ovr)

  let scoreA = 0
  let scoreB = 0
  const rounds = []

  for (let i = 0; i < 5; i++) {
    const goalA = takePenalty(shootersA[i % shootersA.length], gkB)
    const goalB = takePenalty(shootersB[i % shootersB.length], gkA)
    if (goalA) scoreA++
    if (goalB) scoreB++
    rounds.push({ a: goalA, b: goalB })
  }

  let extra = 0
  while (scoreA === scoreB && extra < 10) {
    const goalA = takePenalty(randomFrom(shootersA), gkB)
    const goalB = takePenalty(randomFrom(shootersB), gkA)
    if (goalA) scoreA++
    if (goalB) scoreB++
    rounds.push({ a: goalA, b: goalB })
    extra++
  }

  return {
    scoreA,
    scoreB,
    rounds,
    winner: scoreA > scoreB ? teamA.name : teamB.name,
  }
}

// ---------------------------------------------------------------------------
// Eventos do jogo (12)
// ---------------------------------------------------------------------------

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedPick(players) {
  const weights = players.map((p) => Math.max(1, p.ovr))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let r = Math.random() * total
  for (let i = 0; i < players.length; i++) {
    r -= weights[i]
    if (r <= 0) return players[i]
  }
  return players[players.length - 1]
}

function generateMatchEvents(teamA, teamB, goalsA, goalsB, extraTime) {
  const maxMinute = extraTime ? 120 : 90
  const events = []

  const addGoals = (team, side, count) => {
    const scorers = team.players.filter((p) => p.position === 'FWD' || p.position === 'MID')
    const pool = scorers.length ? scorers : team.players
    for (let i = 0; i < count; i++) {
      const scorer = weightedPick(pool)
      events.push({
        minute: 1 + Math.floor(Math.random() * maxMinute),
        type: 'goal',
        side,
        player: scorer.name,
      })
    }
  }

  addGoals(teamA, 'home', goalsA)
  addGoals(teamB, 'away', goalsB)

  ;[
    [teamA, 'home'],
    [teamB, 'away'],
  ].forEach(([team, side]) => {
    if (Math.random() < 0.40) {
      events.push({
        minute: 1 + Math.floor(Math.random() * maxMinute),
        type: 'yellow',
        side,
        player: randomFrom(team.players).name,
      })
    }
    if (Math.random() < 0.05) {
      events.push({
        minute: 1 + Math.floor(Math.random() * maxMinute),
        type: 'red',
        side,
        player: randomFrom(team.players).name,
      })
    }
  })

  return events.sort((a, b) => a.minute - b.minute)
}

// ---------------------------------------------------------------------------
// Simulação de uma partida (9.4 - 9.7)
// ---------------------------------------------------------------------------

export function simulateMatch(teamA, teamB, { knockout = false } = {}) {
  const strA = calculateTeamStrengths(teamA)
  const strB = calculateTeamStrengths(teamB)
  const midBonus = midPressureBonus(strA.mid, strB.mid)

  let goalsA = generateGoals(strA.fwd, strB.def, midBonus.a)
  let goalsB = generateGoals(strB.fwd, strA.def, midBonus.b)

  let extraTime = false
  let penalties = null

  if (knockout && goalsA === goalsB) {
    extraTime = true
    goalsA += generateGoals(strA.fwd, strB.def, midBonus.a, 1 + Math.round(Math.random()))
    goalsB += generateGoals(strB.fwd, strA.def, midBonus.b, 1 + Math.round(Math.random()))

    if (goalsA === goalsB) {
      penalties = simulatePenalties(teamA, teamB)
    }
  }

  const events = generateMatchEvents(teamA, teamB, goalsA, goalsB, extraTime)

  let winner = null
  if (penalties) winner = penalties.winner
  else if (goalsA > goalsB) winner = teamA.name
  else if (goalsB > goalsA) winner = teamB.name

  return {
    home: teamA.name,
    away: teamB.name,
    goalsA,
    goalsB,
    extraTime,
    penalties,
    events,
    winner,
    strengths: { home: strA, away: strB },
  }
}

// ---------------------------------------------------------------------------
// Sorteio do grupo (7)
// ---------------------------------------------------------------------------

export function pickGroup() {
  const entries = Object.entries(groupsData)
  const weights = entries.map(([, group]) => 1 / group.avg_strength)
  const total = weights.reduce((sum, w) => sum + w, 0)

  let r = Math.random() * total
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i]
    if (r <= 0) return entries[i][0]
  }
  return entries[entries.length - 1][0]
}

export function getGroup(groupId) {
  return groupsData[groupId]
}

export function getGroupOpponents(groupId) {
  const group = groupsData[groupId]
  return group.teams.filter((team) => team !== group.weakest)
}

// ---------------------------------------------------------------------------
// Fase de grupos (10)
// ---------------------------------------------------------------------------

const ROUND_ROBIN_SCHEDULE = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
]

function updateStandings(standings, teamA, teamB, result) {
  const a = standings[teamA.name]
  const b = standings[teamB.name]

  a.played++
  b.played++
  a.gf += result.goalsA
  a.ga += result.goalsB
  b.gf += result.goalsB
  b.ga += result.goalsA

  if (result.goalsA > result.goalsB) {
    a.points += 3
    a.wins++
    b.losses++
  } else if (result.goalsA < result.goalsB) {
    b.points += 3
    b.wins++
    a.losses++
  } else {
    a.points++
    b.points++
    a.draws++
    b.draws++
  }
}

function sortStandings(standings, matches) {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points

    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA

    if (b.gf !== a.gf) return b.gf - a.gf

    const h2h = matches.find(
      (m) =>
        (m.home === a.team.name && m.away === b.team.name) ||
        (m.home === b.team.name && m.away === a.team.name)
    )
    if (h2h) {
      const aIsHome = h2h.home === a.team.name
      const aGoals = aIsHome ? h2h.goalsA : h2h.goalsB
      const bGoals = aIsHome ? h2h.goalsB : h2h.goalsA
      if (aGoals !== bGoals) return bGoals - aGoals
    }

    return 0
  })
}

function simulateRoundRobin(teams) {
  const standings = {}
  teams.forEach((team) => {
    standings[team.name] = { team, points: 0, gf: 0, ga: 0, played: 0, wins: 0, draws: 0, losses: 0 }
  })

  const matches = []
  ROUND_ROBIN_SCHEDULE.forEach((pairs) => {
    pairs.forEach(([i, j]) => {
      const result = simulateMatch(teams[i], teams[j], { knockout: false })
      updateStandings(standings, teams[i], teams[j], result)
      matches.push(result)
    })
  })

  const table = sortStandings(Object.values(standings), matches)
  return { table, matches }
}

/**
 * Simula a fase de grupos do grupo do usuário.
 * O time do usuário substitui a seleção mais fraca do grupo.
 */
export function simulateGroupStage(groupId, userTeam) {
  const opponents = getGroupOpponents(groupId).map((name) => buildNationalTeam(name))
  const teams = [userTeam, ...opponents]
  const { table, matches } = simulateRoundRobin(teams)
  return { table, matches, teams }
}

// ---------------------------------------------------------------------------
// Mata-mata (11)
// ---------------------------------------------------------------------------

function pickBestThirds(thirds) {
  return [...thirds]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const gdA = a.gf - a.ga
      const gdB = b.gf - b.ga
      if (gdB !== gdA) return gdB - gdA
      return b.gf - a.gf
    })
    .slice(0, 8)
}

function assignThirdPlaceSlots(pool, bestThirds) {
  const slotCodes = new Set()
  Object.values(bracketData.round_of_32).forEach((match) => {
    ;[match.home, match.away].forEach((code) => {
      if (code.startsWith('3_')) slotCodes.add(code)
    })
  })

  const slots = [...slotCodes]
    .map((code) => ({ code, groups: code.slice(2).split('') }))
    .sort((a, b) => a.groups.length - b.groups.length)

  const remaining = [...bestThirds]
  slots.forEach((slot) => {
    let idx = remaining.findIndex((t) => slot.groups.includes(t.group))
    if (idx === -1) idx = 0
    if (remaining.length) {
      pool[slot.code] = remaining[idx].team
      remaining.splice(idx, 1)
    }
  })
}

function resolveTeam(pool, code) {
  return pool[code]
}

function simulateKnockoutBracket(pool) {
  const results = {}
  const rounds = ['round_of_32', 'round_of_16', 'quarterfinals', 'semifinals']

  rounds.forEach((roundName) => {
    Object.entries(bracketData[roundName]).forEach(([matchId, match]) => {
      const home = resolveTeam(pool, match.home)
      const away = resolveTeam(pool, match.away)
      const result = simulateMatch(home, away, { knockout: true })
      results[matchId] = { ...result, home, away, round: roundName }

      const winner = result.winner === home.name ? home : away
      const loser = result.winner === home.name ? away : home
      pool[`W_${matchId}`] = winner
      pool[`L_${matchId}`] = loser
    })
  })

  const finalHome = resolveTeam(pool, bracketData.final.home)
  const finalAway = resolveTeam(pool, bracketData.final.away)
  const finalResult = simulateMatch(finalHome, finalAway, { knockout: true })
  results.final = { ...finalResult, home: finalHome, away: finalAway, round: 'final' }

  const tpHome = resolveTeam(pool, bracketData.third_place.home)
  const tpAway = resolveTeam(pool, bracketData.third_place.away)
  const tpResult = simulateMatch(tpHome, tpAway, { knockout: true })
  results.third_place = { ...tpResult, home: tpHome, away: tpAway, round: 'third_place' }

  const champion = finalResult.winner === finalHome.name ? finalHome : finalAway

  return { results, champion }
}

/**
 * Simula a Copa do Mundo completa: 12 grupos (o do usuário com seu time
 * substituindo a seleção mais fraca, os demais com seleções reais) e o
 * mata-mata até a final, seguindo o chaveamento oficial em bracket.json.
 */
export function simulateFullTournament(userTeam, userGroupId) {
  const allTables = {}
  const allMatches = {}
  let userGroupStage = null

  Object.entries(groupsData).forEach(([groupId, group]) => {
    let teams
    if (groupId === userGroupId) {
      teams = [userTeam, ...getGroupOpponents(groupId).map((name) => buildNationalTeam(name))]
    } else {
      teams = group.teams.map((name) => buildNationalTeam(name))
    }

    const { table, matches } = simulateRoundRobin(teams)
    allTables[groupId] = table
    allMatches[groupId] = matches
    if (groupId === userGroupId) userGroupStage = { table, matches, teams }
  })

  const thirds = Object.entries(allTables).map(([groupId, table]) => ({ ...table[2], group: groupId }))
  const bestThirds = pickBestThirds(thirds)

  const pool = {}
  Object.entries(allTables).forEach(([groupId, table]) => {
    pool[`1${groupId}`] = table[0].team
    pool[`2${groupId}`] = table[1].team
  })
  assignThirdPlaceSlots(pool, bestThirds)

  const knockout = simulateKnockoutBracket(pool)

  return {
    userGroupId,
    groupStage: userGroupStage,
    allTables,
    allMatches,
    qualifiers: { bestThirds },
    knockout,
    champion: knockout.champion,
  }
}

/**
 * Resume a campanha do time do usuário a partir do resultado de
 * simulateFullTournament: jogos disputados, fase alcançada e se foi campeão.
 */
export function getUserCampaign(tournament, userTeam) {
  const matches = tournament.groupStage.matches
    .filter((m) => m.home === userTeam.name || m.away === userTeam.name)
    .map((m) => ({ ...m, stage: 'group_stage' }))

  const qualified =
    tournament.groupStage.table.slice(0, 2).some((s) => s.team.name === userTeam.name) ||
    tournament.qualifiers.bestThirds.some((t) => t.team.name === userTeam.name)

  if (!qualified) {
    return { matches, stageReached: 'group_stage', eliminated: true, champion: false }
  }

  let stageReached = 'group_stage'
  let eliminated = false
  let champion = false

  const stageOrder = ['round_of_32', 'round_of_16', 'quarterfinals', 'semifinals', 'final']
  for (const round of stageOrder) {
    const entry = Object.values(tournament.knockout.results).find(
      (r) => r.round === round && (r.home.name === userTeam.name || r.away.name === userTeam.name)
    )
    if (!entry) break

    matches.push({ ...entry, stage: round })
    stageReached = round

    if (entry.winner !== userTeam.name) {
      eliminated = true
      break
    }
    if (round === 'final') champion = true
  }

  return { matches, stageReached, eliminated, champion }
}

// ---------------------------------------------------------------------------
// Fatores adicionais do Modo Clássico (9.8)
// ---------------------------------------------------------------------------

/** Bônus de "frescor" para o reserva que entra no lugar de um titular em queda de forma. */
export function applyFreshnessBonus(player) {
  return { ...player, ovr: Math.min(99, player.ovr + 2) }
}

/** Penalidade por fadiga nas fases finais para quem jogou todas as partidas sem ser substituído. */
export function applyFatigue(player) {
  return { ...player, ovr: Math.max(30, player.ovr - 1) }
}
