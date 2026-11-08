import type { NailDb } from '../../db/schema.ts'
import type { IsoDate } from '../../domain/dates.ts'
import type { PayRules } from '../../domain/payRules.ts'

export type PayRulesValues = Pick<
  PayRules,
  'supplyFee' | 'cardTipFeeBp' | 'checkBp' | 'cardTipsPaidIn' | 'guarantee' | 'tiers'
>

export function loadPayRules(db: NailDb): Promise<PayRules[]> {
  return db.payRules.toArray()
}

/**
 * Saves the rules that start on `startDate`. A rule already starting on that
 * date is replaced; any other record is left alone, so past periods keep the
 * numbers they had.
 */
export async function savePayRules(
  db: NailDb,
  values: PayRulesValues,
  startDate: IsoDate,
  now: number = Date.now(),
): Promise<string> {
  const existing = await db.payRules.where('startDate').equals(startDate).first()
  if (existing) {
    await db.payRules.update(existing.id, { ...values, updatedAt: now })
    return existing.id
  }

  const id = crypto.randomUUID()
  await db.payRules.add({ id, startDate, ...values, createdAt: now, updatedAt: now })
  return id
}

/** Deletes one rule, unless it is the only rule left. Returns whether it was deleted. */
export async function deletePayRules(db: NailDb, id: string): Promise<boolean> {
  if ((await db.payRules.count()) <= 1) return false
  await db.payRules.delete(id)
  return true
}
