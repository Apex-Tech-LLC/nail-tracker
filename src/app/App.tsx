import { useEffect, useState } from 'react'
import { ExpenseForm } from '../features/expenses/ExpenseForm.tsx'
import { ExpenseList } from '../features/expenses/ExpenseList.tsx'
import { t } from '../lib/i18n.ts'
import { useSettings } from './settings.ts'

// Which screen is open. A plain state for now; routes arrive with #9.
type View = { name: 'list' } | { name: 'form'; expenseId?: string }

export default function App() {
  const { locale } = useSettings()
  const [view, setView] = useState<View>({ name: 'list' })

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr'
  }, [locale])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      {view.name === 'form' ? (
        <ExpenseForm expenseId={view.expenseId} onDone={() => setView({ name: 'list' })} />
      ) : (
        <>
          <h1 className="text-lg font-medium">{t(locale, 'appName')}</h1>
          <ExpenseList onAdd={() => setView({ name: 'form' })} onEdit={(expenseId) => setView({ name: 'form', expenseId })} />
        </>
      )}
    </main>
  )
}
