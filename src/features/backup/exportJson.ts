import type { DaftarDb } from '../../db/schema.ts'
import { BACKUP_VERSION, type Backup } from './backupFormat.ts'

/** Everything in the database, as a backup file's text. */
export async function exportJson(db: DaftarDb, now: Date = new Date()): Promise<string> {
  const [expenses, categories] = await db.transaction('r', db.expenses, db.categories, () =>
    Promise.all([db.expenses.orderBy('date').toArray(), db.categories.orderBy('order').toArray()]),
  )
  const backup: Backup = { app: 'daftar', version: BACKUP_VERSION, exportedAt: now.toISOString(), expenses, categories }
  return JSON.stringify(backup, null, 2)
}
