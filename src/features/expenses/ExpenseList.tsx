import { IconPlus } from '@tabler/icons-react'
import { useSettings } from '../../app/settings.ts'
import { Welcome } from './Welcome.tsx'
import { addDays, formatDate, formatMonth, toCalendar, todayIso } from '../../lib/jalali.ts'
import { t } from '../../lib/i18n.ts'
import { formatAmount, formatToman } from '../../lib/money.ts'
import { CategoryIcon } from './CategoryIcon.tsx'
import { groupByDay, sumAmounts } from './groupByDay.ts'
import { useMonthExpenses } from './useExpenses.ts'

interface Props {
  onAdd: () => void
  onEdit: (id: string) => void
}

export function ExpenseList({ onAdd, onEdit }: Props) {
  const { locale, calendar } = useSettings()
  const today = todayIso()
  const { year, month } = toCalendar(today, calendar)
  const data = useMonthExpenses(year, month, calendar)

  if (!data) return null
  if (data.totalCount === 0) return <Welcome onAdd={onAdd} />

  const days = groupByDay(data.expenses)

  function dayLabel(date: string) {
    const label = formatDate(date, locale, calendar, { year: false })
    if (date === today) return `${t(locale, 'today')} · ${label}`
    if (date === addDays(today, -1)) return `${t(locale, 'yesterday')} · ${label}`
    return label
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <section className="rounded-card bg-brand-50 p-3">
        <p className="text-xs text-brand-600">
          {t(locale, 'spentIn')} {formatMonth(year, month, locale, calendar)}
        </p>
        <p className="text-2xl font-medium text-brand-900">{formatToman(sumAmounts(data.expenses), locale)}</p>
      </section>

      {days.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-secondary">{t(locale, 'noExpensesThisMonth')}</p>
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
                  <li key={expense.id} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() => onEdit(expense.id)}
                      className="flex w-full items-center gap-3 py-2.5 text-start"
                    >
                      <CategoryIcon name={category?.icon} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{category?.names[locale] ?? expense.categoryId}</span>
                        {expense.note && <span className="block truncate text-xs text-text-secondary">{expense.note}</span>}
                      </span>
                      <span className="text-sm">{formatAmount(expense.amount, locale)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      <button
        type="button"
        onClick={onAdd}
        aria-label={t(locale, 'addExpense')}
        className="fixed bottom-20 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg end-[max(1.5rem,calc(50vw-14rem+1.5rem))]"
      >
        <IconPlus size={26} aria-hidden="true" />
      </button>
    </div>
  )
}
