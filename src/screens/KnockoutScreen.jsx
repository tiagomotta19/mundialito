import { useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import MatchPlay from '../components/MatchPlay'
import Flag from '../components/Flag'
import { getTeamStrength } from '../engine/simulator'
import { USER_TEAM_NAME, stageLabelKey } from '../engine/cup'

export default function KnockoutScreen({ matches, mode, userFormation, teamName, onComplete }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'

  const [idx, setIdx] = useState(0)
  const [view, setView] = useState('preview') // preview | match

  const match = matches[idx]
  const opponent = match.homeName === USER_TEAM_NAME ? match.awayName : match.homeName
  const userWon = match.winner === USER_TEAM_NAME
  const isFinal = match.stage === 'final'
  const stageTitle = t(stageLabelKey(match.stage))

  if (view === 'preview') {
    return (
      <div className="flex flex-col h-screen w-full px-4 py-3">
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <span
            className={`text-xl font-bold px-4 py-2 border-2 animate-reveal-pop ${isRetro ? 'uppercase' : ''}`}
            style={{
              color: 'var(--color-accent)',
              borderColor: 'var(--color-accent)',
              borderRadius: 'var(--radius)',
            }}
          >
            {stageTitle}
          </span>

          <div className="w-full flex items-center justify-center gap-3">
            <div
              className="flex-1 flex flex-col items-center gap-2 p-3 border-2 animate-slide-in"
              style={{
                borderColor: 'var(--color-btn-primary-border)',
                background: 'var(--color-btn-primary-bg)',
                borderRadius: 'var(--radius)',
              }}
            >
              <span className="text-3xl leading-none">🏳️</span>
              <span
                className={`text-sm font-bold text-center ${isRetro ? 'uppercase' : ''}`}
                style={{ color: 'var(--color-btn-primary-text)' }}
              >
                {teamName || t('your_team')}
              </span>
            </div>

            <span className="text-lg font-bold shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              {t('vs')}
            </span>

            <div
              className="flex-1 flex flex-col items-center gap-2 p-3 border-2 animate-slide-in"
              style={{
                animationDelay: '150ms',
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius)',
              }}
            >
              <Flag team={opponent} width={36} />
              <span className={`text-sm font-bold text-center ${isRetro ? 'uppercase' : ''}`}>{opponent}</span>
              <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                {getTeamStrength(opponent)}
              </span>
            </div>
          </div>
        </div>

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
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-full px-4 py-3">
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
    </div>
  )
}
