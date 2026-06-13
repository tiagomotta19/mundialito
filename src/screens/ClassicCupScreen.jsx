import { useRef, useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import { createClassicGame } from '../engine/classic'
import MatchPlay from '../components/MatchPlay'
import GroupTable from '../components/GroupTable'
import DeskHeader from '../components/DeskHeader'
import BetweenGamesScreen from './BetweenGamesScreen'
import ResultScreen from './ResultScreen'
import { useMediaQuery, DESK_QUERY } from '../components/useMediaQuery'

/**
 * Orquestra a copa do Modo Clássico de forma incremental: antes de cada jogo do
 * usuário entra a tela de gestão do elenco (BetweenGamesScreen); o motor roda
 * com o time confirmado e a partida é animada (MatchPlay). O estado do torneio
 * vive no controlador de engine/classic.js (mantido num ref).
 */
export default function ClassicCupScreen({ gameConfig, onFinish }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'
  const isDesk = useMediaQuery(DESK_QUERY)

  const gameRef = useRef(null)
  if (!gameRef.current) gameRef.current = createClassicGame(gameConfig)
  const game = gameRef.current

  const [view, setView] = useState('between') // between | match | groupTable | result
  const [info, setInfo] = useState(() => game.matchInfo())
  const [played, setPlayed] = useState(null) // resultado do último jogo + rótulos
  const [step, setStep] = useState(0) // chave de remontagem do MatchPlay

  const matchStageLabel = (i) =>
    i.isKnockout
      ? t(i.stageKey)
      : `${t('stage_group')} · ${t('round_label').replace('{n}', i.matchday)}`

  const handlePlay = (swaps) => {
    const label = matchStageLabel(info)
    const res = game.play(swaps)
    setPlayed({ ...res, stageLabel: label })
    setStep((s) => s + 1)
    setView('match')
  }

  const goToNextMatch = () => {
    setInfo(game.matchInfo())
    setView('between')
  }

  const handleMatchContinue = () => {
    if (!played.isKnockout) {
      setView(played.groupDone ? 'groupTable' : 'between')
      if (!played.groupDone) goToNextMatch()
      return
    }
    if (played.finished) {
      setView('result')
      return
    }
    goToNextMatch()
  }

  const handleGroupTableContinue = () => {
    if (game.isQualified()) {
      goToNextMatch()
    } else {
      setView('result')
    }
  }

  // -------------------------------------------------------------------------
  // Entre os jogos
  // -------------------------------------------------------------------------
  if (view === 'between') {
    return <BetweenGamesScreen info={info} teamName={gameConfig.teamName} onPlay={handlePlay} />
  }

  // -------------------------------------------------------------------------
  // Partida
  // -------------------------------------------------------------------------
  if (view === 'match') {
    const continueLabel = !played.isKnockout
      ? played.groupDone
        ? t('btn_view_table')
        : t('btn_next_match')
      : played.finished
        ? t('btn_view_result')
        : t('btn_continue')

    const matchEl = (
      <MatchPlay
        key={step}
        match={played.match}
        mode="classic"
        userFormation={gameConfig.formation}
        teamName={gameConfig.teamName}
        stageLabel={played.stageLabel}
        continueLabel={continueLabel}
        onContinue={handleMatchContinue}
      />
    )
    if (isDesk) return matchEl
    return <div className="flex flex-col h-dvh w-full px-4 py-3">{matchEl}</div>
  }

  // -------------------------------------------------------------------------
  // Tabela final do grupo
  // -------------------------------------------------------------------------
  if (view === 'groupTable') {
    const table = game.getGroupTable()
    const qualified = game.isQualified()

    const banner = (
      <p
        className={`text-center text-sm font-bold px-3 py-2 border-2 animate-rise-in ${isRetro ? 'uppercase' : ''}`}
        style={{
          animationDelay: '400ms',
          color: qualified ? 'var(--color-ok)' : 'var(--color-danger)',
          borderColor: qualified ? 'var(--color-ok)' : 'var(--color-danger)',
          borderRadius: 'var(--radius)',
        }}
      >
        {qualified ? `✅ ${t('qualified_msg')}` : `❌ ${t('eliminated_group_msg')}`}
      </p>
    )

    const button = (
      <button
        type="button"
        onClick={handleGroupTableContinue}
        className={`w-full py-3 font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
        style={{
          background: 'var(--color-btn-primary-bg)',
          color: 'var(--color-btn-primary-text)',
          borderColor: 'var(--color-btn-primary-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        {qualified ? t('btn_continue') : t('btn_view_result')} →
      </button>
    )

    if (isDesk) {
      return (
        <div className="min-h-dvh w-full flex flex-col">
          <DeskHeader
            right={
              <span
                className={`text-xs font-bold px-2.5 py-1 border-2 ${isRetro ? 'uppercase' : ''}`}
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {t('stage_group')}
              </span>
            }
          />
          <div className="flex-1 w-full max-w-[640px] mx-auto px-8 py-12 flex flex-col justify-center gap-6">
            <h1 className={`text-4xl font-black text-center ${isRetro ? 'uppercase' : ''}`}>
              {t('group_label')} {game.getGroupId()}
            </h1>
            <GroupTable table={table} teamName={gameConfig.teamName} />
            {banner}
            {button}
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-dvh w-full px-4 py-3">
        <div className="flex-1 flex flex-col justify-center gap-4">
          <h1 className={`text-center text-2xl font-black ${isRetro ? 'uppercase' : ''}`}>
            {t('group_label')} {game.getGroupId()}
          </h1>
          <GroupTable table={table} teamName={gameConfig.teamName} />
          {banner}
        </div>
        {button}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Resultado final
  // -------------------------------------------------------------------------
  return (
    <ResultScreen
      campaign={game.getCampaign()}
      players={game.getLineupPlayers()}
      formation={gameConfig.formation}
      teamName={gameConfig.teamName}
      groupId={game.getGroupId()}
      groupTable={game.getGroupTable()}
      onPlayAgain={onFinish}
    />
  )
}
