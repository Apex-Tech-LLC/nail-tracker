import { PageHeader } from '../../app/PageHeader.tsx'
import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'

export function TodayPage() {
  const { locale } = useSettings()
  return (
    <>
      <PageHeader title={t(locale, 'appName')} />
      <p className="text-text-secondary">{t(locale, 'comingSoon')}</p>
    </>
  )
}
