import { describe, expect, it } from 'vitest'
import type { DatedAdjustment, TurnFigures } from '../../src/domain/totals.ts'
import {
  nextTaxQuarter,
  setAsideCents,
  taxQuarterLines,
  taxQuarters,
  taxYearSummary,
  type TaxYearFigures,
} from '../../src/domain/taxes.ts'

const turn = (overrides: Partial<TurnFigures> = {}): TurnFigures => ({
  localWorkDate: '2026-11-04',
  turnCount: 1,
  serviceRevenueTotalCents: 0,
  commissionTotalCents: 0,
  cashTipCents: 0,
  cardTipCents: 0,
  cashTipReceived: true,
  cardTipReceived: false,
  ...overrides,
})

const adjustment = (
  localWorkDate: string,
  amountCents: number,
  category: DatedAdjustment['category'] = 'bonus',
): DatedAdjustment => ({ localWorkDate, amountCents, category })

const figures = (overrides: Partial<TaxYearFigures> = {}): TaxYearFigures => ({
  turns: [],
  adjustments: [],
  payments: [],
  ...overrides,
})

describe('taxQuarters', () => {
  it('gives the four unequal US estimated-tax periods and their due dates', () => {
    expect(taxQuarters(2026)).toEqual([
      { start: '2026-01-01', end: '2026-03-31', dueDate: '2026-04-15' },
      { start: '2026-04-01', end: '2026-05-31', dueDate: '2026-06-15' },
      { start: '2026-06-01', end: '2026-08-31', dueDate: '2026-09-15' },
      { start: '2026-09-01', end: '2026-12-31', dueDate: '2027-01-15' },
    ])
  })
})

describe('nextTaxQuarter', () => {
  it('still points at January 15 for last year on January 5', () => {
    expect(nextTaxQuarter('2027-01-05')).toEqual({
      start: '2026-09-01',
      end: '2026-12-31',
      dueDate: '2027-01-15',
    })
  })

  it('is today when the due date is today, and moves on the next day', () => {
    expect(nextTaxQuarter('2026-04-15')?.dueDate).toBe('2026-04-15')
    expect(nextTaxQuarter('2026-04-16')).toEqual({
      start: '2026-04-01',
      end: '2026-05-31',
      dueDate: '2026-06-15',
    })
  })

  it('is January 15 of the next year at the end of December', () => {
    expect(nextTaxQuarter('2026-12-20')?.dueDate).toBe('2027-01-15')
  })
})

describe('setAsideCents', () => {
  it('20% of $40,000 is $8,000', () => {
    expect(setAsideCents(4_000_000, 2000)).toBe(800_000)
  })

  it('rounds half up to the cent', () => {
    // $0.05 × 50% is 2.5 cents, so it rounds to 3.
    expect(setAsideCents(5, 5000)).toBe(3)
  })
})

describe('taxYearSummary', () => {
  it('$9,600 card and $7,200 cash tips are $16,800 for the year', () => {
    const summary = taxYearSummary(
      2026,
      figures({ turns: [turn({ cardTipCents: 960_000, cashTipCents: 720_000 })] }),
    )
    expect(summary.totals.cardTipsCents).toBe(960_000)
    expect(summary.totals.cashTipsCents).toBe(720_000)
    expect(summary.totals.tipsCents).toBe(1_680_000)
  })

  it('groups payments by method, with Zelle and direct deposit under other', () => {
    const summary = taxYearSummary(
      2026,
      figures({
        payments: [
          { paymentDate: '2026-01-10', amountCents: 100_000, paymentMethod: 'check' },
          { paymentDate: '2026-02-10', amountCents: 50_000, paymentMethod: 'cash' },
          { paymentDate: '2026-03-10', amountCents: 25_000, paymentMethod: 'zelle' },
          { paymentDate: '2026-04-10', amountCents: 15_000, paymentMethod: 'directDeposit' },
          { paymentDate: '2026-05-10', amountCents: 5_000, paymentMethod: 'other' },
        ],
      }),
    )
    expect(summary.checkCents).toBe(100_000)
    expect(summary.cashCents).toBe(50_000)
    expect(summary.otherCents).toBe(45_000)
  })

  it('puts each figure on its own month and ignores dates outside the year', () => {
    const summary = taxYearSummary(
      2026,
      figures({
        turns: [
          turn({ localWorkDate: '2026-01-15', commissionTotalCents: 6_000, cashTipCents: 1_000 }),
          turn({ localWorkDate: '2025-12-31', commissionTotalCents: 99_000 }),
        ],
        adjustments: [adjustment('2026-01-20', 2_000)],
        payments: [{ paymentDate: '2026-01-10', amountCents: 8_000, paymentMethod: 'check' }],
      }),
    )

    expect(summary.months).toHaveLength(12)
    expect(summary.months[0]).toEqual({
      month: 1,
      earnedCents: 9_000,
      cashTipsCents: 1_000,
      cardTipsCents: 0,
      checkCents: 8_000,
      cashCents: 0,
      otherCents: 0,
      adjustmentsCents: 2_000,
    })
    expect(summary.totals.earnedCents).toBe(9_000)
  })
})

describe('taxQuarterLines', () => {
  it('marks a quarter that has not started and leaves its amount empty', () => {
    const lines = taxQuarterLines(
      2026,
      figures({ turns: [turn({ localWorkDate: '2026-04-10', commissionTotalCents: 1_000_000 })] }),
      2000,
      '2026-04-20',
    )

    expect(lines.map((line) => line.notStarted)).toEqual([false, false, true, true])
    expect(lines[0].amountCents).toBe(0)
    expect(lines[1].amountCents).toBe(200_000)
    expect(lines[2].amountCents).toBeNull()
  })

  it('shows no amount when no percent is set', () => {
    const lines = taxQuarterLines(2026, figures(), null, '2026-12-31')
    expect(lines.every((line) => line.notStarted)).toBe(false)
    expect(lines.every((line) => line.amountCents === null)).toBe(true)
  })
})
