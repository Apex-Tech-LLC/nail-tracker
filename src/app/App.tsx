import { useEffect } from 'react'
import { ExpenseList } from '../features/expenses/ExpenseList.tsx'
import { t } from '../lib/i18n.ts'
import { useSettings } from './settings.ts'

export default function App() {
  const { locale } = useSettings()

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr'
  }, [locale])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">{t(locale, 'appName')}</h1>
      <ExpenseList />
    </main>
  )
}
