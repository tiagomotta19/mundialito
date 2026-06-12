import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import { getSquadPlayers, getAllTeamNames } from '../engine/simulator'
import { isCompatible, playerRoles } from '../engine/compatibility'
import Flag from '../components/Flag'
import FieldPitch from '../components/FieldPitch'
import DeskHeader from '../components/DeskHeader'
import { useMediaQuery, DESK_QUERY } from '../components/useMediaQuery'
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
const SKIPS_PER_DRAFT = 2

const randomTeam = () => ALL_TEAMS[Math.floor(Math.random() * ALL_TEAMS.length)]

function bestAvailable(team, slotRole, used) {
  const candidates = getSquadPlayers(team).filter(
    (p) => isCompatible(p, slotRole) && !used.has(`${team}::${p.name}`)
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
  const isDesk = useMediaQuery(DESK_QUERY)

  const layout = FORMATION_LAYOUTS[formation] || FORMATION_LAYOUTS['4-3-3']

  const [slots, setSlots] = useState(() => layout.map((slot) => ({ ...slot, player: null })))
  const [phase, setPhase] = useState('idle') // idle | spinning | drawn | placed | auto
  const [reel, setReel] = useState(null)
  const [drawnTeam, setDrawnTeam] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [usedPlayers, setUsedPlayers] = useState(() => new Set())
  const [skipsLeft, setSkipsLeft] = useState(SKIPS_PER_DRAFT)
  const [lastPlaced, setLastPlaced] = useState(null) // { index, player }
  const [teamName, setTeamName] = useState('')

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

  const hasVacantCompatibleSlot = (player) =>
    slots.some((s) => !s.player && isCompatible(player, s.role))

  const squadHasCompatible = (team) =>
    getSquadPlayers(team).some(
      (p) => !usedPlayers.has(`${team}::${p.name}`) && hasVacantCompatibleSlot(p)
    )

  const startDraw = () => {
    setSelectedPlayer(null)
    setDrawnTeam(null)
    const team = randomTeam()
    // Fita sem bandeiras repetidas lado a lado: re-sorteia colisões com a
    // célula anterior e com a célula-alvo (vizinha seguinte)
    const cells = []
    for (let i = 0; i < REEL_LENGTH; i++) {
      if (i === REEL_TARGET) {
        cells.push(team)
        continue
      }
      let pick = randomTeam()
      while (pick === cells[i - 1] || (i + 1 === REEL_TARGET && pick === team)) {
        pick = randomTeam()
      }
      cells.push(pick)
    }
    setReel({ cells, id: Date.now() })
    setPhase('spinning')
  }

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
        const team = reel.cells[REEL_TARGET]
        if (squadHasCompatible(team)) {
          setDrawnTeam(team)
          setPhase('drawn')
        } else {
          // Nenhum jogador compatível com os slots vagos: re-sorteia
          // automaticamente sem consumir o pulo, após um aviso rápido
          setPhase('redraw')
          pushTimer(setTimeout(startDraw, 1400))
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // squadHasCompatible muda de identidade a cada render; incluí-la reiniciaria
    // a animação da fita. Durante o spin os valores que ela lê não mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reel])

  const handleSkip = () => {
    if (!skipsLeft) return
    setSkipsLeft((n) => n - 1)
    startDraw()
  }

  const handleSelectPlayer = (player) => {
    if (usedPlayers.has(`${drawnTeam}::${player.name}`)) return
    if (!hasVacantCompatibleSlot(player)) return
    setSelectedPlayer((prev) => (prev?.name === player.name ? null : player))
  }

  const handlePickSlot = (index) => {
    if (!selectedPlayer || slots[index].player) return
    if (!isCompatible(selectedPlayer, slots[index].role)) return

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
      let pick = null
      let pickTeam = null

      for (let attempt = 0; attempt < 15 && !pick; attempt++) {
        const team = randomTeam()
        const best = bestAvailable(team, slot.role, used)
        if (best) {
          pick = best
          pickTeam = team
        }
      }
      if (!pick) {
        ALL_TEAMS.forEach((team) => {
          const best = bestAvailable(team, slot.role, used)
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

  // Médias parciais durante a montagem (box score do desktop) — viram as
  // médias finais do resumo quando os 11 estão escalados
  const avgOvr = (list) =>
    list.length
      ? Math.round((list.reduce((sum, s) => sum + s.player.ovr, 0) / list.length) * 10) / 10
      : null
  const overall = avgOvr(slots.filter((s) => s.player))
  const attack = avgOvr(
    slots.filter((s) => s.player && ['MID', 'FWD'].includes(ROLE_TO_POSITION[s.role]))
  )
  const defense = avgOvr(
    slots.filter((s) => s.player && ['GK', 'DEF'].includes(ROLE_TO_POSITION[s.role]))
  )

  const handleContinue = () =>
    onContinue({
      // position do jogador escalado = setor do SLOT (Salah no meio conta
      // como MID no motor); o papel original fica em role e o do slot em
      // slotRole
      players: slots.map((s) => ({
        ...s.player,
        slotRole: s.role,
        position: ROLE_TO_POSITION[s.role],
      })),
      teamName: teamName.trim() || null,
    })

  // Blocos compartilhados entre os layouts mobile e desktop (renderizados em
  // um único lugar por vez)
  const reelBlock = phase === 'spinning' && reel && (
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
  )

  const statusBlock = (
    <>
      {phase === 'redraw' && (
        <div className="flex items-center gap-2 animate-reveal-pop">
          <span className="text-xl leading-none" style={{ color: 'var(--color-warn)' }}>↻</span>
          <span className={`text-sm font-bold ${isRetro ? 'uppercase' : ''}`}>
            {t('draft_no_compatible')}
          </span>
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
    </>
  )

  const skipButton = (
    <button
      type="button"
      onClick={handleSkip}
      disabled={!skipsLeft}
      className={`shrink-0 text-xs font-bold px-2 py-1 border-2 ${isRetro ? 'uppercase' : ''}`}
      style={{
        borderColor: 'var(--color-btn-secondary-border)',
        color: 'var(--color-btn-secondary-text)',
        borderRadius: 'var(--radius)',
        opacity: skipsLeft ? 1 : 0.4,
      }}
    >
      {skipsLeft ? t('btn_skip_available').replace('{n}', skipsLeft) : t('btn_skip_used')}
    </button>
  )

  const autoCompleteButton = phase !== 'spinning' && phase !== 'auto' && (
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
  )

  // -------------------------------------------------------------------------
  // Layout desktop (>900px): três colunas estilo caderno esportivo —
  // sorteio e lista à esquerda, campo vertical grande no centro, box score
  // editorial à direita. Mesmo estado e fluxo do mobile.
  // -------------------------------------------------------------------------
  if (isDesk) {
    const eyebrowStyle = { color: 'var(--color-text-secondary)' }

    return (
      <div className="min-h-dvh w-full flex flex-col">
        <DeskHeader
          onBack={onBack}
          right={
            <>
              <span
                className="text-xs font-bold px-2.5 py-1 border-2"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {formation || '4-3-3'}
              </span>
              <span className="text-2xl font-black tabular-nums leading-none">
                {filledCount}
                <span style={{ color: 'var(--color-text-muted)' }}>/{slots.length}</span>
              </span>
            </>
          }
        />

        <div className="w-full max-w-[1280px] mx-auto px-8 py-10 grid grid-cols-[minmax(264px,330px)_minmax(0,1fr)_minmax(230px,290px)] gap-10 items-start flex-1">
          {/* Coluna esquerda: sorteio + escolha do jogador */}
          <aside className="flex flex-col gap-5 min-w-0">
            {allFilled ? (
              <>
                <div
                  className="p-5 border-2 animate-rise-in"
                  style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
                >
                  <span
                    className="block text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={eyebrowStyle}
                  >
                    {t('lineup_complete')}
                  </span>
                  <span className="block text-5xl font-black tabular-nums mt-2 leading-none">
                    {filledCount}/{slots.length}
                  </span>
                </div>

                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={20}
                  placeholder={`${t('team_name_label')} · ${t('team_name_placeholder')}`}
                  className="w-full px-4 py-3 text-sm font-bold border-2 bg-transparent outline-none"
                  style={{
                    borderColor: teamName ? 'var(--color-accent)' : 'var(--color-border)',
                    color: 'var(--color-text)',
                    borderRadius: 'var(--radius)',
                  }}
                />

                <button
                  type="button"
                  onClick={handleContinue}
                  className={`w-full py-5 text-lg font-black border-2 animate-rise-in ${isRetro ? 'uppercase' : ''}`}
                  style={{
                    background: 'var(--color-btn-primary-bg)',
                    color: 'var(--color-btn-primary-text)',
                    borderColor: 'var(--color-btn-primary-border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  {t('btn_continue')} →
                </button>
              </>
            ) : (
              <>
                {phase === 'idle' && (
                  <button
                    type="button"
                    onClick={startDraw}
                    className={`w-full py-4 font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
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

                {phase === 'spinning' && (
                  <div
                    className="p-4 border-2 flex justify-center"
                    style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
                  >
                    {reelBlock}
                  </div>
                )}

                {phase === 'drawn' && (
                  <div
                    className="p-5 border-2 animate-reveal-pop"
                    style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
                  >
                    <span
                      className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-3"
                      style={eyebrowStyle}
                    >
                      {t('drawn_label')}
                    </span>
                    <div className="flex items-center gap-3">
                      <Flag team={drawnTeam} width={46} />
                      <span className={`text-2xl font-black leading-none ${isRetro ? 'uppercase' : ''}`}>
                        {drawnTeam}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {selectedPlayer ? t('draft_pick_field') : t('draft_select_player')}
                      </span>
                      {skipButton}
                    </div>
                  </div>
                )}

                {(phase === 'redraw' || phase === 'placed' || phase === 'auto') && (
                  <div
                    className="min-h-[56px] p-4 border-2 flex items-center justify-center"
                    style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
                  >
                    {statusBlock}
                  </div>
                )}

                {phase === 'drawn' && (
                  <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[46vh] pr-1">
                    {drawnSquad.map((p) => {
                      const used = usedPlayers.has(`${drawnTeam}::${p.name}`)
                      const disabled = used || !hasVacantCompatibleSlot(p)
                      const isSelected = selectedPlayer?.name === p.name
                      const roles = playerRoles(p)
                      return (
                        <button
                          key={p.name}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleSelectPlayer(p)}
                          className={`flex items-center gap-3 px-3 py-2.5 border-2 text-left transition-colors duration-150 ${
                            disabled || isSelected ? '' : 'hover:bg-[var(--color-highlight-bg)]'
                          }`}
                          style={{
                            borderColor: isSelected
                              ? 'var(--color-btn-primary-border)'
                              : 'var(--color-border)',
                            background: isSelected ? 'var(--color-btn-primary-bg)' : undefined,
                            borderRadius: 'var(--radius)',
                            opacity: disabled ? 0.35 : 1,
                          }}
                        >
                          <span className="shrink-0 w-10 flex flex-col items-center gap-0.5">
                            <span
                              className="w-full text-center text-[9px] font-bold px-1 py-0.5 border"
                              style={{
                                color: isSelected
                                  ? 'var(--color-btn-primary-text)'
                                  : POSITION_COLOR[p.position],
                                borderColor: isSelected
                                  ? 'var(--color-btn-primary-text)'
                                  : POSITION_COLOR[p.position],
                                borderRadius: 'var(--radius)',
                              }}
                            >
                              {p.position}
                            </span>
                            {roles.length > 0 && (
                              <span
                                className="text-[8px] leading-none"
                                style={{
                                  color: isSelected
                                    ? 'var(--color-btn-primary-text)'
                                    : 'var(--color-text-muted)',
                                }}
                              >
                                {roles.join(' · ')}
                              </span>
                            )}
                          </span>
                          <div className="flex-1 min-w-0 flex flex-col">
                            <span
                              className="text-sm font-bold truncate"
                              style={{
                                color: isSelected ? 'var(--color-btn-primary-text)' : 'var(--color-text)',
                              }}
                            >
                              {p.name}
                            </span>
                            <span
                              className="text-[10px] truncate"
                              style={{
                                color: isSelected
                                  ? 'var(--color-btn-primary-text)'
                                  : 'var(--color-text-muted)',
                              }}
                            >
                              {p.league || '—'}
                            </span>
                          </div>
                          <span
                            className="text-xl font-black tabular-nums"
                            style={{
                              color: isSelected ? 'var(--color-btn-primary-text)' : ovrColor(p.ovr),
                            }}
                          >
                            {p.ovr}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {autoCompleteButton}
              </>
            )}
          </aside>

          {/* Coluna central: campo vertical grande */}
          <main className="flex flex-col items-center min-w-0">
            <div className="w-full max-w-[460px]">
              <FieldPitch
                vertical
                slots={slots}
                selectedPlayer={allFilled ? null : selectedPlayer}
                lastPlacedIdx={lastPlaced?.index}
                onPickSlot={allFilled ? undefined : handlePickSlot}
              />
            </div>
          </main>

          {/* Coluna direita: box score editorial */}
          <aside className="flex flex-col min-w-0">
            <div
              className="flex items-end justify-between gap-2 pb-2"
              style={{ borderBottom: '3px solid var(--color-text)' }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] pb-1"
                style={eyebrowStyle}
              >
                {t('lineup_label')} · {filledCount}/{slots.length}
              </span>
              <span
                className="text-4xl font-black tabular-nums leading-none"
                style={{ color: overall != null ? 'var(--color-text)' : 'var(--color-text-muted)' }}
              >
                {overall ?? '—'}
              </span>
            </div>

            <div
              className="flex items-baseline justify-end gap-4 py-2.5 mb-1 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span className="flex items-baseline gap-1.5">
                <span className="text-lg font-black tabular-nums">{attack ?? '—'}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={eyebrowStyle}>
                  {t('summary_attack')}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-lg font-black tabular-nums">{defense ?? '—'}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={eyebrowStyle}>
                  {t('summary_defense')}
                </span>
              </span>
            </div>

            <div className="flex flex-col">
              {slots.map((slot, i) => (
                <div
                  key={slot.player ? `${i}-${slot.player.name}` : `empty-${i}`}
                  className={`flex items-center gap-2 py-2 border-b ${slot.player ? 'animate-slide-in' : ''}`}
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span
                    className="w-9 shrink-0 text-[10px] font-bold"
                    style={{ color: POSITION_COLOR[ROLE_TO_POSITION[slot.role]] }}
                  >
                    {slot.role}
                  </span>
                  {slot.player ? (
                    <>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className={`text-sm font-bold truncate ${isRetro ? 'uppercase' : ''}`}>
                          {slot.player.name}
                        </span>
                        <span className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                          {slot.player.league || '—'}
                        </span>
                      </div>
                      <span
                        className="text-base font-black tabular-nums"
                        style={{ color: ovrColor(slot.player.ovr) }}
                      >
                        {slot.player.ovr}
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-sm leading-7" style={{ color: 'var(--color-text-muted)' }}>
                      —
                    </span>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Resumo do time completo (mobile)
  // -------------------------------------------------------------------------
  if (allFilled) {
    return (
      <div className="flex flex-col h-dvh w-full px-4 py-3 gap-3">
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
                  {slot.role}
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

        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          maxLength={20}
          placeholder={`${t('team_name_label')} · ${t('team_name_placeholder')}`}
          className="w-full px-3 py-2 text-sm font-bold border-2 bg-transparent outline-none"
          style={{
            borderColor: teamName ? 'var(--color-accent)' : 'var(--color-border)',
            color: 'var(--color-text)',
            borderRadius: 'var(--radius)',
          }}
        />

        <button
          type="button"
          onClick={handleContinue}
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
    <div className="flex flex-col h-dvh w-full px-4 py-3 gap-3">
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

        {reelBlock}

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
            {skipButton}
          </div>
        )}

        {statusBlock}
      </div>

      {/* Lista de jogadores da seleção sorteada */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0">
        {phase === 'drawn' &&
          drawnSquad.map((p) => {
            const used = usedPlayers.has(`${drawnTeam}::${p.name}`)
            const disabled = used || !hasVacantCompatibleSlot(p)
            const isSelected = selectedPlayer?.name === p.name
            const roles = playerRoles(p)
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
                <span className="shrink-0 w-9 flex flex-col items-center gap-0.5">
                  <span
                    className="w-full text-center text-[9px] font-bold px-1 py-0.5 border"
                    style={{
                      color: POSITION_COLOR[p.position],
                      borderColor: POSITION_COLOR[p.position],
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    {p.position}
                  </span>
                  {roles.length > 0 && (
                    <span className="text-[8px] leading-none" style={{ color: 'var(--color-text-muted)' }}>
                      {roles.join(' · ')}
                    </span>
                  )}
                </span>
                <div className="flex-1 flex flex-col">
                  <span className="text-sm font-bold">{p.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    {p.league || '—'}
                  </span>
                </div>
                <span className="text-sm font-bold" style={{ color: ovrColor(p.ovr) }}>{p.ovr}</span>
              </button>
            )
          })}
      </div>

      {/* Auto-completar */}
      {autoCompleteButton}

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
