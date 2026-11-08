import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { useLocation } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db } from '../../db/schema.ts'
import {
  formatDayShort,
  formatMonthShort,
  parseIsoDate,
  yearRange,
  type DateLocale,
  type IsoDate,
} from '../../domain/dates.ts'
import { formatUsd, parseRateBp, rateToInput } from '../../domain/money.ts'
import { setAsideCents, taxQuarterLines, taxYearSummary } from '../../domain/taxes.ts'
import { t, tf } from '../../lib/i18n.ts'
import { Row } from '../../ui/Row.tsx'
import { card, field, label, secondaryButton } from '../../ui/styles.ts'
import { download } from '../backup/backupFormat.ts'
import { loadRange } from '../turns/turnStore.ts'
import { taxCsv } from './taxCsv.ts'

const MIN_YEAR = 1900
const MAX_YEAR = 2200

function yearFromParam(param: string, fallback: number): number {
  const value = Number(param)
  return Number.isInteger(value) && value >= MIN_YEAR && value <= MAX_YEAR ? value : fallback
}

function quarterLabel(start: IsoDate, end: IsoDate, locale: DateLocale): string {
  return `${formatMonthShort(start, locale)}–${formatMonthShort(end, locale)}`
}

export function TaxesPage({ year: yearParam, onDone }: { year: string; onDone: () => void }) {
  const { locale, taxSetAsideBp } = useSettings()
  const today = useToday()
  const [, navigate] = useLocation()
  const percentId = useId()
  const [year, setYear] = useState(() => yearFromParam(yearParam, parseIsoDate(today).year))
  const [percentText, setPercentText] = useState(() =>
    taxSetAsideBp === null ? '' : rateToInput(taxSetAsideBp),
  )

  const data = useLiveQuery(async () => {
    const { start, end } = yearRange(`${year}-01-01`)
    const [range, payments] = await Promise.all([
      loadRange(db, start, end),
      db.payments.where('paymentDate').between(start, end, true, true).toArray(),
    ])
    return { turns: range.turns, adjustments: range.adjustments, payments }
  }, [year])

  if (data === undefined) return null

  const summary = taxYearSummary(year, data)
  const quarters = taxQuarterLines(year, data, taxSetAsideBp, today)

  function chooseYear(next: number) {
    if (next < MIN_YEAR || next > MAX_YEAR) return
    setYear(next)
    navigate(paths.taxes(next), { replace: true })
  }

  function changePercent(value: string) {
    setPercentText(value)
    if (value.trim() === '') {
      updateSettings({ taxSetAsideBp: null })
      return
    }
    const bp = parseRateBp(value)
    if (bp !== null) updateSettings({ taxSetAsideBp: bp })
  }

  function saveCsv() {
    download(taxCsv(year, summary), `nail-tracker-taxes-${year}.csv`, 'text/csv')
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDone}
          aria-label={t(locale, 'close')}
          className="print-hide flex min-h-11 min-w-11 items-center justify-center"
        >
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 text-center text-lg font-semibold">{t(locale, 'taxesTitle')}</h1>
        <span className="w-11" />
      </header>

      <p className="text-sm text-text-secondary">{t(locale, 'taxNotAdvice')}</p>

      <div className="print-hide flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={t(locale, 'previousPeriod')}
          onClick={() => chooseYear(year - 1)}
          className="rounded-control p-3"
        >
          <IconChevronLeft size={20} aria-hidden="true" />
        </button>
        <p className="min-w-0 text-center text-lg font-semibold tabular-nums">{year}</p>
        <button
          type="button"
          aria-label={t(locale, 'nextPeriod')}
          onClick={() => chooseYear(year + 1)}
          className="rounded-control p-3"
        >
          <IconChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <section className={card}>
        <h2 className="mb-2 text-base font-semibold">{t(locale, 'taxYearTotals')}</h2>
        <Row label={t(locale, 'taxPaidByCheck')} value={formatUsd(summary.checkCents)} />
        <Row label={t(locale, 'taxPaidByCash')} value={formatUsd(summary.cashCents)} />
        <Row label={t(locale, 'taxOtherPayments')} value={formatUsd(summary.otherCents)} />
        <Row label={t(locale, 'cashTips')} value={formatUsd(summary.totals.cashTipsCents)} />
        <Row label={t(locale, 'cardTips')} value={formatUsd(summary.totals.cardTipsCents)} />
        <Row label={t(locale, 'adjustments')} value={formatUsd(summary.totals.adjustmentsCents)} />
        <Row label={t(locale, 'totalEarned')} value={formatUsd(summary.totals.earnedCents)} strong />
      </section>

      <section className={card}>
        <h2 className="text-base font-semibold">{t(locale, 'taxTipsForYear')}</h2>
        <p data-testid="tax-tips" className="mt-1 text-3xl font-extrabold tabular-nums">
          {formatUsd(summary.totals.tipsCents)}
        </p>
        <p className="mt-2 text-sm text-text-secondary">{t(locale, 'taxTipDeductionNote')}</p>
      </section>

      <section className={card}>
        <h2 className="mb-2 text-base font-semibold">{t(locale, 'taxSetAside')}</h2>
        <div className="print-hide">
          <label htmlFor={percentId} className={label}>
            {t(locale, 'taxSetAsidePercent')}
          </label>
          <input
            id={percentId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={percentText}
            onChange={(event) => changePercent(event.target.value)}
            className={field}
          />
        </div>

        {taxSetAsideBp !== null && (
          <p data-testid="tax-set-aside" className="mt-3 text-lg font-bold">
            {tf(locale, 'taxSetAsideSoFar', {
              amount: formatUsd(setAsideCents(summary.totals.earnedCents, taxSetAsideBp)),
            })}
          </p>
        )}

        <ul className="mt-2 divide-y divide-border">
          {quarters.map((quarter) => (
            <li key={quarter.start} className="py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {quarterLabel(quarter.start, quarter.end, locale)}
                </span>
                <span className="tabular-nums">
                  {quarter.notStarted || quarter.amountCents === null
                    ? '—'
                    : formatUsd(quarter.amountCents)}
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                {tf(locale, 'taxQuarterDue', {
                  date: formatDayShort(quarter.dueDate, locale),
                })}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={saveCsv} className={secondaryButton}>
          {t(locale, 'taxSaveCsv')}
        </button>
        <button type="button" onClick={() => window.print()} className={secondaryButton}>
          {t(locale, 'taxPrint')}
        </button>
      </div>
    </>
  )
}
