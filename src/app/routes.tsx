import { Link, Route, Switch } from 'wouter'
import type { Expense } from '../db/schema.ts'
import { ExpenseForm } from '../features/expenses/ExpenseForm.tsx'
import { ExpenseList } from '../features/expenses/ExpenseList.tsx'
import { SettingsPage } from '../features/settings/SettingsPage.tsx'
import { SummaryPage } from '../features/summary/SummaryPage.tsx'
import { t } from '../lib/i18n.ts'
import { PageHeader } from './PageHeader.tsx'
import { paths, useGoBack, useNavigate } from './navigation.ts'
import { useSettings } from './settings.ts'

interface Props {
  onDeleted: (expense: Expense) => void
}

/** List, add, edit, summary and settings. */
export function Routes({ onDeleted }: Props) {
  const { locale } = useSettings()
  const navigate = useNavigate()
  const goBack = useGoBack()

  function deletedAndBack(expense: Expense) {
    onDeleted(expense)
    goBack()
  }

  return (
    <Switch>
      <Route path={paths.list}>
        <PageHeader title={t(locale, 'appName')} />
        <ExpenseList onAdd={() => navigate(paths.add)} onEdit={(id) => navigate(paths.edit(id))} />
      </Route>
      <Route path={paths.add}>
        <ExpenseForm onDone={goBack} onDeleted={deletedAndBack} />
      </Route>
      <Route path="/edit/:id">
        {(params) => <ExpenseForm key={params.id} expenseId={params.id} onDone={goBack} onDeleted={deletedAndBack} />}
      </Route>
      <Route path={paths.summary} component={SummaryPage} />
      <Route path={paths.settings} component={SettingsPage} />
      <Route>
        <p>{t(locale, 'notFound')}</p>
        <Link href={paths.list} replace className="text-brand-600 underline">
          {t(locale, 'backToList')}
        </Link>
      </Route>
    </Switch>
  )
}
