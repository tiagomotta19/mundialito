import { useEffect, useState } from 'react'
import { useTheme } from './ThemeContext'
import { useLang } from '../i18n/LangContext'
import pixQr from '../assets/pix-qr.jpeg'

const PIX_KEY = '64564688000115'

// Modal de apoio financeiro: QR Code + chave Pix copiável. Fundo escurecido,
// fecha ao clicar fora ou no X. Discreto, sem pressão — vive sobre a tela atual.
export default function PixSupport({ onClose }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'
  const [copied, setCopied] = useState(false)

  // Fecha com Esc; trava o scroll do fundo enquanto o modal está aberto
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY)
    } catch {
      // Fallback para navegadores sem Clipboard API
      const ta = document.createElement('textarea')
      ta.value = PIX_KEY
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* sem clipboard disponível */
      }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[340px] p-6 border-2 animate-rise-in"
        style={{
          background: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
          borderRadius: 'var(--radius)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('support_close')}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-lg font-bold"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          ✕
        </button>

        <p
          className={`text-center text-sm font-bold leading-snug pr-6 ${isRetro ? 'uppercase' : ''}`}
        >
          {t('support_title')}
        </p>

        <div
          className="mx-auto mt-5 w-44 h-44 border-2 overflow-hidden bg-white"
          style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
        >
          <img src={pixQr} alt="QR Code Pix" className="w-full h-full object-contain" />
        </div>

        <p
          className={`mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-center ${isRetro ? '' : ''}`}
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('support_pix_label')}
        </p>
        <p className="mt-1 text-center text-sm font-bold tabular-nums break-all">{PIX_KEY}</p>

        <button
          type="button"
          onClick={copyKey}
          className={`w-full mt-4 py-2.5 text-sm font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
          style={{
            background: copied ? 'transparent' : 'var(--color-btn-primary-bg)',
            color: copied ? 'var(--color-ok)' : 'var(--color-btn-primary-text)',
            borderColor: copied ? 'var(--color-ok)' : 'var(--color-btn-primary-border)',
            borderRadius: 'var(--radius)',
          }}
        >
          {copied ? t('pix_copied') : t('pix_copy')}
        </button>
      </div>
    </div>
  )
}
