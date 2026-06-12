import { useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import MatchPlay from '../components/MatchPlay'
import Flag from '../components/Flag'
import DeskHeader from '../components/DeskHeader'
import { useMediaQuery, DESK_QUERY } from '../components/useMediaQuery'
import { getTeamStrength } from '../engine/simulator'
import { USER_TEAM_NAME, stageLabelKey } from '../engine/cup'

export default function KnockoutScreen({ matches, mode, userFormation, teamName, onComplete }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'
  const isDesk = useMediaQuery(DESK_QUERY)

  const [idx, setIdx] = useState(0)
  const [view, setView] = useState('preview') // preview | match

  const match = matches[idx]
  const opponent = match.homeName === USER_TEAM_NAME ? match.awayName : match.homeName
  const userWon = match.winner === USER_TEAM_NAME
  const isFinal = match.stage === 'final'
  const stageTitle = t(stageLabelKey(match.stage))

  if (view === 'preview') {
    const playButton = (
      <button
        type="button"
        onClick={() => setView('match')}
        className={`w-full py-3 font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
        style={{
          background: 'var(--color-btn-primary-bg)',
          color: 'var(--color-btn-primary-text)',
          borderColor: 'var(--color-btn-primary-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        {t('btn_play_match')} →
      </button>
    )

    // -----------------------------------------------------------------------
    // Desktop: confronto centralizado em escala maior, sob o cabeçalho
    // editorial com o chip da fase
    // -----------------------------------------------------------------------
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
                {stageTitle}
              </span>
            }
          />

          <div className="flex-1 w-full max-w-[760px] mx-auto px-8 py-12 flex flex-col items-center justify-center gap-10">
            <span
              className={`text-3xl font-black px-6 py-3 border-2 animate-reveal-pop ${isRetro ? 'uppercase' : ''}`}
              style={{
                color: 'var(--color-accent)',
                borderColor: 'var(--color-accent)',
                borderRadius: 'var(--radius)',
              }}
            >
              {stageTitle}
            </span>

            <div className="w-full flex items-stretch justify-center gap-6">
              <div
                className="flex-1 flex flex-col items-center justify-center gap-3 p-8 border-2 animate-slide-in"
                style={{
                  borderColor: 'var(--color-btn-primary-border)',
                  background: 'var(--color-btn-primary-bg)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <span className="text-6xl leading-none">🏳️</span>
                <span
                  className={`text-xl font-black text-center ${isRetro ? 'uppercase' : ''}`}
                  style={{ color: 'var(--color-btn-primary-text)' }}
                >
                  {teamName || t('your_team')}
                </span>
              </div>

              <span
                className="self-center text-2xl font-black shrink-0"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t('vs')}
              </span>

              <div
                className="flex-1 flex flex-col items-center justify-center gap-3 p-8 border-2 animate-slide-in"
                style={{
                  animationDelay: '150ms',
                  borderColor: 'var(--color-border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <Flag team={opponent} width={64} />
                <span className={`text-xl font-black text-center ${isRetro ? 'uppercase' : ''}`}>
                  {opponent}
                </span>
                <span className="text-base font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                  {getTeamStrength(opponent)}
                </span>
              </div>
            </div>

            <div className="w-full max-w-[420px]">{playButton}</div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-dvh w-full px-4 py-3">
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <span
            className={`text-2xl font-black px-5 py-2.5 border-2 animate-reveal-pop ${isRetro ? 'uppercase' : ''}`}
            style={{
              color: 'var(--color-accent)',
              borderColor: 'var(--color-accent)',
              borderRadius: 'var(--radius)',
            }}
          >
            {stageTitle}
          </span>

          <div className="w-full flex items-stretch justify-center gap-3">
            <div
              className="flex-1 flex flex-col items-center justify-center gap-3 px-3 py-6 border-2 animate-slide-in"
              style={{
                borderColor: 'var(--color-btn-primary-border)',
                background: 'var(--color-btn-primary-bg)',
                borderRadius: 'var(--radius)',
              }}
            >
              <span className="text-5xl leading-none">🏳️</span>
              <span
                className={`text-base font-black text-center ${isRetro ? 'uppercase' : ''}`}
                style={{ color: 'var(--color-btn-primary-text)' }}
              >
                {teamName || t('your_team')}
              </span>
            </div>

            <span className="self-center text-lg font-bold shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              {t('vs')}
            </span>

            <div
              className="flex-1 flex flex-col items-center justify-center gap-3 px-3 py-6 border-2 animate-slide-in"
              style={{
                animationDelay: '150ms',
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius)',
              }}
            >
              <Flag team={opponent} width={56} />
              <span className={`text-base font-black text-center ${isRetro ? 'uppercase' : ''}`}>{opponent}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                {getTeamStrength(opponent)}
              </span>
            </div>
          </div>
        </div>

        {playButton}
      </div>
    )
  }

  const matchEl = (
    <MatchPlay
      key={idx}
      match={match}
      mode={mode}
      userFormation={userFormation}
      teamName={teamName}
      stageLabel={stageTitle}
      continueLabel={!userWon || isFinal ? t('btn_view_result') : t('btn_continue')}
      onContinue={() => {
        if (!userWon || isFinal) {
          onComplete()
        } else {
          setIdx(idx + 1)
          setView('preview')
        }
      }}
    />
  )
  // No desktop o MatchPlay traz o próprio cabeçalho e ocupa a tela toda
  if (isDesk) return matchEl
  return <div className="flex flex-col h-dvh w-full px-4 py-3">{matchEl}</div>
}
