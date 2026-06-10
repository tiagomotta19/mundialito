import { getFlagCode } from '../i18n/flags'

/**
 * Bandeira de uma seleção via flagcdn.com (PNG w40, w80 para telas 2x).
 * Altura fixa em proporção 4:3 com object-cover para alinhar nas listas.
 */
export default function Flag({ team, width = 24, className = '' }) {
  const code = getFlagCode(team)
  const height = Math.round(width * 0.75)

  if (!code) {
    return (
      <span
        className={`inline-block shrink-0 ${className}`}
        style={{ width, height, fontSize: height, lineHeight: 1 }}
      >
        🏳️
      </span>
    )
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      width={width}
      height={height}
      alt={team}
      draggable={false}
      className={`inline-block shrink-0 object-cover ${className}`}
      style={{ width, height, borderRadius: 2, boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.15)' }}
    />
  )
}
