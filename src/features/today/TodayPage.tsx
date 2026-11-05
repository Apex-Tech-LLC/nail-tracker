import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { PageHeader } from '../../app/PageHeader.tsx'
import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'
import { primaryButton } from '../../ui/styles.ts'

export function TodayPage() {
  const { locale } = useSettings()
  return (
    <>
      <PageHeader title={t(locale, 'appName')} />
      <p className="text-text-secondary">{t(locale, 'comingSoon')}</p>
      <Link href={paths.add} className={`${primaryButton} block text-center`}>
        {t(locale, 'addTurn')}
      </Link>
    </>
  )
}
