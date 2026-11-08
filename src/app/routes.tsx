import { Link, Route, Switch, useLocation } from 'wouter'
import { AdjustmentForm } from '../features/adjustments/AdjustmentForm.tsx'
import { ReportsPage } from '../features/reports/ReportsPage.tsx'
import { HistoryPage } from '../features/history/HistoryPage.tsx'
import { HomePage } from '../features/home/HomePage.tsx'
import { OnboardingPage } from '../features/onboarding/OnboardingPage.tsx'
import { PaydayPage } from '../features/payday/PaydayPage.tsx'
import { PaymentForm } from '../features/payday/PaymentForm.tsx'
import { PeriodPage } from '../features/payday/PeriodPage.tsx'
import { RecordWhatYouGotForm } from '../features/paycheck/RecordWhatYouGotForm.tsx'
import { PayRulesPage } from '../features/payRules/PayRulesPage.tsx'
import { PresetsPage } from '../features/presets/PresetsPage.tsx'
import { GoalsPage } from '../features/settings/GoalsPage.tsx'
import { SettingsPage } from '../features/settings/SettingsPage.tsx'
import { TaxesPage } from '../features/taxes/TaxesPage.tsx'
import { TurnForm } from '../features/turns/TurnForm.tsx'
import { t } from '../lib/i18n.ts'
import { paths, useGoBack } from './navigation.ts'
import { useSettings } from './settings.ts'

export function Routes() {
  const { locale } = useSettings()
  const goBack = useGoBack()
  const [, navigate] = useLocation()

  return (
    <Switch>
      <Route path={paths.today} component={HomePage} />
      <Route path={paths.history} component={HistoryPage} />
      <Route path={paths.earnings} component={ReportsPage} />
      <Route path={paths.payday} component={PaydayPage} />
      <Route path="/payday/:periodId/pay">
        {(params) => (
          <PaymentForm key={params.periodId} periodId={params.periodId} onDone={goBack} />
        )}
      </Route>
      <Route path="/payday/:periodId/record">
        {(params) => (
          <RecordWhatYouGotForm
            key={params.periodId}
            periodId={params.periodId}
            onDone={goBack}
          />
        )}
      </Route>
      <Route path="/payment/:id">
        {(params) => (
          <PaymentForm key={params.id} paymentId={params.id} onDone={goBack} />
        )}
      </Route>
      <Route path="/payday/:periodId">
        {(params) => (
          <PeriodPage key={params.periodId} periodId={params.periodId} onDone={goBack} />
        )}
      </Route>
      <Route path={paths.services}>{() => <PresetsPage onDone={goBack} />}</Route>
      <Route path={paths.payRules}>{() => <PayRulesPage onDone={goBack} />}</Route>
      <Route path={paths.goals}>{() => <GoalsPage onDone={goBack} />}</Route>
      <Route path="/taxes/:year">
        {(params) => <TaxesPage year={params.year} onDone={goBack} />}
      </Route>
      <Route path={paths.settings} component={SettingsPage} />
      <Route path={paths.onboarding} component={OnboardingPage} />
      <Route path={paths.add}>{() => <TurnForm onDone={goBack} />}</Route>
      <Route path="/edit/:id">
        {(params) => <TurnForm key={params.id} turnId={params.id} onDone={goBack} />}
      </Route>
      <Route path="/copy/:id">
        {(params) => (
          <TurnForm
            key={`copy-${params.id}`}
            copyId={params.id}
            onDone={() => navigate(paths.today, { replace: true })}
            onClose={goBack}
          />
        )}
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
