import type { IsoDate } from './dates.ts'

export type FeeWhen = 'beforeSplit' | 'afterSplit'
export type SupplyFee =
  | { kind: 'none' }
  | { kind: 'perService'; cents: number; when: FeeWhen }
  | { kind: 'percent'; bp: number; when: FeeWhen }

/** A floor for a whole pay period: none, per day worked, or per pay period. */
export type Guarantee =
  | { kind: 'none' }
  | { kind: 'perDay'; cents: number; minDays: number | null }
  | { kind: 'perPeriod'; cents: number; minDays: number | null }

export interface TierLevel {
  fromCents: number // where this level starts; the first is always 0
  rateBp: number
}

export interface Tiers {
  mode: 'eachPart' | 'wholeAtTop'
  levels: TierLevel[] // ascending by fromCents; 2 to 5 levels, the first from 0
}

export interface PayRules {
  id: string
  startDate: IsoDate
  supplyFee: SupplyFee
  cardTipFeeBp: number // 0 = none
  checkBp: number | null // null = no check/cash split; 5000 = 50% by check
  cardTipsPaidIn: 'check' | 'cash' | 'split'
  guarantee: Guarantee
  tiers: Tiers | null
  createdAt: number
  updatedAt: number
}

export const DEFAULT_PAY_RULES_ID = 'default'

/** What the app uses when no rules have ever been saved. */
export const NO_RULES: Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'> = {
  startDate: '2000-01-01',
  supplyFee: { kind: 'none' },
  cardTipFeeBp: 0,
  checkBp: null,
  cardTipsPaidIn: 'split',
  guarantee: { kind: 'none' },
  tiers: null,
}

export function defaultPayRules(startDate: IsoDate = NO_RULES.startDate, now = 0): PayRules {
  return {
    id: DEFAULT_PAY_RULES_ID,
    startDate,
    supplyFee: NO_RULES.supplyFee,
    cardTipFeeBp: NO_RULES.cardTipFeeBp,
    checkBp: NO_RULES.checkBp,
    cardTipsPaidIn: NO_RULES.cardTipsPaidIn,
    guarantee: { kind: 'none' },
    tiers: null,
    createdAt: now,
    updatedAt: now,
  }
}

/** The saved rule in force on `date`: the latest with startDate <= date; before the first, the earliest. */
export function ruleInForce(rules: readonly PayRules[], date: IsoDate): PayRules | null {
  if (rules.length === 0) return null

  const ordered = [...rules].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.createdAt - b.createdAt,
  )
  let chosen = ordered[0]
  for (const rule of ordered) {
    if (rule.startDate > date) break
    chosen = rule
  }
  return chosen
}

/** The rules in force on `date`: the latest with startDate <= date; before the first, the earliest; none saved, NO_RULES. */
export function rulesOn(
  rules: readonly PayRules[],
  date: IsoDate,
): Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'> {
  const chosen = ruleInForce(rules, date)
  if (chosen === null) return { ...NO_RULES }

  return {
    startDate: chosen.startDate,
    supplyFee: chosen.supplyFee,
    cardTipFeeBp: chosen.cardTipFeeBp,
    checkBp: chosen.checkBp,
    cardTipsPaidIn: chosen.cardTipsPaidIn,
    guarantee: chosen.guarantee,
    tiers: chosen.tiers,
  }
}
