import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import { getSquadPlayers, getAllTeamNames } from '../engine/simulator'
import Flag from '../components/Flag'
import FieldPitch from '../components/FieldPitch'
import {
  FORMATION_LAYOUTS,
  ROLE_TO_POSITION,
  POSITION_COLOR,
  POSITION_ORDER,
} from '../components/formationLayouts'

const ALL_TEAMS = getAllTeamNames()

const REEL_CELL = 64
const REEL_WINDOW = 256
const REEL_LENGTH = 26
const REEL_TARGET = REEL_LENGTH - 3
const REEL_DURATION = 1600
const AUTO_DRAW_DELAY = 750
const AUTO_FILL_STEP = 240

const randomTeam = () => ALL_TEAMS[Math.floor(Math.random() * ALL_TEAMS.length)]

function bestAvailable(team, position, used) {
  const candidates = getSquadPlayers(team).filter(
    (p) => p.position === position && !used.has(`${team}::${p.name}`)
  )
  if (!candidates.length) return null
  return candidates.reduce((best, p) => (p.ovr > best.ovr ? p : best))
}

function ovrColor(ovr) {
  if (ovr >= 85) return 'var(--color-accent)'
  if (ovr >= 75) return 'var(--color-text)'
  return 'var(--color-text-secondary)'
}

