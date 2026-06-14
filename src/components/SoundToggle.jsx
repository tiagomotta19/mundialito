import { useSound } from '../audio/SoundContext'
import { useLang } from '../i18n/LangContext'

// Botão discreto de liga/desliga do som (🔊/🔇). Por padrão imita o visual dos
// botões de idioma/tema; aceita className/style para a variante fixa do mobile.
export default function SoundToggle({ className = '', style }) {
  const { enabled, toggle } = useSound()
  const { t } = useLang()
  const label = enabled ? t('sound_on') : t('sound_off')

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`border px-2 py-1 leading-none ${className}`}
      style={{
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-secondary)',
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius)',
        ...style,
      }}
    >
      {enabled ? '🔊' : '🔇'}
    </button>
  )
}
