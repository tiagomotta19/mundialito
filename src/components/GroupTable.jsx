import { useTheme } from './ThemeContext'
import { useLang } from '../i18n/LangContext'
import Flag from './Flag'
import { USER_TEAM_NAME } from '../engine/cup'

const TABLE_COLS = ['th_pts', 'th_played', 'th_wins', 'th_draws', 'th_losses', 'th_gd', 'th_gf']

/** Tabela de classificação do grupo com a linha do usuário destacada. */
export default function GroupTable({ table, teamName }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'

  const rankColor = (rank) => {
    if (rank <= 2) return 'var(--color-ok)'
    if (rank === 3) return 'var(--color-warn)'
    return 'var(--color-danger)'
  }

  return (
    <div>
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
      <div className="flex flex-col gap-1.5">
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
                {isUser ? teamName || t('your_team') : row.team.name}
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
    </div>
  )
}
