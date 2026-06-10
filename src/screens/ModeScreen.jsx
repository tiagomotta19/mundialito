import { useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import { FORMATIONS } from '../engine/simulator'

export default function ModeScreen({ onBack, onContinue }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'

  const [mode, setMode] = useState(null)
  const [formation, setFormation] = useState(null)

  const canContinue = !!mode && !!formation

  const modes = [
    { id: 'fast', icon: '⚡', name: t('mode_fast'), desc: t('mode_fast_desc') },
    { id: 'classic', icon: '🏆', name: t('mode_classic'), desc: t('mode_classic_desc') },
  ]

  return (
    <div className="flex flex-col h-screen w-full px-4 py-3">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('back')}
          className="flex items-center justify-center w-8 h-8 border-2 text-lg leading-none"
          style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
        >
          ←
        </button>
        <h1 className={`text-lg font-bold ${isRetro ? 'uppercase' : ''}`}>{t('choose_mode_title')}</h1>
      </div>

      {/* Cards de modo */}
      <div className="flex flex-col gap-3 mb-6">
        {modes.map((option) => {
          const selected = mode === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className="flex items-start gap-3 p-3 text-left border-2"
              style={{
                borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
                background: selected ? 'var(--color-highlight-bg)' : 'transparent',
                borderRadius: 'var(--radius)',
              }}
            >
              <span className="text-2xl leading-none">{option.icon}</span>
              <span className="flex flex-col gap-1">
                <span className={`font-bold ${isRetro ? 'uppercase' : ''}`}>{option.name}</span>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {option.desc}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Formação */}
      <div className="mb-6">
        <h2 className={`mb-2 text-sm font-bold ${isRetro ? 'uppercase' : ''}`}>{t('choose_formation')}</h2>
        <div className="grid grid-cols-3 gap-2">
          {Object.keys(FORMATIONS).map((f) => {
            const selected = formation === f
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFormation(f)}
                className="py-2 text-sm font-bold text-center border-2"
                style={{
                  borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
                  background: selected ? 'var(--color-highlight-bg)' : 'transparent',
                  borderRadius: 'var(--radius)',
                }}
              >
                {f}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1" />

      {/* Continuar */}
      <button
        type="button"
        disabled={!canContinue}
        onClick={() => onContinue({ mode, formation })}
        className={`w-full py-3 font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
        style={{
          background: canContinue ? 'var(--color-btn-primary-bg)' : 'transparent',
          color: canContinue ? 'var(--color-btn-primary-text)' : 'var(--color-text-muted)',
          borderColor: canContinue ? 'var(--color-btn-primary-border)' : 'var(--color-btn-secondary-border)',
          borderRadius: 'var(--radius)',
          opacity: canContinue ? 1 : 0.6,
          cursor: canContinue ? 'pointer' : 'not-allowed',
        }}
      >
        {t('btn_continue')}
      </button>
    </div>
  )
}
