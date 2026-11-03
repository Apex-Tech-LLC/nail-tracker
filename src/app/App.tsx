import { useCallback, useEffect, useState } from 'react'
import { db, type Expense } from '../db/schema.ts'
import { ExpenseForm } from '../features/expenses/ExpenseForm.tsx'
import { ExpenseList } from '../features/expenses/ExpenseList.tsx'
import { restoreExpense } from '../features/expenses/expenseStore.ts'
import { UndoToast } from '../features/expenses/UndoToast.tsx'
import { t } from '../lib/i18n.ts'
import { useSettings } from './settings.ts'

// Which screen is open. A plain state for now; routes arrive with #9.
type View = { name: 'list' } | { name: 'form'; expenseId?: string }

export default function App() {
  const { locale } = useSettings()
  const [view, setView] = useState<View>({ name: 'list' })
  // The last deleted expense, kept only while its undo toast is showing.
  const [deleted, setDeleted] = useState<Expense | null>(null)
  const closeToast = useCallback(() => setDeleted(null), [])

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr'
  }, [locale])

  async function undo() {
    if (!deleted) return
    setDeleted(null)
    await restoreExpense(db, deleted)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      {view.name === 'form' ? (
        <ExpenseForm
          expenseId={view.expenseId}
          onDone={() => setView({ name: 'list' })}
          onDeleted={(expense) => {
            setDeleted(expense)
            setView({ name: 'list' })
          }}
        />
      ) : (
        <>
          <h1 className="text-lg font-medium">{t(locale, 'appName')}</h1>
          <ExpenseList onAdd={() => setView({ name: 'form' })} onEdit={(expenseId) => setView({ name: 'form', expenseId })} />
        </>
      )}
      {/* Always mounted, so screen readers announce the toast when it appears. */}
      <div role="status">
        {deleted && view.name === 'list' && <UndoToast key={deleted.id} onUndo={undo} onClose={closeToast} />}
      </div>
    </main>
  )
}
