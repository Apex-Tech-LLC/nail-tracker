import { formatMonth, isoToJalali, todayIso } from '../lib/jalali.ts'
import { formatToman } from '../lib/money.ts'

// Placeholder shell that shows the design tokens with real formatting;
// routes and screens arrive with the M1 issues.
export default function App() {
  const { year, month } = isoToJalali(todayIso())

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">دفتر</h1>
      <section className="rounded-card bg-brand-50 p-3">
        <p className="text-xs text-brand-600">خرج {formatMonth(year, month, 'fa', 'jalali')}</p>
        <p className="text-2xl font-medium text-brand-900">{formatToman(4280000, 'fa')}</p>
      </section>
      <span className="self-start rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning-text">
        آفلاین
      </span>
      <button type="button" className="rounded-control bg-brand-600 p-2.5 font-medium text-white">
        ذخیره
      </button>
    </main>
  )
}
