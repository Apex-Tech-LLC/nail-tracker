import { IconWorld } from '@tabler/icons-react'
import { t } from '../lib/i18n.ts'
import { OfflineBadge } from '../pwa/OfflineBadge.tsx'
import { updateSettings, useSettings } from './settings.ts'

/** One tap to the other language, for when detection guessed wrong. */
export function LanguageButton() {
  const { locale } = useSettings()
  const other = locale === 'fa' ? 'en' : 'fa'
  return (
    <button
      type="button"
      onClick={() => updateSettings({ locale: other })}
      aria-label={t(locale, 'switchLanguage')}
      lang={other}
      className="flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-xs"
    >
      <IconWorld size={16} aria-hidden="true" />
      <span className="font-medium">{t(locale, 'otherLanguageShort')}</span>
    </button>
  )
}

/** Title, offline badge and (unless the page has its own picker) the language button. */
export function PageHeader({ title, languageButton = true }: { title: string; languageButton?: boolean }) {
  return (
    <header className="flex items-center justify-between gap-2">
      <h1 className="text-lg font-medium">{title}</h1>
      <div className="flex items-center gap-2">
        <OfflineBadge />
        {languageButton && <LanguageButton />}
      </div>
    </header>
  )
}
