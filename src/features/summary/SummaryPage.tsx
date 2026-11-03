import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'

// Placeholder until the monthly summary in #17.
export function SummaryPage() {
  const { locale } = useSettings()
  return (
    <>
      <h1 className="text-lg font-medium">{t(locale, 'summaryTitle')}</h1>
      <p className="text-sm text-text-secondary">{t(locale, 'comingSoon')}</p>
    </>
  )
}
