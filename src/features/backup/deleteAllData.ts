import type { NailDb } from '../../db/schema.ts'
import { DEFAULT_PRESETS, DEFAULT_SALON } from '../../db/seed.ts'
import { defaultPayRules } from '../../domain/payRules.ts'

/**
 * Empties every table, then puts back what a first launch has. Clearing does
 * not run Dexie's populate hook again, so the salon, presets and default pay
 * rules are added by hand. Runs in one transaction, so the app is never left
 * half empty.
 */
export async function deleteAllData(db: NailDb): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.salons,
      db.servicePresets,
      db.turns,
      db.turnServices,
      db.adjustments,
      db.payments,
      db.paymentAllocations,
      db.payPeriods,
      db.payRules,
      db.paycheckRecords,
    ],
    async () => {
      await Promise.all([
        db.salons.clear(),
        db.servicePresets.clear(),
        db.turns.clear(),
        db.turnServices.clear(),
        db.adjustments.clear(),
        db.payments.clear(),
        db.paymentAllocations.clear(),
        db.payPeriods.clear(),
        db.payRules.clear(),
        db.paycheckRecords.clear(),
      ])
      await db.salons.add(DEFAULT_SALON)
      await db.servicePresets.bulkAdd(DEFAULT_PRESETS)
      await db.payRules.add(defaultPayRules())
    },
  )
}
