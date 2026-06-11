import { useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import MatchPlay from '../components/MatchPlay'
import Flag from '../components/Flag'
import { USER_TEAM_NAME } from '../engine/cup'

const TABLE_COLS = ['th_pts', 'th_played', 'th_wins', 'th_draws', 'th_losses', 'th_gd', 'th_gf']

export default function GroupStageScreen({ groupId, matches, table, qualified, mode, userFormation, onComplete }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'

  const [idx, setIdx] = useState(0)
  const [view, setView] = useState('match') // match | table

  if (view === 'match') {
    const isLast = idx === matches.length - 1
    return (
      <div className="flex flex-col h-screen w-full px-4 py-3">
        <MatchPlay
          key={idx}
          match={matches[idx]}
          mode={mode}
          userFormation={userFormation}
          stageLabel={`${t('stage_group')} · ${t('round_label').replace('{n}', idx + 1)}`}
          continueLabel={isLast ? t('btn_view_table') : t('btn_next_match')}
          onContinue={() => (isLast ? setView('table') : setIdx(idx + 1))}
        />
      </div>
    )
  }

  const rankColor = (rank) => {
    if (rank <= 2) return 'var(--color-ok)'
    if (rank === 3) return 'var(--color-warn)'
    return 'var(--color-danger)'
  }

  return (
    <div className="flex flex-col h-screen w-full px-4 py-3">
      <h1 className={`text-center text-lg font-bold mb-4 ${isRetro ? 'uppercase' : ''}`}>
        {t('group_label')} {groupId}
      </h1>

      {/* Cabeçalho da tabela */}
      <div className="flex items-center gap-1 px-2 mb-1">
        <span className="w-4" />
        <span className="w-5" />
        <span className="flex-1" />
        {TABLE_COLS.map((key) => (
          <span
            key={key}
            className="w-6 text-center text-[10px] font-bold"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t(key)}
          </span>
        ))}
      </div>

      {/* Linhas */}
      <div className="flex flex-col gap-1.5 mb-4">
        {table.map((row, i) => {
          const isUser = row.team.name === USER_TEAM_NAME
          const cells = [
            row.points,
            row.played,
            row.wins,
            row.draws,
            row.losses,
            row.gf - row.ga,
            row.gf,
          ]
          return (
            <div
              key={row.team.name}
              className="flex items-center gap-1 p-2 border-2 animate-slide-in"
              style={{
                animationDelay: `${i * 100}ms`,
                borderColor: isUser ? 'var(--color-btn-primary-border)' : 'var(--color-border)',
                background: isUser ? 'var(--color-btn-primary-bg)' : 'transparent',
                borderRadius: 'var(--radius)',
              }}
            >
              <span className="w-4 text-xs font-bold" style={{ color: rankColor(i + 1) }}>
                {i + 1}
              </span>
              {isUser ? (
                <span className="w-5 text-sm leading-none">🏳️</span>
              ) : (
                <Flag team={row.team.name} width={20} />
              )}
              <span
                className={`flex-1 text-xs font-bold truncate ${isRetro ? 'uppercase' : ''}`}
                style={{ color: isUser ? 'var(--color-btn-primary-text)' : 'var(--color-text)' }}
              >
                {isUser ? t('your_team') : row.team.name}
              </span>
              {cells.map((v, c) => (
                <span
                  key={c}
                  className={`w-6 text-center text-[11px] tabular-nums ${c === 0 ? 'font-bold' : ''}`}
                  style={{
                    color: isUser
                      ? 'var(--color-btn-primary-text)'
                      : c === 0
                        ? 'var(--color-text)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          )
        })}
      </div>

      {/* Status */}
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

      <div className="flex-1" />

      <button
        type="button"
        onClick={onComplete}
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
    </div>
  )
}
