import { useState } from 'react'
import { runTournament } from '../engine/cup'
import GroupStageScreen from './GroupStageScreen'
import KnockoutScreen from './KnockoutScreen'
import ResultScreen from './ResultScreen'

/**
 * Orquestrador da copa: simula o torneio completo UMA vez ao montar
 * (o resultado já existe — as animações são encenação) e percorre as fases.
 */
export default function CupScreen({ gameConfig, onFinish }) {
  const [game] = useState(() => runTournament(gameConfig))
  const [phase, setPhase] = useState('groups') // groups | knockout | result

  const { tournament, campaign } = game
  const groupMatches = campaign.matches.filter((m) => m.stage === 'group_stage')
  const knockoutMatches = campaign.matches.filter((m) => m.stage !== 'group_stage')
  const qualified = knockoutMatches.length > 0

  if (phase === 'groups') {
    return (
      <GroupStageScreen
        groupId={gameConfig.groupId}
        matches={groupMatches}
        table={tournament.groupStage.table}
        qualified={qualified}
        mode={gameConfig.mode}
        userFormation={gameConfig.formation}
        onComplete={() => setPhase(qualified ? 'knockout' : 'result')}
      />
    )
  }

  if (phase === 'knockout') {
    return (
      <KnockoutScreen
        matches={knockoutMatches}
        mode={gameConfig.mode}
        userFormation={gameConfig.formation}
        onComplete={() => setPhase('result')}
      />
    )
  }

  return (
    <ResultScreen
      campaign={campaign}
      players={gameConfig.players}
      formation={gameConfig.formation}
      onPlayAgain={onFinish}
    />
  )
}
