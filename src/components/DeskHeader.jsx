import { useLang } from '../i18n/LangContext'

/**
 * Cabeçalho editorial do layout desktop (>900px): wordmark tipográfico com
 * régua grossa embaixo, slot à direita para o contexto da tela (chips,
 * contagens) e botão de voltar opcional.
 */
export default function DeskHeader({ onBack, right }) {
  const { t } = useLang()
  return (
    <header className="w-full shrink-0" style={{ borderBottom: '3px solid var(--color-text)' }}>
      <div className="max-w-[1280px] mx-auto px-8 pt-6 pb-4 flex items-end justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t('back')}
              className="flex items-center justify-center w-9 h-9 border-2 text-lg leading-none shrink-0"
              style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
            >
              ←
            </button>
          )}
          <span className="text-3xl font-black tracking-tight leading-none whitespace-nowrap">
            {t('app_name_1')}
            {t('app_name_2')}
          </span>
          <span
            className="hidden lg:block text-[10px] font-bold uppercase tracking-[0.22em] truncate self-end pb-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('tagline')}
          </span>
        </div>
        {right && <div className="flex items-center gap-3 shrink-0">{right}</div>}
      </div>
    </header>
  )
}
