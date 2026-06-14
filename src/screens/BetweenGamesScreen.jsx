import { useRef, useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import Flag from '../components/Flag'
import { POSITION_COLOR } from '../components/formationLayouts'

// Tela de gestão do elenco entre os jogos (Modo Clássico): 14 jogadores com
// OVR do jogo + seta de variação, suspensões/fadiga sinalizadas e até 3 trocas
// titular↔reserva (mesmo setor) por jogo.
const ovrColor = (ovr) => {
  if (ovr >= 85) return 'var(--color-accent)'
  if (ovr >= 75) return 'var(--color-text)'
  return 'var(--color-text-secondary)'
}

function DeltaArrow({ delta }) {
  if (delta == null) return null
  if (delta > 0) return <span style={{ color: 'var(--color-ok)' }}>↑+{delta}</span>
  if (delta < 0) return <span style={{ color: 'var(--color-danger)' }}>↓{delta}</span>
  return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
}

export default function BetweenGamesScreen({ info, teamName, onPlay }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'

  const [work, setWork] = useState(() => info.roster.map((r) => ({ ...r })))
  const [swaps, setSwaps] = useState([])
  const [selected, setSelected] = useState(null)

  // Dado de frescor por reserva, travado no jogo: desfazer e repor o mesmo
  // jogador não re-rola (sem save-scum). Vive enquanto a tela do jogo existir.
  const manualFreshRef = useRef(new Map())

  // XI do jogo anterior (titulares ao abrir a tela, já com coberturas de
  // suspensão). Recolocar um deles na própria vaga NÃO é entrada nova → sem
  // frescor; só reserva que não estava no XI ganha o dado.
  const originalStarters = new Set(info.roster.filter((r) => r.starter).map((r) => r.id))

  const selectedItem = work.find((r) => r.id === selected) || null
  const maxReached = swaps.length >= info.maxSwaps

  const isSwapTarget = (row) =>
    selectedItem &&
    selectedItem.id !== row.id &&
    selectedItem.starter !== row.starter &&
    selectedItem.sector === row.sector &&
    !maxReached &&
    !(row.starter ? false : row.suspended) &&
    !(selectedItem.starter ? false : selectedItem.suspended)

  const handleTap = (row) => {
    if (selected === row.id) {
      setSelected(null)
      return
    }
    if (selected == null) {
      // Não dá pra escalar um reserva suspenso
      if (!row.starter && row.suspended) return
      setSelected(row.id)
      return
    }
    if (isSwapTarget(row)) {
      const starterRow = selectedItem.starter ? selectedItem : row
      const benchRow = selectedItem.starter ? row : selectedItem
      // Só rola frescor para quem ENTRA de fato no XI (não estava entre os
      // titulares ao abrir a tela). Recolocar um titular original na própria
      // vaga não dá frescor — preserva o frescor de origem (ex.: cobertura).
      const isGenuineEntry = !originalStarters.has(benchRow.id)
      let fresh
      if (isGenuineEntry) {
        // Mérito = o titular que sai está em baixa (↓ neste jogo). Rola o dado
        // uma vez por reserva e trava no cache (sem save-scum ao refazer).
        const meritful = starterRow.delta != null && starterRow.delta < 0
        const cache = manualFreshRef.current
        if (cache.has(benchRow.id)) {
          fresh = cache.get(benchRow.id)
        } else {
          const chance = meritful ? info.freshChanceMerit : info.freshChanceRandom
          fresh = Math.random() < chance
          cache.set(benchRow.id, fresh)
        }
      } else {
        fresh = info.roster.find((r) => r.id === benchRow.id)?.fresh === true
      }
      setSwaps((prev) => [...prev, { outId: starterRow.id, inId: benchRow.id, fresh }])
      setWork((prev) =>
        prev.map((r) => {
          if (r.id === benchRow.id) return { ...r, starter: true, fresh }
          if (r.id === starterRow.id) return { ...r, starter: false, fresh: false }
          return r
        })
      )
      setSelected(null)
    } else {
      // troca de seleção
      if (!row.starter && row.suspended) return
      setSelected(row.id)
    }
  }

  const reset = () => {
    setWork(info.roster.map((r) => ({ ...r })))
    setSwaps([])
    setSelected(null)
  }

  const starters = work.filter((r) => r.starter)
  const bench = work.filter((r) => !r.starter)

  const PlayerRow = ({ row }) => {
    const selectedNow = selected === row.id
    const target = isSwapTarget(row)
    const badgeRole = row.starter ? row.slotRole : row.sector
    return (
      <button
        type="button"
        onClick={() => handleTap(row)}
        className={`flex items-center gap-2 p-2 border-2 text-left w-full ${target ? 'animate-fill-pulse' : ''}`}
        style={{
          borderColor: selectedNow
            ? 'var(--color-btn-primary-border)'
            : target
              ? POSITION_COLOR[row.sector]
              : 'var(--color-border)',
          background: selectedNow ? 'var(--color-btn-primary-bg)' : 'transparent',
          borderRadius: 'var(--radius)',
          opacity: row.suspended && !row.starter ? 0.6 : 1,
        }}
      >
        <span
          className="shrink-0 w-9 text-center text-[9px] font-bold px-1 py-0.5 border"
          style={{
            color: selectedNow ? 'var(--color-btn-primary-text)' : POSITION_COLOR[row.sector],
            borderColor: selectedNow ? 'var(--color-btn-primary-text)' : POSITION_COLOR[row.sector],
            borderRadius: 'var(--radius)',
          }}
        >
          {badgeRole}
        </span>

        <div className="flex-1 min-w-0 flex flex-col">
          <span
            className="text-sm font-bold truncate"
            style={{ color: selectedNow ? 'var(--color-btn-primary-text)' : 'var(--color-text)' }}
          >
            {row.name}
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-bold mt-0.5">
            {row.suspended && (
              <span style={{ color: 'var(--color-danger)' }}>⛔ {t('badge_suspended')}</span>
            )}
            {row.autoSubIn && <span style={{ color: 'var(--color-ok)' }}>↑ {t('badge_in')}</span>}
            {row.starter && row.fresh && (
              <span style={{ color: 'var(--color-ok)' }}>
                ✨ {t('badge_fresh')} +{info.freshnessBonus}
              </span>
            )}
            {row.fatigued && <span style={{ color: 'var(--color-warn)' }}>💤 {t('badge_fatigue')}</span>}
            {row.starter && row.comMoral && (
              <span style={{ color: 'var(--color-ok)' }}>🔥 {t('badge_morale')}</span>
            )}
            {row.yellowCount === 1 && !row.suspended && (
              <span style={{ color: 'var(--color-warn)' }}>🟨</span>
            )}
          </span>
        </div>

        <span className="shrink-0 text-[10px] font-bold tabular-nums w-9 text-right">
          <DeltaArrow delta={row.delta} />
        </span>
        <span
          className="shrink-0 text-lg font-black tabular-nums w-8 text-right"
          style={{ color: selectedNow ? 'var(--color-btn-primary-text)' : ovrColor(row.ovr) }}
        >
          {row.ovr}
        </span>
      </button>
    )
  }

  const sectionLabel = (text) => (
    <div className="flex items-center justify-between">
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isRetro ? 'uppercase' : ''}`}
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {text}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col h-dvh w-full px-4 py-3 gap-3 max-w-[640px] mx-auto">
      {/* Cabeçalho do confronto */}
      <div
        className="flex items-center gap-3 p-3 border-2 shrink-0"
        style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
      >
        <span className="text-3xl leading-none">🏳️</span>
        <div className="flex-1 min-w-0">
          <span
            className={`block text-[10px] font-bold uppercase tracking-[0.14em] ${isRetro ? 'uppercase' : ''}`}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {info.isKnockout
              ? t(info.stageKey)
              : `${t('stage_group')} · ${t('round_label').replace('{n}', info.matchday)}`}
          </span>
          <span className={`block text-base font-black truncate ${isRetro ? 'uppercase' : ''}`}>
            {teamName || t('your_team')}
          </span>
        </div>
        <span className="text-sm font-bold shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          {t('vs')}
        </span>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <Flag team={info.opponent.name} width={36} />
          <span className={`text-xs font-bold text-center ${isRetro ? 'uppercase' : ''}`}>
            {info.opponent.name}
          </span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
            {info.opponent.strength}
            {info.boost > 0 && (
              <span style={{ color: 'var(--color-danger)' }}> +{info.boost}</span>
            )}
          </span>
        </div>
      </div>

      {/* Contador de trocas */}
      <div className="flex items-center justify-between shrink-0">
        <span className={`text-sm font-bold ${isRetro ? 'uppercase' : ''}`}>{t('between_title')}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
            {t('swaps_left').replace('{n}', swaps.length).replace('{max}', info.maxSwaps)}
          </span>
          {swaps.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className={`text-[11px] font-bold px-2 py-1 border ${isRetro ? 'uppercase' : ''}`}
              style={{
                borderColor: 'var(--color-btn-secondary-border)',
                color: 'var(--color-btn-secondary-text)',
                borderRadius: 'var(--radius)',
              }}
            >
              {t('btn_reset_swaps')}
            </button>
          )}
        </div>
      </div>

      {/* Listas */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
        {sectionLabel(t('on_field'))}
        <div className="flex flex-col gap-1">
          {starters.map((row) => (
            <PlayerRow key={row.id} row={row} />
          ))}
        </div>
        {sectionLabel(t('reserves_title'))}
        <div className="flex flex-col gap-1">
          {bench.map((row) => (
            <PlayerRow key={row.id} row={row} />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onPlay(swaps)}
        className={`w-full py-3 font-bold border-2 shrink-0 ${isRetro ? 'uppercase' : ''}`}
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
