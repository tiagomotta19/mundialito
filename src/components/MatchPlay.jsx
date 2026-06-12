import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './ThemeContext'
import { useLang } from '../i18n/LangContext'
import { USER_TEAM_NAME } from '../engine/cup'
import PitchSim from './PitchSim'
import DeskHeader from './DeskHeader'
import { useMediaQuery, DESK_QUERY } from './useMediaQuery'

const EVENT_ICONS = { goal: '⚽', yellow: '🟨' }
const FAST_DURATION = 3000
const CLASSIC_DURATION = 16000

// ---------------------------------------------------------------------------
// Partida completa: placar + progresso + (campinho no Clássico) + feed
// ---------------------------------------------------------------------------
export default function MatchPlay({ match, mode, stageLabel, continueLabel, onContinue, userFormation, teamName }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'
  const isDesk = useMediaQuery(DESK_QUERY)

  const isClassic = mode === 'classic'
  const maxMinute = match.extraTime ? 120 : 90
  const duration = isClassic ? CLASSIC_DURATION : FAST_DURATION

  const [minute, setMinute] = useState(0)
  const skippedRef = useRef(false)
  const finished = minute >= maxMinute

  useEffect(() => {
    let raf
    const start = performance.now()
    let last = -1
    const frame = (now) => {
      if (skippedRef.current) return
      const p = Math.min(1, (now - start) / duration)
      const m = Math.round(p * maxMinute)
      if (m !== last) {
        last = m
        setMinute(m)
      }
      if (p < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [duration, maxMinute])

  const handleSkip = () => {
    skippedRef.current = true
    setMinute(maxMinute)
  }

  const label = (name) => (name === USER_TEAM_NAME ? teamName || t('your_team') : name)

  const events = useMemo(
    () => [...match.events].sort((a, b) => a.minute - b.minute),
    [match]
  )
  const visible = events.filter((e) => e.minute <= minute)
  const goalsHome = visible.filter((e) => e.type === 'goal' && e.side === 'home').length
  const goalsAway = visible.filter((e) => e.type === 'goal' && e.side === 'away').length

  const feed = []
  visible.forEach((e) => {
    if (match.extraTime && e.minute > 90 && !feed.some((f) => f.marker === 'et')) {
      feed.push({ marker: 'et' })
    }
    feed.push(e)
  })
  if (match.extraTime && minute >= 90 && !feed.some((f) => f.marker === 'et')) {
    feed.push({ marker: 'et' })
  }
  if (finished && match.penalties) feed.push({ marker: 'pens' })

  const sideColor = (side) => {
    const name = side === 'home' ? match.homeName : match.awayName
    return name === USER_TEAM_NAME ? 'var(--color-player-user)' : 'var(--color-player-opponent)'
  }

  const pensNote =
    finished && match.penalties
      ? t('score_pens')
          .replace('{a}', match.penalties.scoreA)
          .replace('{b}', match.penalties.scoreB)
      : null

  const sides = [
    { name: match.homeName, side: 'home', goals: goalsHome },
    { name: match.awayName, side: 'away', goals: goalsAway },
  ]

  // Blocos compartilhados entre os layouts mobile e desktop
  const progressBlock = (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2 overflow-hidden rounded-full"
        style={{ background: 'var(--color-highlight-bg)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${(minute / maxMinute) * 100}%`, background: 'var(--color-accent)' }}
        />
      </div>
      <span className="w-9 text-right text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
        {minute}'
      </span>
      {!finished && (
        <button
          type="button"
          onClick={handleSkip}
          className={`text-[10px] font-bold px-2 py-1 border ${isRetro ? 'uppercase' : ''}`}
          style={{
            borderColor: 'var(--color-btn-secondary-border)',
            color: 'var(--color-btn-secondary-text)',
            borderRadius: 'var(--radius)',
          }}
        >
          {t('btn_skip_anim')} ⏩
        </button>
      )}
    </div>
  )

  const feedItems = feed.map((e, i) =>
    e.marker ? (
      <p
        key={`m${i}`}
        className={`text-center text-[11px] font-bold py-1 animate-rise-in ${isRetro ? 'uppercase' : ''}`}
        style={{ color: 'var(--color-accent)' }}
      >
        {e.marker === 'et'
          ? `⏱ ${t('feed_extra_time')}`
          : `🥅 ${t('feed_penalties')} — ${match.penalties.scoreA}–${match.penalties.scoreB}`}
      </p>
    ) : (
      <div
        key={`${e.minute}-${e.type}-${e.player}-${i}`}
        className="flex items-center gap-2 px-2.5 py-2 border animate-rise-in"
        style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
      >
        <span
          className="shrink-0 w-1.5 h-4"
          style={{ background: sideColor(e.side), borderRadius: 'var(--radius)' }}
        />
        <span className="w-8 text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
          {e.minute}'
        </span>
        <span className="text-sm leading-none">{EVENT_ICONS[e.type]}</span>
        <span className="flex-1 text-sm font-bold truncate">{e.player}</span>
      </div>
    )
  )

  const continueButton = finished && (
    <button
      type="button"
      onClick={onContinue}
      className={`w-full py-3 font-bold border-2 animate-rise-in ${isRetro ? 'uppercase' : ''}`}
      style={{
        background: 'var(--color-btn-primary-bg)',
        color: 'var(--color-btn-primary-text)',
        borderColor: 'var(--color-btn-primary-border)',
        borderRadius: 'var(--radius)',
      }}
    >
      {continueLabel} →
    </button>
  )

  // -------------------------------------------------------------------------
  // Layout desktop (>900px): placar e controles à esquerda, campo animado ao
  // centro (Modo Clássico) e feed de lances à direita. Mesmo estado do mobile.
  // -------------------------------------------------------------------------
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
              {stageLabel}
            </span>
          }
        />

        <div
          className={`w-full max-w-[1280px] mx-auto px-8 py-10 grid gap-10 items-start flex-1 ${
            isClassic
              ? 'grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(260px,330px)]'
              : 'grid-cols-[minmax(320px,420px)_minmax(0,1fr)]'
          }`}
        >
          {/* Coluna esquerda: placar + progresso + continuar */}
          <aside className="flex flex-col gap-5 min-w-0">
            <div
              className="p-5 border-2"
              style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
            >
              <span
                className="block text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {stageLabel}
              </span>
              <div className="mt-3 flex flex-col">
                {sides.map((side, i) => (
                  <div
                    key={side.name}
                    className={`flex items-center justify-between gap-3 py-2.5 ${i === 0 ? 'border-b' : ''}`}
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <span className={`flex items-center gap-2 min-w-0 text-base font-bold ${isRetro ? 'uppercase' : ''}`}>
                      <span
                        className="shrink-0 w-1.5 h-5"
                        style={{
                          background: sideColor(i === 0 ? 'home' : 'away'),
                          borderRadius: 'var(--radius)',
                        }}
                      />
                      <span className="truncate">{label(side.name)}</span>
                    </span>
                    <span className="shrink-0 text-4xl font-black tabular-nums leading-none">
                      {side.goals}
                    </span>
                  </div>
                ))}
              </div>
              {pensNote && (
                <span
                  className="block mt-3 text-xs font-bold animate-rise-in"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {pensNote}
                </span>
              )}
            </div>

            {progressBlock}
            {continueButton}
          </aside>

          {/* Coluna central: campo animado (Modo Clássico) */}
          {isClassic && (
            <main className="flex flex-col items-center min-w-0">
              <div className="w-full max-w-[720px]">
                <PitchSim
                  match={match}
                  minute={minute}
                  finished={finished}
                  userFormation={userFormation}
                  durationMs={CLASSIC_DURATION}
                />
              </div>
            </main>
          )}

          {/* Feed de lances */}
          <aside className="flex flex-col min-w-0">
            <div
              className="flex items-end justify-between pb-2 mb-2"
              style={{ borderBottom: '3px solid var(--color-text)' }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('feed_title')}
              </span>
              <span className="text-lg font-black tabular-nums leading-none">{minute}'</span>
            </div>
            <div className="flex flex-col gap-1">
              {feedItems.length ? (
                feedItems
              ) : (
                <span className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>
                  —
                </span>
              )}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Layout mobile
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-3">
      {/* Placar: uma linha por time (nome inteiro + gols grandes), como no desktop */}
      <div
        className="flex flex-col p-3 border-2"
        style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {stageLabel}
        </span>
        <div className="mt-1 flex flex-col">
          {sides.map((s, i) => (
            <div
              key={s.side}
              className={`flex items-center justify-between gap-3 py-2 ${i === 0 ? 'border-b' : ''}`}
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span className={`flex items-center gap-2 min-w-0 text-sm font-bold ${isRetro ? 'uppercase' : ''}`}>
                <span
                  className="shrink-0 w-1.5 h-4"
                  style={{ background: sideColor(s.side), borderRadius: 'var(--radius)' }}
                />
                <span className="truncate">{label(s.name)}</span>
              </span>
              <span className="shrink-0 text-3xl font-black tabular-nums leading-none">{s.goals}</span>
            </div>
          ))}
        </div>
        {pensNote && (
          <span
            className="mt-1.5 text-center text-[11px] font-bold animate-rise-in"
            style={{ color: 'var(--color-accent)' }}
          >
            {pensNote}
          </span>
        )}
      </div>

      {/* Campinho animado (Modo Clássico) */}
      {isClassic && (
        <PitchSim
          match={match}
          minute={minute}
          finished={finished}
          userFormation={userFormation}
          durationMs={CLASSIC_DURATION}
        />
      )}

      {/* Progresso */}
      {progressBlock}

      {/* Feed de eventos */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0">{feedItems}</div>

      {/* Continuar */}
      {continueButton}
    </div>
  )
}
