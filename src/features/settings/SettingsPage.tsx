import { IconAlertTriangle, IconShieldCheck } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { PageHeader } from '../../app/PageHeader.tsx'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'
import type { Calendar } from '../../lib/jalali.ts'
import type { Locale } from '../../lib/locale.ts'
import { usePersistState } from '../../pwa/persistStorage.ts'

interface TileOption<T extends string> {
  value: T
  glyph: string
  label: string
  lang?: Locale
}

function TileGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string
  name: string
  value: T
  options: TileOption<T>[]
  onChange: (value: T) => void
}): ReactNode {
  return (
    <fieldset>
      <legend className="mb-2 text-xs text-text-secondary">{legend}</legend>
      <div className="flex gap-2">
        {options.map((option) => {
          const on = option.value === value
          return (
            <label
              key={option.value}
              lang={option.lang}
              className={`flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-card border p-3 has-focus-visible:outline-2 has-focus-visible:outline-brand-600 ${on ? 'border-brand-600 bg-brand-50' : 'border-border-strong bg-surface'}`}
            >
              <input type="radio" name={name} value={option.value} checked={on} onChange={() => onChange(option.value)} className="sr-only" />
              <span aria-hidden="true" className={`text-xl ${on ? 'text-brand-600' : 'text-text-secondary'}`}>
                {option.glyph}
              </span>
              <span className={`text-sm ${on ? 'text-brand-900' : ''}`}>{option.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function SettingsPage() {
  const { locale, calendar } = useSettings()

  return (
    <>
      <PageHeader title={t(locale, 'settingsTitle')} languageButton={false} />
      {/* Language names stay in their own script so anyone can find theirs. No flags. */}
      <TileGroup<Locale>
        legend={t(locale, 'language')}
        name="language"
        value={locale}
        onChange={(value) => updateSettings({ locale: value })}
        options={[
          { value: 'fa', glyph: 'ف', label: 'فارسی', lang: 'fa' },
          { value: 'en', glyph: 'Aa', label: 'English', lang: 'en' },
        ]}
      />
      <TileGroup<Calendar>
        legend={t(locale, 'calendar')}
        name="calendar"
        value={calendar}
        onChange={(value) => updateSettings({ calendar: value })}
        options={[
          { value: 'jalali', glyph: locale === 'fa' ? '۱۲ آبان' : '12 Aban', label: t(locale, 'jalali') },
          { value: 'gregorian', glyph: locale === 'fa' ? '۳ نوامبر' : '3 Nov', label: t(locale, 'gregorian') },
        ]}
      />
      <StorageStatus />
      <p className="mt-auto text-center text-xs text-text-muted" dir="ltr">
        {t(locale, 'version')} {__BUILD_ID__} · {__BUILD_DATE__}
      </p>
    </>
  )
}

function StorageStatus() {
  const { locale } = useSettings()
  const state = usePersistState()
  if (!state) return null
  const safe = state === 'persisted'
  const Icon = safe ? IconShieldCheck : IconAlertTriangle

  return (
    <section>
      <h2 className="mb-2 text-xs text-text-secondary">{t(locale, 'storage')}</h2>
      <div className="flex gap-3 rounded-card border border-border bg-surface p-3">
        <Icon size={20} aria-hidden="true" className={`mt-0.5 flex-none ${safe ? 'text-brand-600' : 'text-warning-text'}`} />
        <div>
          <p className="text-sm">{t(locale, safe ? 'storagePersisted' : 'storageAtRisk')}</p>
          <p className="text-xs text-text-secondary">{t(locale, safe ? 'storagePersistedHint' : 'storageAtRiskHint')}</p>
        </div>
      </div>
    </section>
  )
}
