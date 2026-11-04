import type { Category, Expense } from '../../db/schema.ts'

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

/** File name with today's date, e.g. "daftar-backup-2026-11-04.json". */
export function backupFileName(kind: 'backup' | 'expenses', extension: 'json' | 'csv', today: string): string {
  return `daftar-${kind}-${today}.${extension}`
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
