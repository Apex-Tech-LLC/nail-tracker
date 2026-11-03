import { useSettings } from '../../app/settings.ts'
import { formatDate, formatMonth, toCalendar, todayIso } from '../../lib/jalali.ts'
import { t } from '../../lib/i18n.ts'
import { formatAmount, formatToman } from '../../lib/money.ts'
import { CategoryIcon } from './CategoryIcon.tsx'
import { groupByDay, sumAmounts } from './groupByDay.ts'
import { useMonthExpenses } from './useExpenses.ts'

function yesterdayIso(today: string): string {
  const date = new Date(`${today}T12:00:00`)
  date.setDate(date.getDate() - 1)
  return todayIso(date)
}

export function ExpenseList() {
  const { locale, calendar } = useSettings()
  const today = todayIso()
  const { year, month } = toCalendar(today, calendar)
  const data = useMonthExpenses(year, month, calendar)

  if (!data) return null

  const days = groupByDay(data.expenses)

  function dayLabel(date: string) {
    const label = formatDate(date, locale, calendar, { year: false })
    if (date === today) return `${t(locale, 'today')} · ${label}`
    if (date === yesterdayIso(today)) return `${t(locale, 'yesterday')} · ${label}`
    return label
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card bg-brand-50 p-3">
        <p className="text-xs text-brand-600">
          {t(locale, 'spentIn')} {formatMonth(year, month, locale, calendar)}
        </p>
        <p className="text-2xl font-medium text-brand-900">{formatToman(sumAmounts(data.expenses), locale)}</p>
      </section>

      {days.length === 0 ? (
        <EmptyList />
      ) : (
        days.map((day) => (
          <section key={day.date} aria-label={dayLabel(day.date)}>
            <h2 className="flex justify-between text-xs text-text-secondary">
              <span>{dayLabel(day.date)}</span>
              <span>{formatAmount(day.total, locale)}</span>
            </h2>
            <ul>
              {day.expenses.map((expense) => {
                const category = data.categories.get(expense.categoryId)
                return (
                  <li key={expense.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                    <CategoryIcon name={category?.icon} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{category?.names[locale] ?? expense.categoryId}</p>
                      {expense.note && <p className="truncate text-xs text-text-secondary">{expense.note}</p>}
                    </div>
                    <span className="text-sm">{formatAmount(expense.amount, locale)}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

function EmptyList() {
  const { locale } = useSettings()
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-medium">{t(locale, 'emptyTitle')}</p>
      <p className="text-sm text-text-secondary">{t(locale, 'emptyBody')}</p>
      {import.meta.env.DEV && (
        <button
          type="button"
          className="mt-4 rounded-control border border-border-strong px-3 py-2 text-xs text-text-secondary"
          onClick={() => import('../../db/devSamples.ts').then((m) => m.addSampleExpenses())}
        >
          {t(locale, 'addSampleData')}
        </button>
      )}
    </div>
  )
}
