import { describe, expect, it } from 'vitest'
import { checkPaycheck } from '../../src/domain/paycheckCheck.ts'
import type { Statement } from '../../src/domain/statement.ts'

function statement(overrides: Partial<Statement> = {}): Statement {
  return {
    daysWorked: 6,
    turns: 40,
    services: 45,
    servicesTotalCents: 250_000,
    supplyFeeCents: 9_000,
    supplyFeeWhen: 'beforeSplit',
    shareRateBp: 6000,
    shareBaseCents: 241_000,
    shareCents: 144_600,
    cardTipsCents: 40_000,
    cardTipsHeldCents: 40_000,
    cardTipFeeCents: 1_200,
    adjustmentsCents: 0,
    guaranteeTopUpCents: 0,
    salonPaysCents: 183_400,
    checkCents: 91_700,
    cashCents: 91_700,
    cashTipsInHandCents: 30_000,
    earnedTotalCents: 213_400,
    byDay: [],
    ...overrides,
  }
}

const noStub = { servicesCents: null, tipsCents: null, deductionsCents: null }

describe('checkPaycheck', () => {
  it('calls a short cash part short, and says the check part matches', () => {
    const result = checkPaycheck(
      statement(),
      { checkCents: 91_700, cashCents: 87_700, otherCents: 0 },
      noStub,
    )

    expect(result).toMatchObject({ kind: 'short', differenceCents: 4_000 })
    expect(result.reasons).toContainEqual({
      kind: 'partShort',
      part: 'cash',
      differenceCents: 4_000,
      otherPartMatches: true,
    })
  })

  it('matches within a dollar of the expected total', () => {
    expect(
      checkPaycheck(statement(), { checkCents: 91_675, cashCents: 91_675, otherCents: 0 }, noStub),
    ).toMatchObject({ kind: 'matches' })
    expect(
      checkPaycheck(statement(), { checkCents: 91_750, cashCents: 91_750, otherCents: 0 }, noStub),
    ).toMatchObject({ kind: 'matches' })
  })

  it('calls a total above the statement over', () => {
    const result = checkPaycheck(
      statement(),
      { checkCents: 92_700, cashCents: 91_700, otherCents: 0 },
      noStub,
    )

    expect(result).toMatchObject({ kind: 'over', differenceCents: 1_000 })
  })

  it('says when the salon counted less in services', () => {
    const result = checkPaycheck(
      statement(),
      { checkCents: 91_700, cashCents: 91_700, otherCents: 0 },
      { servicesCents: 238_800, tipsCents: null, deductionsCents: null },
    )

    expect(result.reasons).toContainEqual({ kind: 'servicesLess', differenceCents: 11_200 })
  })

  it('says when the salon counted more in services', () => {
    const result = checkPaycheck(
      statement(),
      { checkCents: 91_700, cashCents: 91_700, otherCents: 0 },
      { servicesCents: 260_000, tipsCents: null, deductionsCents: null },
    )

    expect(result.reasons).toContainEqual({ kind: 'servicesMore', differenceCents: 10_000 })
  })

  it('compares deductions with the supply fee plus the card-tip fee', () => {
    const more = checkPaycheck(
      statement(),
      { checkCents: 91_700, cashCents: 91_700, otherCents: 0 },
      { servicesCents: null, tipsCents: null, deductionsCents: 15_200 },
    )
    const less = checkPaycheck(
      statement(),
      { checkCents: 91_700, cashCents: 91_700, otherCents: 0 },
      { servicesCents: null, tipsCents: null, deductionsCents: 5_200 },
    )

    expect(more.reasons).toContainEqual({ kind: 'deductionsMore', differenceCents: 5_000 })
    expect(less.reasons).toContainEqual({ kind: 'deductionsLess', differenceCents: 5_000 })
  })

  it('shows both card-tip numbers when they disagree', () => {
    const result = checkPaycheck(
      statement(),
      { checkCents: 91_700, cashCents: 91_700, otherCents: 0 },
      { servicesCents: null, tipsCents: 38_000, deductionsCents: null },
    )

    expect(result.reasons).toContainEqual({ kind: 'cardTips', salonCents: 38_000, yoursCents: 40_000 })
  })

  it('gives no reason for blank stub fields', () => {
    const result = checkPaycheck(
      statement(),
      { checkCents: 91_700, cashCents: 87_700, otherCents: 0 },
      noStub,
    )

    expect(result.reasons.some((reason) => reason.kind === 'servicesLess')).toBe(false)
    expect(result.reasons.some((reason) => reason.kind === 'cardTips')).toBe(false)
  })

  it('gives part reasons only when a split is set', () => {
    const result = checkPaycheck(
      statement({ checkCents: null, cashCents: null }),
      { checkCents: 91_700, cashCents: 87_700, otherCents: 0 },
      noStub,
    )

    expect(result.reasons.some((reason) => reason.kind === 'partShort')).toBe(false)
  })

  it('counts other payments towards the total', () => {
    const result = checkPaycheck(
      statement(),
      { checkCents: 91_700, cashCents: 87_700, otherCents: 4_000 },
      noStub,
    )

    expect(result.kind).toBe('matches')
  })
})
