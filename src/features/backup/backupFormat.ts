import type { Category, Expense } from '../../db/schema.ts'
import { toCalendar, type Calendar, type IsoDate } from '../../lib/jalali.ts'

/**
 * Version of the backup file format. It follows the database schema: when
 * a new schema version changes what a record holds, bump this and teach
 * importJson to convert older files instead of rejecting them.
 */
export const BACKUP_VERSION = 1

export interface Backup {
  app: 'daftar'
  version: number
  exportedAt: string
  expenses: Expense[]
  categories: Category[]
}

/**
 * File name with the date in the user's calendar, e.g.
 * "daftar-backup-1405-08-14.json" or "daftar-backup-2026-11-05.json".
 * Digits stay Latin so the name works on every file system and sorts.
 */
export function backupFileName(
  kind: 'backup' | 'expenses',
  extension: 'json' | 'csv',
  today: IsoDate,
  calendar: Calendar,
): string {
  const { year, month, day } = toCalendar(today, calendar)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `daftar-${kind}-${year}-${pad(month)}-${pad(day)}.${extension}`
}

/** Hands a file to the browser as a download. */
export function download(content: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Some browsers start the download after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
