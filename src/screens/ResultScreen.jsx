import { useMemo } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import FieldPitch from '../components/FieldPitch'
import Flag from '../components/Flag'
import GroupTable from '../components/GroupTable'
import { FORMATION_LAYOUTS } from '../components/formationLayouts'
import { USER_TEAM_NAME, campaignStats, stageLabelKey } from '../engine/cup'

const CONFETTI_COLORS = [
  'var(--color-accent)',
  'var(--color-player-user)',
  'var(--color-ok)',
  'var(--color-warn)',
  'var(--color-danger)',
]

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 2.5 + Math.random() * 2,
        drift: (Math.random() * 2 - 1) * 60,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + Math.random() * 5,
      })),
    []
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${p.left}%`,
            top: -14,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--confetti-drift': `${p.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

export default function ResultScreen({ campaign, players, formation, teamName, groupId, groupTable, onPlayAgain }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'

  const champion = campaign.champion
  const runnerUp = !champion && campaign.stageReached === 'final'
  const stats = campaignStats(campaign.matches)
  // Eliminação na fase de grupos mostra a TABELA FINAL do grupo (o placar do
  // último jogo confunde — pode ter sido vitória); no mata-mata, o placar.
  const groupStageExit = campaign.stageReached === 'group_stage'
  const lastMatch = groupStageExit ? null : campaign.matches[campaign.matches.length - 1]

  const layout = FORMATION_LAYOUTS[formation] || FORMATION_LAYOUTS['4-3-3']
  const slots = layout.map((slot, i) => ({ ...slot, player: players[i] }))

  const label = (name) => (name === USER_TEAM_NAME ? teamName || t('your_team') : name)

  const statCards = [
    { key: 'stat_matches', value: stats.played },
    { key: 'stat_wins', value: stats.wins },
    { key: 'stat_draws', value: stats.draws },
    { key: 'stat_losses', value: stats.losses },
    { key: 'stat_gf', value: stats.gf },
    { key: 'stat_ga', value: stats.ga },
  ]

  return (
    <div className="relative flex flex-col h-screen w-full px-4 py-3 gap-3 overflow-y-auto">
      {champion && <Confetti />}

      {/* Título */}
      <div className="flex flex-col items-center gap-1 mt-2">
        <span className="text-5xl leading-none animate-reveal-pop">
          {champion ? '🏆' : runnerUp ? '🥈' : '⚽'}
        </span>
        <h1
          className={`text-2xl font-bold text-center animate-rise-in ${isRetro ? 'uppercase' : ''}`}
          style={{ color: champion ? 'var(--color-accent)' : 'var(--color-text)' }}
        >
          {champion ? t('result_champion') : runnerUp ? t('result_runner_up') : t('result_eliminated')}
        </h1>
        <span
          className={`text-xs font-bold px-2 py-1 border-2 animate-rise-in ${isRetro ? 'uppercase' : ''}`}
          style={{
            animationDelay: '150ms',
            color: champion ? 'var(--color-ok)' : 'var(--color-danger)',
            borderColor: champion ? 'var(--color-ok)' : 'var(--color-danger)',
            borderRadius: 'var(--radius)',
          }}
        >
          {t(stageLabelKey(campaign.stageReached))}
        </span>
      </div>

      {/* Eliminado em grupos: tabela final do grupo */}
      {groupStageExit && groupTable && (
        <div className="animate-rise-in" style={{ animationDelay: '250ms' }}>
          <p
            className={`text-center text-xs font-bold mb-1 ${isRetro ? 'uppercase' : ''}`}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('group_label')} {groupId}
          </p>
          <GroupTable table={groupTable} teamName={teamName} />
        </div>
      )}

      {/* Placar do último jogo (mata-mata) */}
      {lastMatch && (
        <div
          className="flex items-center justify-between gap-2 p-3 border-2 animate-rise-in"
          style={{ animationDelay: '250ms', borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
        >
          <span className={`flex-1 flex items-center gap-1.5 text-xs font-bold truncate ${isRetro ? 'uppercase' : ''}`}>
            {lastMatch.homeName === USER_TEAM_NAME ? (
              <span className="text-base leading-none">🏳️</span>
            ) : (
              <Flag team={lastMatch.homeName} width={20} />
            )}
            <span className="truncate">{label(lastMatch.homeName)}</span>
          </span>
          <span className="shrink-0 flex flex-col items-center">
            <span className="text-xl font-bold tabular-nums">
              {lastMatch.goalsA} <span style={{ color: 'var(--color-text-muted)' }}>×</span> {lastMatch.goalsB}
            </span>
            {lastMatch.penalties && (
              <span className="text-[10px] font-bold" style={{ color: 'var(--color-accent)' }}>
                {t('score_pens')
                  .replace('{a}', lastMatch.penalties.scoreA)
                  .replace('{b}', lastMatch.penalties.scoreB)}
              </span>
            )}
          </span>
          <span
            className={`flex-1 flex items-center justify-end gap-1.5 text-xs font-bold truncate ${isRetro ? 'uppercase' : ''}`}
          >
            <span className="truncate">{label(lastMatch.awayName)}</span>
            {lastMatch.awayName === USER_TEAM_NAME ? (
              <span className="text-base leading-none">🏳️</span>
            ) : (
              <Flag team={lastMatch.awayName} width={20} />
            )}
          </span>
        </div>
      )}

      {/* Time no campinho — versão ampliada, sangrando parte do padding lateral */}
      <div className="-mx-2">
        <FieldPitch slots={slots} large />
      </div>

      {/* Estatísticas da campanha */}
      <h2 className={`text-sm font-bold mt-1 ${isRetro ? 'uppercase' : ''}`}>{t('campaign_title')}</h2>
      <div className="grid grid-cols-3 gap-2">
        {statCards.map((stat, i) => (
          <div
            key={stat.key}
            className="flex flex-col items-center justify-center py-2 border-2 animate-rise-in"
            style={{
              animationDelay: `${300 + i * 80}ms`,
              borderColor: 'var(--color-border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <span className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>
              {stat.value}
            </span>
            <span
              className={`text-[10px] text-center ${isRetro ? 'uppercase' : ''}`}
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t(stat.key)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onPlayAgain}
        className={`w-full py-3 font-bold border-2 shrink-0 ${isRetro ? 'uppercase' : ''}`}
        style={{
          background: 'var(--color-btn-primary-bg)',
          color: 'var(--color-btn-primary-text)',
          borderColor: 'var(--color-btn-primary-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        {t('btn_play_again')}
      </button>
    </div>
  )
}
