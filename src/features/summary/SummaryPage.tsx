import { PageHeader } from '../../app/LanguageButton.tsx'
import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'

// Placeholder until the monthly summary in #17.
export function SummaryPage() {
  const { locale } = useSettings()
  return (
    <>
      <PageHeader title={t(locale, 'summaryTitle')} />
      <p className="text-sm text-text-secondary">{t(locale, 'comingSoon')}</p>
    </>
  )
}
