import { describe, expect, it } from 'vitest'
import { defaultPayRules, NO_RULES, rulesOn, type PayRules } from '../../src/domain/payRules.ts'

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
    })
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
    })
  })
})
