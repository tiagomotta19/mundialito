import { useMemo, useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import FieldPitch from '../components/FieldPitch'
import Flag from '../components/Flag'
import GroupTable from '../components/GroupTable'
import DeskHeader from '../components/DeskHeader'
import PixSupport from '../components/PixSupport'
import { useMediaQuery, DESK_QUERY } from '../components/useMediaQuery'
import { FORMATION_LAYOUTS } from '../components/formationLayouts'
import { USER_TEAM_NAME, campaignStats, stageLabelKey } from '../engine/cup'
import { getFlagCode } from '../i18n/flags'
import { downloadShareImage } from '../utils/shareImage'

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
  const isDesk = useMediaQuery(DESK_QUERY)
  const [showPix, setShowPix] = useState(false)

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

  const stageChip = (
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
  )

  // Uma linha por time (nome inteiro + gols à direita) — evita truncar o
  // nome do time do usuário na largura mobile
  const lastMatchCard = lastMatch && (
    <div
      className="flex flex-col p-3 border-2 animate-rise-in"
      style={{ animationDelay: '250ms', borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
    >
      {[
        { name: lastMatch.homeName, goals: lastMatch.goalsA },
        { name: lastMatch.awayName, goals: lastMatch.goalsB },
      ].map((side, i) => (
        <div
          key={side.name}
          className={`flex items-center justify-between gap-3 py-1.5 ${i === 0 ? 'border-b' : ''}`}
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className={`flex items-center gap-2 min-w-0 text-sm font-bold ${isRetro ? 'uppercase' : ''}`}>
            {side.name === USER_TEAM_NAME ? (
              <span className="text-base leading-none">🏳️</span>
            ) : (
              <Flag team={side.name} width={22} />
            )}
            <span className="truncate">{label(side.name)}</span>
          </span>
          <span className="shrink-0 text-2xl font-black tabular-nums leading-none">{side.goals}</span>
        </div>
      ))}
      {lastMatch.penalties && (
        <span className="mt-1.5 text-center text-[10px] font-bold" style={{ color: 'var(--color-accent)' }}>
          {t('score_pens')
            .replace('{a}', lastMatch.penalties.scoreA)
            .replace('{b}', lastMatch.penalties.scoreB)}
        </span>
      )}
    </div>
  )

  const groupTableBlock = groupStageExit && groupTable && (
    <div className="animate-rise-in" style={{ animationDelay: '250ms' }}>
      <p
        className={`text-center text-xs font-bold mb-1 ${isRetro ? 'uppercase' : ''}`}
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('group_label')} {groupId}
      </p>
      <GroupTable table={groupTable} teamName={teamName} />
    </div>
  )

  const playAgainButton = (
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
  )

  // Placar do último jogo da campanha (a final, se campeão; senão a eliminação),
  // sempre na ótica do usuário: "Seu time  gols × gols  Adversário [bandeira]"
  const buildLastScore = () => {
    const m = campaign.matches[campaign.matches.length - 1]
    if (!m) return null
    const userIsHome = m.homeName === USER_TEAM_NAME
    const oppName = userIsHome ? m.awayName : m.homeName
    return {
      teamName: teamName || t('your_team'),
      userGoals: userIsHome ? m.goalsA : m.goalsB,
      oppGoals: userIsHome ? m.goalsB : m.goalsA,
      oppName,
      oppCode: getFlagCode(oppName),
    }
  }

  const handleShare = () =>
    downloadShareImage({
      slots,
      formation,
      champion,
      resultLabel: champion ? t('share_champion') : t(stageLabelKey(campaign.stageReached)),
      teamName: teamName || t('your_team'),
      stats: statCards.map((s) => ({ label: t(s.key), value: s.value })),
      lastScore: buildLastScore(),
    })

  // Botão "Salvar imagem" (gera o PNG 9:16) — borda secundária, discreto
  const shareButton = (
    <button
      type="button"
      onClick={handleShare}
      className={`w-full py-3 font-bold border-2 shrink-0 ${isRetro ? 'uppercase' : ''}`}
      style={{
        background: 'transparent',
        color: 'var(--color-text)',
        borderColor: 'var(--color-border)',
        borderRadius: 'var(--radius)',
      }}
    >
      📸 {t('share_image')}
    </button>
  )

  // Link de texto para o modal de apoio
  const supportButton = (
    <button
      type="button"
      onClick={() => setShowPix(true)}
      className={`mx-auto text-xs hover:underline ${isRetro ? 'uppercase' : ''}`}
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {t('support_cta')}
    </button>
  )

  // ---------------------------------------------------------------------------
  // Layout desktop (>900px): resultado e último capítulo à esquerda, campinho
  // vertical grande no centro e a campanha em lista editorial à direita
  // ---------------------------------------------------------------------------
  if (isDesk) {
    const eyebrowStyle = { color: 'var(--color-text-secondary)' }
    return (
      <div className="relative min-h-dvh w-full flex flex-col">
        {champion && <Confetti />}

        <DeskHeader right={stageChip} />

        <div className="w-full max-w-[1280px] mx-auto px-8 py-10 grid grid-cols-[minmax(280px,360px)_minmax(0,1fr)_minmax(240px,300px)] gap-10 items-start flex-1">
          {/* Coluna esquerda: veredito + último capítulo + jogar de novo */}
          <aside className="flex flex-col gap-5 min-w-0">
            <div
              className="p-5 border-2"
              style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
            >
              <span className="block text-6xl leading-none animate-reveal-pop">
                {champion ? '🏆' : runnerUp ? '🥈' : '⚽'}
              </span>
              <h1
                className={`mt-3 text-3xl font-black leading-tight animate-rise-in ${isRetro ? 'uppercase' : ''}`}
                style={{ color: champion ? 'var(--color-accent)' : 'var(--color-text)' }}
              >
                {champion ? t('result_champion') : runnerUp ? t('result_runner_up') : t('result_eliminated')}
              </h1>
              <div className="mt-3">{stageChip}</div>
            </div>

            {groupTableBlock}
            {lastMatchCard}
            {playAgainButton}
            {shareButton}
            {supportButton}
          </aside>

          {/* Coluna central: time no campinho vertical */}
          <main className="flex flex-col items-center min-w-0">
            <div className="w-full max-w-[460px]">
              <FieldPitch vertical slots={slots} />
            </div>
          </main>

          {/* Coluna direita: campanha em lista editorial */}
          <aside className="flex flex-col min-w-0">
            <div
              className="pb-2 mb-1"
              style={{ borderBottom: '3px solid var(--color-text)' }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={eyebrowStyle}
              >
                {t('campaign_title')}
              </span>
            </div>
            {statCards.map((stat) => (
              <div
                key={stat.key}
                className="flex items-center justify-between gap-2 py-2.5 border-b"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span
                  className={`text-sm font-bold ${isRetro ? 'uppercase' : ''}`}
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {t(stat.key)}
                </span>
                <span className="text-2xl font-black tabular-nums leading-none">{stat.value}</span>
              </div>
            ))}
          </aside>
        </div>

        {showPix && <PixSupport onClose={() => setShowPix(false)} />}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-dvh w-full px-4 py-3 gap-3 overflow-y-auto">
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
        {stageChip}
      </div>

      {/* Eliminado em grupos: tabela final do grupo */}
      {groupTableBlock}

      {/* Placar do último jogo (mata-mata) */}
      {lastMatchCard}

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
            className="flex flex-col items-center justify-center py-3 border-2 animate-rise-in"
            style={{
              animationDelay: `${300 + i * 80}ms`,
              borderColor: 'var(--color-border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--color-accent)' }}>
              {stat.value}
            </span>
            <span
              className={`text-[11px] text-center ${isRetro ? 'uppercase' : ''}`}
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t(stat.key)}
            </span>
          </div>
        ))}
      </div>

      {/* Apoio ao projeto — link de texto discreto abaixo das estatísticas */}
      <div className="flex justify-center mt-1">{supportButton}</div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2 shrink-0">
        {shareButton}
        {playAgainButton}
      </div>

      {showPix && <PixSupport onClose={() => setShowPix(false)} />}
    </div>
  )
}
