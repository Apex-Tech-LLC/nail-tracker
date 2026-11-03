import { IconNotebook, IconPlus, IconWifiOff } from '@tabler/icons-react'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: 'fa', label: 'فارسی' },
  { value: 'en', label: 'English' },
]

/**
 * First run, before any expense exists. Doubles as the language picker so
 * there is no separate setup screen between opening the app and using it.
 */
export function Welcome({ onAdd }: { onAdd: () => void }) {
  const { locale } = useSettings()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-[20px] bg-brand-50 text-brand-600">
        <IconNotebook size={30} aria-hidden="true" />
      </span>
      {/* key restarts the fade when the language changes. */}
      <p key={locale} className="animate-fade-in text-4xl font-medium text-brand-600">
        {t(locale, 'hello')}
      </p>
      <p className="max-w-60 text-sm text-text-secondary">{t(locale, 'welcomeBody')}</p>

      <div role="group" aria-label={t(locale, 'language')} className="flex w-56 rounded-2xl bg-surface-subtle p-1">
        {LANGUAGES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            lang={value}
            aria-pressed={locale === value}
            onClick={() => updateSettings({ locale: value })}
            className={`flex-1 rounded-xl py-2 text-sm transition-colors ${locale === value ? 'bg-brand-600 text-white' : 'text-text-secondary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <button type="button" onClick={onAdd} className="mt-2 flex items-center gap-1.5 rounded-control bg-brand-600 px-5 py-3 font-medium text-white">
        <IconPlus size={18} aria-hidden="true" />
        {t(locale, 'addFirstExpense')}
      </button>
      <p className="flex items-center gap-1 text-xs text-text-muted">
        <IconWifiOff size={14} aria-hidden="true" />
        {t(locale, 'worksOffline')}
      </p>

      {import.meta.env.DEV && (
        <button
          type="button"
          className="mt-4 rounded-control border border-border-strong px-3 py-2 text-xs text-text-secondary"
          onClick={() => import('../../db/devSamples.ts').then((m) => m.addSampleExpenses())}
        >
          {t(locale, 'addSampleData')}
        </button>
      )}
    </div>
  )
}
