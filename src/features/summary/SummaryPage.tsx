import { IconArrowDownRight, IconArrowUpRight, IconChevronLeft, IconEqual } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { PageHeader } from '../../app/PageHeader.tsx'
import { useSettings } from '../../app/settings.ts'
import { db, type Category } from '../../db/schema.ts'
import { t } from '../../lib/i18n.ts'
import { formatMonth, monthName, nextMonth, previousMonth, toCalendar, todayIso, type Calendar } from '../../lib/jalali.ts'
import type { Locale } from '../../lib/locale.ts'
import { formatAmount, formatPercent, formatToman } from '../../lib/money.ts'
import { CategoryIcon } from '../expenses/CategoryIcon.tsx'
import { loadMonthSummary, type CategoryTotal } from './monthSummary.ts'

export function SummaryPage() {
  const { locale, calendar } = useSettings()
  const current = toCalendar(todayIso(), calendar)
  // Null means "the current month", so switching calendars lands on it again.
  const [picked, setPicked] = useState<{ year: number; month: number; calendar: Calendar } | null>(null)
  const { year, month } = picked?.calendar === calendar ? picked : current
  const isCurrent = year === current.year && month === current.month

  const data = useLiveQuery(async () => {
    const [summary, categories] = await Promise.all([
      loadMonthSummary(db, year, month, calendar),
      db.categories.toArray(),
    ])
    return { summary, categories: new Map(categories.map((c) => [c.id, c])) }
  }, [year, month, calendar])

  function go(to: { year: number; month: number }) {
    setPicked({ ...to, calendar })
  }

  const label = formatMonth(year, month, locale, calendar)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t(locale, 'summaryTitle')} />

      <div className="flex items-center justify-between">
        <MonthButton label={t(locale, 'previousMonth')} onClick={() => go(previousMonth(year, month))} />
        <h2 className="text-sm font-medium" aria-live="polite">{label}</h2>
        <MonthButton
          label={t(locale, 'nextMonth')}
          onClick={() => go(nextMonth(year, month))}
          disabled={isCurrent}
          forward
        />
      </div>

      {data && (
        <>
          <section className="rounded-card bg-brand-50 p-3">
            <p className="text-xs text-brand-600">
              {t(locale, 'spentIn')} {label}
            </p>
            <p className="text-2xl font-medium text-brand-900">{formatToman(data.summary.total, locale)}</p>
            <Comparison
              total={data.summary.total}
              previousTotal={data.summary.previousTotal}
              previousName={monthName(previousMonth(year, month).month, locale, calendar)}
              locale={locale}
            />
          </section>

          {data.summary.byCategory.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">{t(locale, 'noExpensesInMonth')}</p>
          ) : (
            <CategoryChart totals={data.summary.byCategory} categories={data.categories} locale={locale} />
          )}
        </>
      )}
    </div>
  )
}

function MonthButton({
  label,
  onClick,
  disabled,
  forward,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  forward?: boolean
}) {
  // One chevron, mirrored for direction: back points to the start side,
  // forward to the end side, in both RTL and LTR.
  const flip = forward ? 'ltr:-scale-x-100' : 'rtl:-scale-x-100'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-control border border-border text-text-secondary disabled:opacity-35"
    >
      <IconChevronLeft size={20} aria-hidden="true" className={flip} />
    </button>
  )
}

/** "۱۲٪ more than Mehr", with an arrow so the direction is not color alone. */
function Comparison({
  total,
  previousTotal,
  previousName,
  locale,
}: {
  total: number
  previousTotal: number
  previousName: string
  locale: Locale
}) {
  if (!previousTotal || !total) return null
  const change = (total - previousTotal) / previousTotal
  const rounded = Math.round(Math.abs(change) * 100)

  let Icon = IconEqual
  let text = `${t(locale, 'sameAs')} ${previousName}`
  if (rounded > 0) {
    Icon = change > 0 ? IconArrowUpRight : IconArrowDownRight
    text = `${formatPercent(Math.abs(change), locale)} ${t(locale, change > 0 ? 'moreThan' : 'lessThan')} ${previousName}`
  }
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
      <Icon size={14} aria-hidden="true" className="rtl:-scale-x-100" />
      {text}
    </p>
  )
}

/**
 * Hand-drawn horizontal bars, one per category, scaled to the largest.
 * Every value is written next to its bar, so the SVG is decoration for
 * screen readers and the list carries the numbers.
 */
function CategoryChart({
  totals,
  categories,
  locale,
}: {
  totals: CategoryTotal[]
  categories: Map<string, Category>
  locale: Locale
}) {
  const max = totals[0]?.total ?? 0
  return (
    <section aria-labelledby="by-category">
      <h2 id="by-category" className="mb-2 text-xs text-text-secondary">
        {t(locale, 'byCategory')}
      </h2>
      <ul className="flex flex-col gap-3">
        {totals.map(({ categoryId, total, share }) => {
          const category = categories.get(categoryId)
          const width = max ? (total / max) * 100 : 0
          return (
            <li key={categoryId} className="flex items-center gap-3">
              <CategoryIcon name={category?.icon} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{category?.names[locale] ?? categoryId}</span>
                  {/* Separate flex items: as plain inline text the two numbers would
                      merge into one bidi run in RTL and lose the space between them. */}
                  <span className="flex flex-none items-baseline gap-1.5">
                    <span>{formatAmount(total, locale)}</span>
                    <span className="text-xs text-text-secondary">{formatPercent(share, locale)}</span>
                  </span>
                </div>
                <svg width="100%" height="8" aria-hidden="true" className="mt-1.5 block rtl:-scale-x-100">
                  <rect width={`${width}%`} height="8" rx="4" className="fill-brand-600" />
                  {/* Square off the baseline end, so only the data end is rounded. */}
                  {width > 2 && <rect width="4" height="8" className="fill-brand-600" />}
                </svg>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
