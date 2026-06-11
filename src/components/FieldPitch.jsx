import { ROLE_TO_POSITION, POSITION_COLOR } from './formationLayouts'
import { isCompatible } from '../engine/compatibility'

export function PitchLines() {
  return (
    <svg viewBox="0 0 105 68" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <g fill="none" stroke="var(--color-field-line)" strokeWidth="0.5">
        <rect x="0.5" y="0.5" width="104" height="67" />
        <line x1="52.5" y1="0" x2="52.5" y2="68" />
        <circle cx="52.5" cy="34" r="9.15" />
        <rect x="0.5" y="13.84" width="16.5" height="40.32" />
        <rect x="88" y="13.84" width="16.5" height="40.32" />
      </g>
    </svg>
  )
}

export default function FieldPitch({ slots, selectedPlayer, lastPlacedIdx, onPickSlot }) {
  return (
    <div
      className="relative w-full aspect-[105/68] border-2 overflow-visible shrink-0"
      style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
    >
      <div className="absolute inset-0 field-stripes overflow-hidden" style={{ borderRadius: 'var(--radius)' }} />
      <PitchLines />

      {slots.map((slot, i) => {
        const filled = !!slot.player
        const position = ROLE_TO_POSITION[slot.role]
        // Compatibilidade por papel (role + altRoles); o glow usa a cor do
        // setor do PRÓPRIO slot — um ponta com altRole de meio acende slots
        // de ataque e de meio, cada um na cor do seu setor
        const compatible = !!onPickSlot && !filled && selectedPlayer && isCompatible(selectedPlayer, slot.role)
        const dimmed = !!onPickSlot && !filled && selectedPlayer && !compatible

        return (
          <button
            key={i}
            type="button"
            onClick={() => onPickSlot && onPickSlot(i)}
            disabled={!compatible}
            className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full ${
              compatible ? 'animate-glow-pulse' : ''
            } ${filled && i === lastPlacedIdx ? 'animate-reveal-pop' : ''}`}
            style={{
              left: `${(slot.x / 105) * 100}%`,
              top: `${(slot.y / 68) * 100}%`,
              width: '11%',
              aspectRatio: '1 / 1',
              color: compatible ? POSITION_COLOR[position] : 'var(--color-text-muted)',
              background: filled ? 'var(--color-player-user)' : 'transparent',
              border: filled
                ? '2px solid var(--color-border)'
                : `2px dashed ${compatible ? 'currentColor' : 'var(--color-text-muted)'}`,
              opacity: dimmed ? 0.3 : 1,
            }}
          >
            {filled && (
              <>
                <span className="text-[8px] font-bold leading-none" style={{ color: '#1a1a1a' }}>
                  {slot.player.ovr}
                </span>
                <span
                  className="absolute top-full mt-0.5 px-1 text-[6px] font-bold whitespace-nowrap border"
                  style={{
                    color: 'var(--color-text)',
                    background: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  {slot.player.name.split(' ').pop()}
                </span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