export default function DraftScreen({ formation, onBack, onContinue }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'

  const layout = FORMATION_LAYOUTS[formation] || FORMATION_LAYOUTS['4-3-3']

  const [slots, setSlots] = useState(() => layout.map((slot) => ({ ...slot, player: null })))
  const [phase, setPhase] = useState('idle') // idle | spinning | drawn | placed | auto
  const [reel, setReel] = useState(null)
  const [drawnTeam, setDrawnTeam] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [usedPlayers, setUsedPlayers] = useState(() => new Set())
  const [skipUsed, setSkipUsed] = useState(false)
  const [lastPlaced, setLastPlaced] = useState(null) // { index, player }

  const stripRef = useRef(null)
  const timersRef = useRef([])

  const pushTimer = (id) => timersRef.current.push(id)
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  useEffect(() => clearTimers, [])

  const filledCount = slots.filter((s) => s.player).length
  const allFilled = filledCount === slots.length

  const isCategoryFull = (position) =>
    !slots.some((s) => !s.player && ROLE_TO_POSITION[s.role] === position)

  // Roleta: anima a fita de bandeiras com desaceleração (ease-out cúbico) até o alvo
  useEffect(() => {
    if (phase !== 'spinning' || !reel) return
    const strip = stripRef.current
    const start = performance.now()
    const finalX = REEL_TARGET * REEL_CELL - (REEL_WINDOW - REEL_CELL) / 2
    let raf
    const frame = (now) => {
      const p = Math.min(1, (now - start) / REEL_DURATION)
      const eased = 1 - Math.pow(1 - p, 3)
      if (strip) strip.style.transform = `translateX(${-finalX * eased}px)`
      if (p < 1) {
        raf = requestAnimationFrame(frame)
      } else {
        setDrawnTeam(reel.cells[REEL_TARGET])
        setPhase('drawn')
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, reel])

  const startDraw = () => {
    setSelectedPlayer(null)
    setDrawnTeam(null)
    const team = randomTeam()
    const cells = Array.from({ length: REEL_LENGTH }, (_, i) => (i === REEL_TARGET ? team : randomTeam()))
    setReel({ cells, id: Date.now() })
    setPhase('spinning')
  }

  const handleSkip = () => {
    if (skipUsed) return
    setSkipUsed(true)
    startDraw()
  }

  const handleSelectPlayer = (player) => {
    if (usedPlayers.has(`${drawnTeam}::${player.name}`)) return
    if (isCategoryFull(player.position)) return
    setSelectedPlayer((prev) => (prev?.name === player.name ? null : player))
  }

  const handlePickSlot = (index) => {
    if (!selectedPlayer || slots[index].player) return
    if (ROLE_TO_POSITION[slots[index].role] !== selectedPlayer.position) return

    const player = selectedPlayer
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, player } : s)))
    setUsedPlayers((prev) => new Set(prev).add(`${drawnTeam}::${player.name}`))
    setSelectedPlayer(null)
    setDrawnTeam(null)
    setLastPlaced({ index, player })

    if (filledCount + 1 < slots.length) {
      setPhase('placed')
      pushTimer(setTimeout(startDraw, AUTO_DRAW_DELAY))
    } else {
      setPhase('idle')
    }
  }

  // Preenche todas as vagas restantes: sorteia uma seleção por vaga e escala
  // o melhor jogador disponível da posição (com fallback global se a seleção
  // sorteada não tiver ninguém disponível)
  const handleAutoComplete = () => {
    if (phase === 'spinning' || phase === 'auto') return
    clearTimers()
    setPhase('auto')
    setSelectedPlayer(null)
    setDrawnTeam(null)

    const used = new Set(usedPlayers)
    const plan = []

    slots.forEach((slot, index) => {
      if (slot.player) return
      const position = ROLE_TO_POSITION[slot.role]
      let pick = null
      let pickTeam = null

      for (let attempt = 0; attempt < 15 && !pick; attempt++) {
        const team = randomTeam()
        const best = bestAvailable(team, position, used)
        if (best) {
          pick = best
          pickTeam = team
        }
      }
      if (!pick) {
        ALL_TEAMS.forEach((team) => {
          const best = bestAvailable(team, position, used)
          if (best && (!pick || best.ovr > pick.ovr)) {
            pick = best
            pickTeam = team
          }
        })
      }
      if (!pick) return

      used.add(`${pickTeam}::${pick.name}`)
      plan.push({ index, player: pick })
    })

    setUsedPlayers(used)
    plan.forEach((step, k) => {
      pushTimer(
        setTimeout(() => {
          setSlots((prev) => prev.map((s, i) => (i === step.index ? { ...s, player: step.player } : s)))
          setLastPlaced(step)
        }, (k + 1) * AUTO_FILL_STEP)
      )
    })
  }

  const drawnSquad = drawnTeam
    ? [...getSquadPlayers(drawnTeam)].sort((a, b) => {
        const byPos = POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position)
        return byPos !== 0 ? byPos : b.ovr - a.ovr
      })
    : []

  // -------------------------------------------------------------------------
  // Resumo do time completo
  // -------------------------------------------------------------------------
  if (allFilled) {
    const average = (values) => Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
    const overall = average(slots.map((s) => s.player.ovr))
    const attack = average(
      slots.filter((s) => ['MID', 'FWD'].includes(ROLE_TO_POSITION[s.role])).map((s) => s.player.ovr)
    )
    const defense = average(
      slots.filter((s) => ['GK', 'DEF'].includes(ROLE_TO_POSITION[s.role])).map((s) => s.player.ovr)
    )

    return (
      <div className="flex flex-col h-screen w-full px-4 py-3 gap-3">
        <div className="flex items-center justify-center gap-2">
          <h1 className={`text-lg font-bold text-center ${isRetro ? 'uppercase' : ''}`}>
            {t('summary_title')}
          </h1>
          <span
            className="text-xs font-bold px-2 py-0.5 border-2"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
              borderRadius: 'var(--radius)',
            }}
          >
            {formation || '4-3-3'}
          </span>
        </div>

        <FieldPitch slots={slots} lastPlacedIdx={lastPlaced?.index} />

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('summary_overall'), value: overall },
            { label: t('summary_attack'), value: attack },
            { label: t('summary_defense'), value: defense },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center py-2 border-2 animate-rise-in"
              style={{
                animationDelay: `${i * 100}ms`,
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius)',
              }}
            >
              <span className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>
                {stat.value}
              </span>
              <span
                className={`text-[10px] ${isRetro ? 'uppercase' : ''}`}
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0">
          {slots.map((slot, i) => {
            const position = ROLE_TO_POSITION[slot.role]
            return (
              <div
                key={i}
                className="flex items-center gap-2 p-2 border-2 animate-rise-in"
                style={{
                  animationDelay: `${i * 50}ms`,
                  borderColor: 'var(--color-border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <span
                  className="shrink-0 w-9 text-center text-[9px] font-bold px-1 py-0.5 border"
                  style={{
                    color: POSITION_COLOR[position],
                    borderColor: POSITION_COLOR[position],
                    borderRadius: 'var(--radius)',
                  }}
                >
                  {position}
                </span>
                <div className="flex-1 flex flex-col">
                  <span className="text-sm font-bold">{slot.player.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    {slot.player.league || '—'}
                  </span>
                </div>
                <span className="text-sm font-bold" style={{ color: ovrColor(slot.player.ovr) }}>
                  {slot.player.ovr}
                </span>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onContinue({ players: slots.map((s) => ({ role: s.role, ...s.player })) })}
          className={`w-full py-3 font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
          style={{
            background: 'var(--color-btn-primary-bg)',
            color: 'var(--color-btn-primary-text)',
            borderColor: 'var(--color-btn-primary-border)',
            borderRadius: 'var(--radius)',
          }}
        >
          {t('btn_continue')} →
        </button>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Montagem em andamento
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen w-full px-4 py-3 gap-3">
      {/* Header + progresso */}
      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t('back')}
            className="flex items-center justify-center w-8 h-8 border-2 text-lg leading-none"
            style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
          >
            ←
          </button>
          <h1 className={`flex-1 text-lg font-bold ${isRetro ? 'uppercase' : ''}`}>{t('draft_title')}</h1>
          <span
            className="text-sm font-bold px-2 py-1 border-2"
            style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
          >
            {filledCount}/{slots.length}
          </span>
        </div>
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--color-highlight-bg)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(filledCount / slots.length) * 100}%`, background: 'var(--color-accent)' }}
          />
        </div>
      </div>

      {/* Zona de sorteio */}
      <div className="min-h-[88px] flex flex-col items-center justify-center gap-2">
        {phase === 'idle' && (
          <button
            type="button"
            onClick={startDraw}
            className={`w-full py-3 font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
            style={{
              background: 'var(--color-btn-primary-bg)',
              color: 'var(--color-btn-primary-text)',
              borderColor: 'var(--color-btn-primary-border)',
              borderRadius: 'var(--radius)',
            }}
          >
            {t('btn_draw_squad')}
          </button>
        )}

        {phase === 'spinning' && reel && (
          <div className="relative h-16 overflow-hidden" style={{ width: REEL_WINDOW }}>
            <div ref={stripRef} className="flex h-full items-center will-change-transform">
              {reel.cells.map((team, i) => (
                <span
                  key={`${reel.id}-${i}`}
                  className="flex items-center justify-center shrink-0"
                  style={{ width: REEL_CELL }}
                >
                  <Flag team={team} width={44} />
                </span>
              ))}
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-2"
              style={{ width: REEL_CELL, borderColor: 'var(--color-accent)', borderRadius: 'var(--radius)' }}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 reel-fade-left" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 reel-fade-right" />
          </div>
        )}

        {phase === 'drawn' && (
          <div className="w-full flex items-center justify-between animate-reveal-pop">
            <div className="flex items-center gap-3">
              <Flag team={drawnTeam} width={40} />
              <div className="flex flex-col">
                <span className={`text-base font-bold ${isRetro ? 'uppercase' : ''}`}>{drawnTeam}</span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {selectedPlayer ? t('draft_pick_field') : t('draft_select_player')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              disabled={skipUsed}
              className={`shrink-0 text-xs font-bold px-2 py-1 border-2 ${isRetro ? 'uppercase' : ''}`}
              style={{
                borderColor: 'var(--color-btn-secondary-border)',
                color: 'var(--color-btn-secondary-text)',
                borderRadius: 'var(--radius)',
                opacity: skipUsed ? 0.4 : 1,
              }}
            >
              {skipUsed ? t('btn_skip_used') : t('btn_skip_available')}
            </button>
          </div>
        )}

        {phase === 'placed' && lastPlaced && (
          <div className="flex items-center gap-2 animate-reveal-pop">
            <span className="text-xl leading-none" style={{ color: 'var(--color-accent)' }}>✓</span>
            <span className="text-sm font-bold">
              {t('draft_placed').replace('{name}', lastPlaced.player.name)}
            </span>
          </div>
        )}

        {phase === 'auto' && (
          <span className={`text-sm font-bold animate-pulse ${isRetro ? 'uppercase' : ''}`}>
            {t('auto_filling')}
          </span>
        )}
      </div>

      {/* Lista de jogadores da seleção sorteada */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0">
        {phase === 'drawn' &&
          drawnSquad.map((p) => {
            const used = usedPlayers.has(`${drawnTeam}::${p.name}`)
            const categoryFull = isCategoryFull(p.position)
            const disabled = used || categoryFull
            const isSelected = selectedPlayer?.name === p.name
            return (
              <button
                key={p.name}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectPlayer(p)}
                className="flex items-center gap-2 p-2 border-2 text-left"
                style={{
                  borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)',
                  background: isSelected ? 'var(--color-highlight-bg)' : 'transparent',
                  borderRadius: 'var(--radius)',
                  opacity: disabled ? 0.35 : 1,
                }}
              >
                <span
                  className="shrink-0 w-9 text-center text-[9px] font-bold px-1 py-0.5 border"
                  style={{
                    color: POSITION_COLOR[p.position],
                    borderColor: POSITION_COLOR[p.position],
                    borderRadius: 'var(--radius)',
                  }}
                >
                  {p.position}
                </span>
                <div className="flex-1 flex flex-col">
                  <span className="text-sm font-bold">{p.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    {[p.club, p.league].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
                <span className="text-sm font-bold" style={{ color: ovrColor(p.ovr) }}>{p.ovr}</span>
              </button>
            )
          })}
      </div>

      {/* Auto-completar */}
      {phase !== 'spinning' && phase !== 'auto' && (
        <button
          type="button"
          onClick={handleAutoComplete}
          className={`w-full py-2 text-xs font-bold border-2 border-dashed ${isRetro ? 'uppercase' : ''}`}
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
            borderRadius: 'var(--radius)',
            background: 'transparent',
          }}
        >
          ⚡ {t('btn_auto_complete')}
        </button>
      )}

      {/* Campinho */}
      <FieldPitch
        slots={slots}
        selectedPlayer={selectedPlayer}
        lastPlacedIdx={lastPlaced?.index}
        onPickSlot={handlePickSlot}
      />
    </div>
  )
}
