import { describe, expect, it } from 'vitest'
import { adjustmentAffectsPayout, averages, numberTurns, sumTotals, type AdjustmentFigures, type TurnFigures } from '../../src/domain/totals.ts'

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

const adjustment = (amountCents: number, category: AdjustmentFigures['category'] = 'bonus'): AdjustmentFigures => ({
  amountCents,
  category,
})

describe('sumTotals', () => {
  it('is all zero with nothing recorded', () => {
    expect(sumTotals([], [])).toEqual({
      turns: 0,
      customers: 0,
      workDays: 0,
      serviceRevenueCents: 0,
      commissionCents: 0,
      cashTipsCents: 0,
      cardTipsCents: 0,
      tipsCents: 0,
      adjustmentsCents: 0,
      earnedCents: 0,
      tipsInHandCents: 0,
      expectedPayoutCents: 0,
    })
  })

  it('spec payday example: $1,620 earned, $180 cash in hand, $1,440 expected', () => {
    const totals = sumTotals(
      [turn({ commissionTotalCents: 120000, cardTipCents: 24000, cashTipCents: 18000, serviceRevenueTotalCents: 200000 })],
      [],
    )
    expect(totals).toMatchObject({
      commissionCents: 120000,
      cardTipsCents: 24000,
      cashTipsCents: 18000,
      tipsCents: 42000,
      earnedCents: 162000,
      tipsInHandCents: 18000,
      expectedPayoutCents: 144000,
    })
  })

  it('a cash tip the salon holds is still owed', () => {
    const totals = sumTotals([turn({ cashTipCents: 1000, cashTipReceived: false })], [])
    expect(totals).toMatchObject({ tipsInHandCents: 0, expectedPayoutCents: 1000 })
  })

  it('a card tip already handed over is no longer owed', () => {
    const totals = sumTotals([turn({ cardTipCents: 1500, cardTipReceived: true })], [])
    expect(totals).toMatchObject({ tipsInHandCents: 1500, expectedPayoutCents: 0, earnedCents: 1500 })
  })

  it('counts turns, customers and working days separately', () => {
    const totals = sumTotals(
      [
        turn({ turnCount: 2 }),
        turn({ turnCount: 1 }),
        turn({ turnCount: 0 }), // not on the rotation, so not a customer
        turn({ turnCount: 1, localWorkDate: '2026-11-05' }),
      ],
      [],
    )
    expect(totals).toMatchObject({ turns: 4, customers: 3, workDays: 2 })
  })

  it('adjustments change earned, and all but bookkeeping deductions change the payout', () => {
    const totals = sumTotals(
      [turn({ commissionTotalCents: 10000 })],
      [adjustment(2000, 'bonus'), adjustment(-500, 'commissionCorrection'), adjustment(-300, 'tipCorrection'), adjustment(-1000, 'bookkeepingDeduction')],
    )
    expect(totals).toMatchObject({ adjustmentsCents: 200, earnedCents: 10200, expectedPayoutCents: 11200 })
  })

  it('an adjustment alone does not count as a working day', () => {
    expect(sumTotals([], [adjustment(500)]).workDays).toBe(0)
  })
})

describe('adjustmentAffectsPayout', () => {
  it.each([
    ['bonus', true],
    ['commissionCorrection', true],
    ['tipCorrection', true],
    ['bookkeepingDeduction', false],
  ] as const)('%s is %s', (category, expected) => {
    expect(adjustmentAffectsPayout(category)).toBe(expected)
  })
})

describe('averages', () => {
  it('is zero rather than a crash when there are no turns', () => {
    expect(averages(sumTotals([], []))).toEqual({ earnedPerTurnCents: 0, tipsPerTurnCents: 0, earnedPerWorkDayCents: 0 })
  })

  it('rounds half up to the cent', () => {
    const totals = sumTotals(
      [
        turn({ commissionTotalCents: 1000, cashTipCents: 100 }),
        turn({ commissionTotalCents: 1000, cashTipCents: 100 }),
        turn({ commissionTotalCents: 1001, cashTipCents: 101, localWorkDate: '2026-11-05' }),
      ],
      [],
    )
    // earned 3302 over 3 turns and 2 days, tips 301 over 3 turns
    expect(averages(totals)).toEqual({ earnedPerTurnCents: 1101, tipsPerTurnCents: 100, earnedPerWorkDayCents: 1651 })
  })
})

describe('numberTurns', () => {
  const row = (id: string, turnCount: number, occurredAt: number, createdAt = occurredAt) => ({ id, turnCount, occurredAt, createdAt })

  it('runs the count in time order and skips zero-turn entries', () => {
    const numbers = numberTurns([row('c', 2, 300), row('a', 1, 100), row('e', 1, 500), row('b', 1, 200), row('d', 0, 400)])
    expect(Object.fromEntries(numbers)).toEqual({ a: 1, b: 2, c: 4, d: null, e: 5 })
  })

  it('breaks a tie on time with the order they were saved', () => {
    const numbers = numberTurns([row('later', 1, 100, 20), row('first', 1, 100, 10)])
    expect(Object.fromEntries(numbers)).toEqual({ first: 1, later: 2 })
  })
})
