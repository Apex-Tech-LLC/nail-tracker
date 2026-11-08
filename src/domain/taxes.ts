// Taxes maths. Plain TypeScript: no React, no Dexie. Money is whole cents;
// a set-aside percent is whole basis points, rounded half up.

import { parseIsoDate, yearRange, type IsoDate } from './dates.ts'
import { roundDiv } from './money.ts'
import { sumTotals, type DatedAdjustment, type Totals, type TurnFigures } from './totals.ts'

export interface TaxQuarter {
  start: IsoDate
  end: IsoDate
  dueDate: IsoDate
}

export type TaxPaymentMethod = 'cash' | 'check' | 'directDeposit' | 'zelle' | 'other'

export interface DatedPayment {
  paymentDate: IsoDate
  amountCents: number
  paymentMethod: TaxPaymentMethod
}

export interface TaxYearFigures {
  turns: readonly TurnFigures[]
  adjustments: readonly DatedAdjustment[]
  payments: readonly DatedPayment[]
}

export interface TaxMonthLine {
  month: number // 1 to 12
  earnedCents: number
  cashTipsCents: number
  cardTipsCents: number
  checkCents: number
  cashCents: number
  otherCents: number
  adjustmentsCents: number
}

export interface TaxYearSummary {
  totals: Totals
  checkCents: number
  cashCents: number
  otherCents: number
  months: TaxMonthLine[]
}

export interface TaxQuarterLine extends TaxQuarter {
  notStarted: boolean
  amountCents: number | null
}

const pad = (n: number) => String(n).padStart(2, '0')

function isoDay(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * The four US estimated-tax periods for a year. They are not equal: the second
 * covers two months and the third three. The last one is due in January of the
 * next year.
 */
export function taxQuarters(year: number): TaxQuarter[] {
  return [
    { start: isoDay(year, 1, 1), end: isoDay(year, 3, 31), dueDate: isoDay(year, 4, 15) },
    { start: isoDay(year, 4, 1), end: isoDay(year, 5, 31), dueDate: isoDay(year, 6, 15) },
    { start: isoDay(year, 6, 1), end: isoDay(year, 8, 31), dueDate: isoDay(year, 9, 15) },
    { start: isoDay(year, 9, 1), end: isoDay(year, 12, 31), dueDate: isoDay(year + 1, 1, 15) },
  ]
}

/**
 * The next due date that is not past, with the quarter it belongs to. On
 * January 5 this is January 15 for last year's September to December.
 */
export function nextTaxQuarter(today: IsoDate): TaxQuarter | null {
  const { year } = parseIsoDate(today)
  let next: TaxQuarter | null = null
  for (const quarter of [...taxQuarters(year - 1), ...taxQuarters(year)]) {
    if (quarter.dueDate < today) continue
    if (next === null || quarter.dueDate < next.dueDate) next = quarter
  }
  return next
}

/** The part of the earned money to keep for taxes, rounded half up. */
export function setAsideCents(earnedCents: number, bp: number): number {
  return roundDiv(earnedCents * bp, 10_000)
}

function emptyMonth(month: number): TaxMonthLine {
  return {
    month,
    earnedCents: 0,
    cashTipsCents: 0,
    cardTipsCents: 0,
    checkCents: 0,
    cashCents: 0,
    otherCents: 0,
    adjustmentsCents: 0,
  }
}

function monthOf(date: IsoDate): number {
  return parseIsoDate(date).month
}

/**
 * The year's totals by kind, its payments by method (Zelle, direct deposit and
 * anything else sit under other) and one line per month. Figures outside the
 * year are ignored, so a wider read cannot move a total.
 */
export function taxYearSummary(year: number, figures: TaxYearFigures): TaxYearSummary {
  const { start, end } = yearRange(isoDay(year, 1, 1))
  const turns = figures.turns.filter(
    (turn) => turn.localWorkDate >= start && turn.localWorkDate <= end,
  )
  const adjustments = figures.adjustments.filter(
    (adjustment) => adjustment.localWorkDate >= start && adjustment.localWorkDate <= end,
  )
  const payments = figures.payments.filter(
    (payment) => payment.paymentDate >= start && payment.paymentDate <= end,
  )

  const months = Array.from({ length: 12 }, (_, index) => emptyMonth(index + 1))
  let checkCents = 0
  let cashCents = 0
  let otherCents = 0

  for (const turn of turns) {
    const line = months[monthOf(turn.localWorkDate) - 1]
    const tips = turn.cashTipCents + turn.cardTipCents
    line.earnedCents += turn.commissionTotalCents + tips
    line.cashTipsCents += turn.cashTipCents
    line.cardTipsCents += turn.cardTipCents
  }

  for (const adjustment of adjustments) {
    const line = months[monthOf(adjustment.localWorkDate) - 1]
    line.earnedCents += adjustment.amountCents
    line.adjustmentsCents += adjustment.amountCents
  }

  for (const payment of payments) {
    const line = months[monthOf(payment.paymentDate) - 1]
    if (payment.paymentMethod === 'check') {
      checkCents += payment.amountCents
      line.checkCents += payment.amountCents
    } else if (payment.paymentMethod === 'cash') {
      cashCents += payment.amountCents
      line.cashCents += payment.amountCents
    } else {
      otherCents += payment.amountCents
      line.otherCents += payment.amountCents
    }
  }

  return {
    totals: sumTotals(turns, adjustments),
    checkCents,
    cashCents,
    otherCents,
    months,
  }
}

/**
 * Each quarter with the amount to set aside from that quarter's earned money.
 * A quarter that has not started yet (and so has earned nothing) shows no
 * amount. With no percent set every started quarter also shows no amount.
 */
export function taxQuarterLines(
  year: number,
  figures: TaxYearFigures,
  bp: number | null,
  today: IsoDate,
): TaxQuarterLine[] {
  return taxQuarters(year).map((quarter) => {
    if (quarter.start > today) return { ...quarter, notStarted: true, amountCents: null }

    const turns = figures.turns.filter(
      (turn) => turn.localWorkDate >= quarter.start && turn.localWorkDate <= quarter.end,
    )
    const adjustments = figures.adjustments.filter(
      (adjustment) =>
        adjustment.localWorkDate >= quarter.start && adjustment.localWorkDate <= quarter.end,
    )
    const earnedCents = sumTotals(turns, adjustments).earnedCents

    return {
      ...quarter,
      notStarted: false,
      amountCents: bp === null ? null : setAsideCents(earnedCents, bp),
    }
  })
}
