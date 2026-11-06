import { describe, expect, it } from 'vitest'
import { allocationProblem, payState, suggestAllocations } from '../../src/domain/payday.ts'

describe('payState', () => {
  it('spec: a $40 shortage shows $40 outstanding', () => {
    expect(payState(144000, 140000)).toEqual({ outstandingCents: 4000, state: 'owed' })
  })

  it('exact payment is paid in full', () => {
    expect(payState(144000, 144000)).toEqual({ outstandingCents: 0, state: 'paid' })
  })

  it('too much paid is overpaid, with a negative balance', () => {
    expect(payState(144000, 150000)).toEqual({ outstandingCents: -6000, state: 'overpaid' })
  })

  it('nothing expected and nothing paid is empty', () => {
    expect(payState(0, 0)).toEqual({ outstandingCents: 0, state: 'empty' })
  })

  it('a period that nets to a negative payout with no payment is overpaid', () => {
    expect(payState(-500, 0)).toEqual({ outstandingCents: -500, state: 'overpaid' })
  })
})

describe('suggestAllocations', () => {
  const owed = (payPeriodId: string, outstandingCents: number) => ({ payPeriodId, outstandingCents })

  it('pays the oldest period first', () => {
    expect(suggestAllocations(50000, [owed('a', 60000), owed('b', 30000)], 'b')).toEqual([{ payPeriodId: 'a', amountCents: 50000 }])
  })

  it('spec: one payment can cover several periods', () => {
    expect(suggestAllocations(90000, [owed('a', 60000), owed('b', 30000)], 'b')).toEqual([
      { payPeriodId: 'a', amountCents: 60000 },
      { payPeriodId: 'b', amountCents: 30000 },
    ])
  })

  it('puts any extra on the period the form was opened from', () => {
    expect(suggestAllocations(100000, [owed('a', 60000), owed('b', 30000)], 'b')).toEqual([
      { payPeriodId: 'a', amountCents: 60000 },
      { payPeriodId: 'b', amountCents: 40000 },
    ])
  })

  it('adds an extra line for the fallback when it owes nothing', () => {
    expect(suggestAllocations(70000, [owed('a', 60000)], 'c')).toEqual([
      { payPeriodId: 'a', amountCents: 60000 },
      { payPeriodId: 'c', amountCents: 10000 },
    ])
  })

  it('ignores periods that owe nothing or are overpaid', () => {
    expect(suggestAllocations(1000, [owed('a', 0), owed('b', -500), owed('c', 3000)], 'c')).toEqual([{ payPeriodId: 'c', amountCents: 1000 }])
  })

  it('gives everything to the fallback when nothing is owed', () => {
    expect(suggestAllocations(2500, [], 'x')).toEqual([{ payPeriodId: 'x', amountCents: 2500 }])
  })
})

describe('allocationProblem', () => {
  const line = (amountCents: number) => ({ payPeriodId: `p${amountCents}`, amountCents })

  it('accepts lines that add up to the payment', () => {
    expect(allocationProblem(1000, [line(600), line(400)])).toBeNull()
  })

  it('rejects a payment of zero or less', () => {
    expect(allocationProblem(0, [])).toBe('amount')
    expect(allocationProblem(-5, [line(-5)])).toBe('amount')
  })

  it('rejects lines that do not add up', () => {
    expect(allocationProblem(1000, [line(600)])).toBe('mismatch')
    expect(allocationProblem(1000, [])).toBe('mismatch')
  })

  it('rejects a line of zero or less', () => {
    expect(allocationProblem(1000, [line(1000), line(0)])).toBe('line')
    expect(allocationProblem(1000, [line(1100), { payPeriodId: 'x', amountCents: -100 }])).toBe('line')
  })
})
