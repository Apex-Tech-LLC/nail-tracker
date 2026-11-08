import type { TaxYearSummary } from '../../domain/taxes.ts'
import { formatMonthShort } from '../../domain/dates.ts'
import { t, type StringKey } from '../../lib/i18n.ts'
import { BOM, csvCell, moneyCell } from '../backup/exportCsv.ts'

/** An English term with the Vietnamese one beside it, so the preparer and the technician both read it. */
function bilingual(key: StringKey): string {
  return csvCell(`${t('en', key)} (${t('vi', key)})`)
}

const TOTAL_ROWS: { key: StringKey; value: (summary: TaxYearSummary) => number }[] = [
  { key: 'taxPaidByCheck', value: (summary) => summary.checkCents },
  { key: 'taxPaidByCash', value: (summary) => summary.cashCents },
  { key: 'taxOtherPayments', value: (summary) => summary.otherCents },
  { key: 'cashTips', value: (summary) => summary.totals.cashTipsCents },
  { key: 'cardTips', value: (summary) => summary.totals.cardTipsCents },
  { key: 'totalTips', value: (summary) => summary.totals.tipsCents },
  { key: 'adjustments', value: (summary) => summary.totals.adjustmentsCents },
  { key: 'totalEarned', value: (summary) => summary.totals.earnedCents },
]

const MONTH_HEADER: StringKey[] = [
  'periodMonth',
  'totalEarned',
  'cashTips',
  'cardTips',
  'methodCheck',
  'methodCash',
  'taxOtherPayments',
  'adjustments',
]

function monthName(year: number, month: number): string {
  return formatMonthShort(`${year}-${String(month).padStart(2, '0')}-01`, 'en')
}

/**
 * The year summary as a spreadsheet file: one row per total, then one row per
 * month. English with the Vietnamese term beside each one; money is plain
 * digits so formulas can add it up.
 */
export function taxCsv(year: number, summary: TaxYearSummary): string {
  const totals = TOTAL_ROWS.map(({ key, value }) => [bilingual(key), moneyCell(value(summary))])
  const monthRows = summary.months.map((line) => [
    csvCell(monthName(year, line.month)),
    moneyCell(line.earnedCents),
    moneyCell(line.cashTipsCents),
    moneyCell(line.cardTipsCents),
    moneyCell(line.checkCents),
    moneyCell(line.cashCents),
    moneyCell(line.otherCents),
    moneyCell(line.adjustmentsCents),
  ])

  return (
    BOM +
    [totals, [MONTH_HEADER.map(bilingual)], monthRows]
      .flat()
      .map((row) => row.join(','))
      .join('\r\n') +
    '\r\n'
  )
}
