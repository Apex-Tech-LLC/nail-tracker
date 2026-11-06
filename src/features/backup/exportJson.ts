import type { Settings } from '../../app/settings.ts'
import type { NailDb } from '../../db/schema.ts'
import { BACKUP_VERSION, type Backup } from './backupFormat.ts'

/** Everything in the database, as a backup file's text. */
export async function exportJson(
  db: NailDb,
  settings: Settings,
  now: Date = new Date(),
): Promise<string> {
  const backup = await db.transaction(
    'r',
    [
      db.salons,
      db.servicePresets,
      db.turns,
      db.turnServices,
      db.adjustments,
      db.payPeriods,
      db.payments,
      db.paymentAllocations,
    ],
    async (): Promise<Backup> => {
      const [
        salons,
        servicePresets,
        turns,
        turnServices,
        adjustments,
        payPeriods,
        payments,
        paymentAllocations,
      ] = await Promise.all([
        db.salons.toArray(),
        db.servicePresets.toArray(),
        db.turns.toArray(),
        db.turnServices.toArray(),
        db.adjustments.toArray(),
        db.payPeriods.toArray(),
        db.payments.toArray(),
        db.paymentAllocations.toArray(),
      ])

      return {
        app: 'nail-tracker',
        version: BACKUP_VERSION,
        exportedAt: now.toISOString(),
        settings,
        salons,
        servicePresets,
        turns,
        turnServices,
        adjustments,
        payPeriods,
        payments,
        paymentAllocations,
      }
    },
  )

  return JSON.stringify(backup, null, 2)
}
