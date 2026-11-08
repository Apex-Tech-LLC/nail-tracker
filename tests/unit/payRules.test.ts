import { describe, expect, it } from 'vitest'
import {
  defaultPayRules,
  NO_RULES,
  ruleInForce,
  rulesOn,
  tierShare,
  type PayRules,
  type Tiers,
} from '../../src/domain/payRules.ts'

function rule(overrides: Partial<PayRules> = {}): PayRules {
  return {
    ...defaultPayRules('2000-01-01'),
    ...overrides,
  }
}

describe('rulesOn', () => {
  it('falls back to NO_RULES when nothing is saved', () => {
    expect(rulesOn([], '2026-11-04')).toEqual(NO_RULES)
  })

  it('uses the latest rule that started on or before the date', () => {
    const oldRule = rule({ id: 'old', startDate: '2020-01-01', cardTipFeeBp: 100 })
    const newRule = rule({ id: 'new', startDate: '2026-11-04', cardTipFeeBp: 300 })

    expect(rulesOn([newRule, oldRule], '2026-11-03').cardTipFeeBp).toBe(100)
    expect(rulesOn([newRule, oldRule], '2026-11-04').cardTipFeeBp).toBe(300)
    expect(rulesOn([newRule, oldRule], '2027-01-01').cardTipFeeBp).toBe(300)
  })

  it('uses the earliest rule for a date before the first one', () => {
    const first = rule({ id: 'first', startDate: '2026-01-01', cardTipFeeBp: 200 })
    const later = rule({ id: 'later', startDate: '2026-06-01', cardTipFeeBp: 500 })

    expect(rulesOn([later, first], '2025-12-31').cardTipFeeBp).toBe(200)
  })

  it('returns the rule values without its identity and timestamps', () => {
    const saved = rule({ id: 'saved', createdAt: 5, updatedAt: 9, startDate: '2026-01-01' })

    expect(rulesOn([saved], '2026-02-01')).toEqual({
      startDate: '2026-01-01',
      supplyFee: { kind: 'none' },
      cardTipFeeBp: 0,
      checkBp: null,
      cardTipsPaidIn: 'split',
      guarantee: { kind: 'none' },
      tiers: null,
    })
  })
})

describe('ruleInForce', () => {
  it('returns the saved record that is in force on the date', () => {
    const oldRule = rule({ id: 'old', startDate: '2020-01-01' })
    const newRule = rule({ id: 'new', startDate: '2026-11-04' })

    expect(ruleInForce([newRule, oldRule], '2026-11-03')?.id).toBe('old')
    expect(ruleInForce([newRule, oldRule], '2026-11-04')?.id).toBe('new')
    expect(ruleInForce([oldRule, newRule], '2027-01-01')?.id).toBe('new')
  })

  it('returns the earliest record for a date before the first one', () => {
    const first = rule({ id: 'first', startDate: '2026-01-01' })
    const later = rule({ id: 'later', startDate: '2026-06-01' })

    expect(ruleInForce([later, first], '2025-12-31')?.id).toBe('first')
  })

  it('returns null when nothing is saved', () => {
    expect(ruleInForce([], '2026-11-04')).toBeNull()
  })
})

describe('defaultPayRules', () => {
  it('starts on the first turn date with no fees and no split', () => {
    expect(defaultPayRules('2026-11-04')).toMatchObject({
      startDate: '2026-11-04',
      supplyFee: { kind: 'none' },
      cardTipFeeBp: 0,
      checkBp: null,
      cardTipsPaidIn: 'split',
      guarantee: { kind: 'none' },
      tiers: null,
    })
  })
})

const TIERS: Tiers = {
  mode: 'eachPart',
  levels: [
    { fromCents: 0, rateBp: 5000 },
    { fromCents: 50_000, rateBp: 5500 },
    { fromCents: 100_000, rateBp: 6500 },
  ],
}

describe('tierShare', () => {
  it('gives each part its own rate: $1,200 is $655', () => {
    expect(tierShare(120_000, TIERS)).toBe(65_500)
  })

  it('gives the whole amount the highest rate reached: $1,200 is $780', () => {
    expect(tierShare(120_000, { ...TIERS, mode: 'wholeAtTop' })).toBe(78_000)
  })

  it('keeps $500.00 in the lower level in both modes', () => {
    expect(tierShare(50_000, TIERS)).toBe(25_000)
    expect(tierShare(50_000, { ...TIERS, mode: 'wholeAtTop' })).toBe(25_000)
  })

  it('rounds each part half up before adding them', () => {
    const tiers: Tiers = {
      mode: 'eachPart',
      levels: [
        { fromCents: 0, rateBp: 5000 },
        { fromCents: 1, rateBp: 5000 },
        { fromCents: 2, rateBp: 5000 },
      ],
    }

    // Three one-cent parts at 50% are 0.5 each: rounded separately that is $0.03.
    expect(tierShare(3, tiers)).toBe(3)
  })

  it('is zero for no sales', () => {
    expect(tierShare(0, TIERS)).toBe(0)
  })
})
