import { useCallback, useState } from 'react'
import { Router, useLocation } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { db, type Expense } from '../db/schema.ts'
import { restoreExpense } from '../features/expenses/expenseStore.ts'
import { UndoToast } from '../features/expenses/UndoToast.tsx'
import { UpdatePrompt } from '../pwa/UpdatePrompt.tsx'
import { BottomNav } from './BottomNav.tsx'
import { paths } from './navigation.ts'
import { Routes } from './routes.tsx'

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell />
    </Router>
  )
}

const TAB_PATHS: string[] = [paths.list, paths.summary, paths.settings]

function Shell() {
  const [location] = useLocation()
  // The last deleted expense, kept only while its undo toast is showing.
  const [deleted, setDeleted] = useState<Expense | null>(null)
  const closeToast = useCallback(() => setDeleted(null), [])
  const onTab = TAB_PATHS.includes(location)

  async function undo() {
    if (!deleted) return
    setDeleted(null)
    await restoreExpense(db, deleted)
  }

  return (
    <>
      <main className={`mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 ${onTab ? 'pb-24' : ''}`}>
        {/* Mounted on every screen to keep the worker registered; shown only on the tabs, never over the form. */}
        <UpdatePrompt visible={onTab} />
        <Routes onDeleted={setDeleted} />
      </main>
      {/* The form is a focused task: no tabs while it is open. */}
      {onTab && <BottomNav />}
      {/* Always mounted, so screen readers announce the toast when it appears. */}
      <div role="status">
        {deleted && location === paths.list && <UndoToast key={deleted.id} onUndo={undo} onClose={closeToast} />}
      </div>
    </>
  )
}
