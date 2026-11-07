import type { IsoDate } from './dates.ts'

export type FeeWhen = 'beforeSplit' | 'afterSplit'
export type SupplyFee =
  | { kind: 'none' }
  | { kind: 'perService'; cents: number; when: FeeWhen }
  | { kind: 'percent'; bp: number; when: FeeWhen }

export interface PayRules {
  id: string
  startDate: IsoDate
  supplyFee: SupplyFee
  cardTipFeeBp: number // 0 = none
  checkBp: number | null // null = no check/cash split; 5000 = 50% by check
  cardTipsPaidIn: 'check' | 'cash' | 'split'
  createdAt: number
  updatedAt: number
}
// Release 2.4 adds guarantee and tiers: leave room, add no fields for them now.

export const DEFAULT_PAY_RULES_ID = 'default'

/** What the app uses when no rules have ever been saved. */
export const NO_RULES: Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'> = {
  startDate: '2000-01-01',
  supplyFee: { kind: 'none' },
  cardTipFeeBp: 0,
  checkBp: null,
  cardTipsPaidIn: 'split',
}

export function defaultPayRules(startDate: IsoDate = NO_RULES.startDate, now = 0): PayRules {
  return {
    id: DEFAULT_PAY_RULES_ID,
    startDate,
    supplyFee: NO_RULES.supplyFee,
    cardTipFeeBp: NO_RULES.cardTipFeeBp,
    checkBp: NO_RULES.checkBp,
    cardTipsPaidIn: NO_RULES.cardTipsPaidIn,
    createdAt: now,
    updatedAt: now,
  }
}

/** The rules in force on `date`: the latest with startDate <= date; before the first, the earliest; none saved, NO_RULES. */
export function rulesOn(
  rules: readonly PayRules[],
  date: IsoDate,
): Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'> {
  if (rules.length === 0) return { ...NO_RULES }

  const ordered = [...rules].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.createdAt - b.createdAt,
  )
  let chosen = ordered[0]
  for (const rule of ordered) {
    if (rule.startDate > date) break
    chosen = rule
  }

  return {
    startDate: chosen.startDate,
    supplyFee: chosen.supplyFee,
    cardTipFeeBp: chosen.cardTipFeeBp,
    checkBp: chosen.checkBp,
    cardTipsPaidIn: chosen.cardTipsPaidIn,
  }
}
