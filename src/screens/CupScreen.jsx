import { useState } from 'react'
import { runTournament } from '../engine/cup'
import GroupStageScreen from './GroupStageScreen'
import KnockoutScreen from './KnockoutScreen'
import ResultScreen from './ResultScreen'
import ClassicCupScreen from './ClassicCupScreen'

/**
 * Orquestrador da copa. No Modo Rápido a copa inteira é simulada UMA vez ao
 * montar (as animações encenam o resultado pronto). No Modo Clássico a copa é
 * jogada incrementalmente — os jogos do usuário dependem do elenco de cada
 * partida — então delega para a ClassicCupScreen.
 */
export default function CupScreen({ gameConfig, onFinish }) {
  if (gameConfig.mode === 'classic') {
    return <ClassicCupScreen gameConfig={gameConfig} onFinish={onFinish} />
  }
  return <FastCupScreen gameConfig={gameConfig} onFinish={onFinish} />
}

function FastCupScreen({ gameConfig, onFinish }) {
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
        teamName={gameConfig.teamName}
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
        teamName={gameConfig.teamName}
        onComplete={() => setPhase('result')}
      />
    )
  }

  return (
    <ResultScreen
      campaign={campaign}
      players={gameConfig.players}
      formation={gameConfig.formation}
      teamName={gameConfig.teamName}
      mode={gameConfig.mode}
      groupId={gameConfig.groupId}
      groupTable={tournament.groupStage.table}
      onPlayAgain={onFinish}
    />
  )
}
