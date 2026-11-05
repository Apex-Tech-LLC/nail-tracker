import { Link, Route, Switch } from 'wouter'
import { AdjustmentForm } from '../features/adjustments/AdjustmentForm.tsx'
import { EarningsPage } from '../features/earnings/EarningsPage.tsx'
import { HistoryPage } from '../features/history/HistoryPage.tsx'
import { PaydayPage } from '../features/payday/PaydayPage.tsx'
import { PresetsPage } from '../features/presets/PresetsPage.tsx'
import { SettingsPage } from '../features/settings/SettingsPage.tsx'
import { TodayPage } from '../features/today/TodayPage.tsx'
import { TurnForm } from '../features/turns/TurnForm.tsx'
import { t } from '../lib/i18n.ts'
import { paths, useGoBack } from './navigation.ts'
import { useSettings } from './settings.ts'

export function Routes() {
  const { locale } = useSettings()
  const goBack = useGoBack()

  return (
    <Switch>
      <Route path={paths.today} component={TodayPage} />
      <Route path={paths.history} component={HistoryPage} />
      <Route path={paths.earnings} component={EarningsPage} />
      <Route path={paths.payday} component={PaydayPage} />
      <Route path={paths.services}>{() => <PresetsPage onDone={goBack} />}</Route>
      <Route path={paths.settings} component={SettingsPage} />
      <Route path={paths.add}>{() => <TurnForm onDone={goBack} />}</Route>
      <Route path="/edit/:id">
        {(params) => <TurnForm key={params.id} turnId={params.id} onDone={goBack} />}
      </Route>
      <Route path={paths.adjustmentNew}>{() => <AdjustmentForm onDone={goBack} />}</Route>
      <Route path="/adjustment/:id">
        {(params) => (
          <AdjustmentForm key={params.id} adjustmentId={params.id} onDone={goBack} />
        )}
      </Route>
      <Route>
        <p>{t(locale, 'notFound')}</p>
        <Link href={paths.today} replace className="text-brand-600 underline">
          {t(locale, 'backToToday')}
        </Link>
      </Route>
    </Switch>
  )
}
