import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'

// Placeholder until language, calendar and backup settings (#18, #24).
export function SettingsPage() {
  const { locale } = useSettings()
  return (
    <>
      <h1 className="text-lg font-medium">{t(locale, 'settingsTitle')}</h1>
      <p className="text-sm text-text-secondary">{t(locale, 'comingSoon')}</p>
    </>
  )
}
