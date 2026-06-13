// Helpers da copa do usuário: monta o time, roda o torneio uma única vez e
// normaliza os dados do motor para as telas (não altera simulator.js).
import { simulateFullTournament, getUserCampaign } from './simulator'

// Nome interno fixo do time do usuário. As comparações do motor são por nome,
// então NÃO pode depender do idioma — a UI traduz na exibição (t('your_team')).
export const USER_TEAM_NAME = '__user__'

export function buildUserTeam(gameConfig) {
  return {
    name: USER_TEAM_NAME,
    players: gameConfig.players,
    formation: gameConfig.formation,
    isUser: true,
  }
}

// No motor, os jogos da fase de grupos têm home/away como strings e os do
// mata-mata como objetos de time — normaliza tudo para nomes.
// Convenção de exibição: o time do usuário fica SEMPRE à esquerda (home) em
// todos os placares, independente do mando sorteado pelo motor — se o usuário
// for o visitante, o jogo inteiro é espelhado (nomes, gols, lados dos eventos
// e pênaltis).
export function normalizeMatch(m) {
  const homeName = typeof m.home === 'string' ? m.home : m.home.name
  const awayName = typeof m.away === 'string' ? m.away : m.away.name
  const flip = awayName === USER_TEAM_NAME

  return {
    stage: m.stage,
    homeName: flip ? awayName : homeName,
    awayName: flip ? homeName : awayName,
    goalsA: flip ? m.goalsB : m.goalsA,
    goalsB: flip ? m.goalsA : m.goalsB,
    extraTime: m.extraTime,
    penalties:
      m.penalties && flip
        ? {
            ...m.penalties,
            scoreA: m.penalties.scoreB,
            scoreB: m.penalties.scoreA,
            rounds: m.penalties.rounds.map((r) => ({ a: r.b, b: r.a })),
          }
        : m.penalties,
    events: flip
      ? m.events.map((e) => ({ ...e, side: e.side === 'home' ? 'away' : 'home' }))
      : m.events,
    winner: m.winner,
  }
}

export function runTournament(gameConfig) {
  const userTeam = buildUserTeam(gameConfig)
  const tournament = simulateFullTournament(userTeam, gameConfig.groupId)
  const campaign = getUserCampaign(tournament, userTeam)
  return {
    userTeam,
    tournament,
    campaign: { ...campaign, matches: campaign.matches.map(normalizeMatch) },
  }
}

export function campaignStats(matches, userTeamName = USER_TEAM_NAME) {
  const stats = { played: matches.length, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }
  matches.forEach((m) => {
    const userIsHome = m.homeName === userTeamName
    stats.gf += userIsHome ? m.goalsA : m.goalsB
    stats.ga += userIsHome ? m.goalsB : m.goalsA
    if (!m.winner) stats.draws++
    else if (m.winner === userTeamName) stats.wins++
    else stats.losses++
  })
  return stats
}

export const stageLabelKey = (stage) => (stage === 'group_stage' ? 'stage_group' : `stage_${stage}`)
