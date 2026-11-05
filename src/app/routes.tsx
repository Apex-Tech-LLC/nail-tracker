import { Link, Route, Switch } from 'wouter'
import { EarningsPage } from '../features/earnings/EarningsPage.tsx'
import { HistoryPage } from '../features/history/HistoryPage.tsx'
import { PaydayPage } from '../features/payday/PaydayPage.tsx'
import { SettingsPage } from '../features/settings/SettingsPage.tsx'
import { TodayPage } from '../features/today/TodayPage.tsx'
import { t } from '../lib/i18n.ts'
import { paths } from './navigation.ts'
import { useSettings } from './settings.ts'

export function Routes() {
  const { locale } = useSettings()

  return (
    <Switch>
      <Route path={paths.today} component={TodayPage} />
      <Route path={paths.history} component={HistoryPage} />
      <Route path={paths.earnings} component={EarningsPage} />
      <Route path={paths.payday} component={PaydayPage} />
      <Route path={paths.settings} component={SettingsPage} />
      <Route>
        <p>{t(locale, 'notFound')}</p>
        <Link href={paths.today} replace className="text-brand-600 underline">
          {t(locale, 'backToToday')}
        </Link>
      </Route>
    </Switch>
  )
}
