import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import { LANGUAGES } from '../i18n/translations'
import { useMediaQuery, DESK_QUERY } from '../components/useMediaQuery'

// Campinho decorativo com a bola animada (horizontal, só visual)
function DecorativeField() {
  return (
    <div
      className="relative w-full aspect-[105/68] overflow-hidden border"
      style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
    >
      <div className="absolute inset-0 field-stripes" />
      <svg viewBox="0 0 105 68" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <g fill="none" stroke="var(--color-field-line)" strokeWidth="0.6">
          <rect x="0.5" y="0.5" width="104" height="67" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" />
          <circle cx="52.5" cy="34" r="9.15" />
          <circle cx="52.5" cy="34" r="0.6" fill="var(--color-field-line)" />
          <rect x="0" y="13.84" width="16.5" height="40.32" />
          <rect x="88.5" y="13.84" width="16.5" height="40.32" />
          <rect x="0" y="24.84" width="5.5" height="18.32" />
          <rect x="99.5" y="24.84" width="5.5" height="18.32" />
        </g>
      </svg>
      <div
        className="absolute w-3 h-3 rounded-full animate-ball"
        style={{ background: 'var(--color-ball)' }}
      />
    </div>
  )
}

export default function HomeScreen({ onPlay }) {
  const { theme, toggleTheme } = useTheme()
  const { lang, setLang, t } = useLang()
  const isRetro = theme === 'retro'
  const isDesk = useMediaQuery(DESK_QUERY)

  const langSelect = (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      className="bg-transparent border px-2 py-1"
      style={{
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-secondary)',
        borderRadius: 'var(--radius)',
      }}
    >
      {LANGUAGES.map((code) => (
        <option key={code} value={code} className="bg-[var(--color-bg)]">
          {code.toUpperCase()}
        </option>
      ))}
    </select>
  )

  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      className="border px-2 py-1"
      style={{
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-secondary)',
        borderRadius: 'var(--radius)',
      }}
    >
      {isRetro ? t('theme_moderno') : t('theme_retro')} ⇄
    </button>
  )

  const steps = [t('step_1'), t('step_2'), t('step_3')]

  // ---------------------------------------------------------------------------
  // Layout desktop (>900px): hero central — wordmark gigante, campo decorativo
  // maior, passos em três colunas e botão com respiro
  // ---------------------------------------------------------------------------
  if (isDesk) {
    return (
      <div className="min-h-screen w-full flex flex-col">
        <div className="w-full max-w-[1280px] mx-auto px-8 pt-6 flex items-center justify-end gap-2 text-xs shrink-0">
          {langSelect}
          {themeButton}
        </div>

        <div className="flex-1 w-full max-w-[1280px] mx-auto px-8 pb-14 flex flex-col items-center justify-center gap-9">
          {/* Logo + tagline */}
          <div className="text-center">
            <h1 className={`text-7xl font-black tracking-tight leading-none ${isRetro ? 'uppercase' : ''}`}>
              <span>{t('app_name_1')}</span>
              <span style={{ color: 'var(--color-accent)' }}>{t('app_name_2')}</span>
            </h1>
            <p
              className="mt-4 text-xs font-bold uppercase tracking-[0.28em]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('tagline')}
            </p>
          </div>

          {/* Campo decorativo central */}
          <div className="w-full max-w-[620px]">
            <DecorativeField />
          </div>

          {/* Como jogar em três colunas */}
          <div className="w-full max-w-[900px]">
            <h2
              className="text-[10px] font-bold uppercase tracking-[0.22em] text-center mb-4"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('how_to')}
            </h2>
            <ol className="grid grid-cols-3 gap-6">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className="flex flex-col items-center gap-3 p-5 border-2 text-center"
                  style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
                >
                  <span
                    className="flex items-center justify-center w-8 h-8 text-sm font-black border-2"
                    style={{ borderColor: 'var(--color-text)', borderRadius: 'var(--radius)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            onClick={onPlay}
            className={`px-20 py-4 text-lg font-black border-2 ${isRetro ? 'uppercase' : ''}`}
            style={{
              background: 'var(--color-btn-primary-bg)',
              color: 'var(--color-btn-primary-text)',
              borderColor: 'var(--color-btn-primary-border)',
              borderRadius: 'var(--radius)',
            }}
          >
            {t('btn_play')}
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Layout mobile
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen w-full px-4 py-3">
      {/* Topbar */}
      <div className="flex items-center justify-between text-xs mb-2">
        {langSelect}
        {themeButton}
      </div>

      {/* Logo + tagline */}
      <div className="text-center mb-3">
        <h1 className={`text-4xl font-bold tracking-tight ${isRetro ? 'uppercase' : ''}`}>
          <span>{t('app_name_1')}</span>
          <span style={{ color: 'var(--color-accent)' }}>{t('app_name_2')}</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('tagline')}
        </p>
      </div>

      {/* Mini campinho decorativo */}
      <div className="mx-auto mb-4 w-64">
        <DecorativeField />
      </div>

      {/* Como jogar */}
      <div className="text-sm flex-1">
        <h2 className={`mb-2 font-bold ${isRetro ? 'uppercase' : ''}`}>{t('how_to')}</h2>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span
                className="shrink-0 flex items-center justify-center w-5 h-5 text-xs font-bold border"
                style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
              >
                {i + 1}
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Botão principal */}
      <button
        type="button"
        onClick={onPlay}
        className={`w-full py-3 font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
        style={{
          background: 'var(--color-btn-primary-bg)',
          color: 'var(--color-btn-primary-text)',
          borderColor: 'var(--color-btn-primary-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        {t('btn_play')}
      </button>
    </div>
  )
}
