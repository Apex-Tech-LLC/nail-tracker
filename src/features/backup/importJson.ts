import type { Category, DaftarDb, Expense } from '../../db/schema.ts'
import { parseIsoDate } from '../../lib/jalali.ts'
import { BACKUP_VERSION } from './backupFormat.ts'

export type ImportErrorCode = 'notJson' | 'notBackup' | 'unsupportedVersion' | 'invalidRecord'

export class ImportError extends Error {
  readonly code: ImportErrorCode

  constructor(code: ImportErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.code = code
  }
}

export interface ImportResult {
  added: number
  updated: number
  unchanged: number
}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    parseIsoDate(value)
    return true
  } catch {
    return false
  }
}

function toExpense(value: unknown): Expense | null {
  if (!isObject(value)) return null
  const { id, amount, categoryId, date, note, createdAt, updatedAt } = value
  if (!isText(id) || !isText(categoryId) || !isIsoDate(date) || !isTime(createdAt) || !isTime(updatedAt)) return null
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) return null
  if (note !== undefined && typeof note !== 'string') return null
  return { id, amount, categoryId, date, createdAt, updatedAt, ...(note ? { note } : {}) }
}

function toCategory(value: unknown): Category | null {
  if (!isObject(value)) return null
  const { id, names, icon, order } = value
  if (!isText(id) || !isText(icon) || typeof order !== 'number' || !isObject(names)) return null
  if (!isText(names.fa) || !isText(names.en)) return null
  return { id, names: { fa: names.fa, en: names.en }, icon, order }
}

/**
 * Checks a whole backup file before anything is written. Any problem
 * throws, so a bad file is rejected as a whole and never half-imported.
 */
export function parseBackup(text: string): { expenses: Expense[]; categories: Category[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('notJson')
  }
  if (!isObject(data) || data.app !== 'daftar' || !Array.isArray(data.expenses) || !Array.isArray(data.categories)) {
    throw new ImportError('notBackup')
  }
  if (data.version !== BACKUP_VERSION) throw new ImportError('unsupportedVersion', String(data.version))

  const categories = data.categories.map(toCategory)
  const badCategory = categories.indexOf(null)
  if (badCategory !== -1) throw new ImportError('invalidRecord', `category ${badCategory}`)

  const expenses = data.expenses.map(toExpense)
  const badExpense = expenses.indexOf(null)
  if (badExpense !== -1) throw new ImportError('invalidRecord', `expense ${badExpense}`)

  return { expenses: expenses as Expense[], categories: categories as Category[] }
}

/**
 * Merges a backup into the database. Nothing is ever deleted: new records
 * are added, and a record already here is replaced only when the backup's
 * copy was edited later. Runs in one transaction, so it is all or nothing.
 */
export async function importJson(db: DaftarDb, text: string): Promise<ImportResult> {
  const backup = parseBackup(text)

  return db.transaction('rw', db.expenses, db.categories, async () => {
    // Categories the user already has keep their names and order.
    const knownCategories = new Set(await db.categories.toCollection().primaryKeys())
    await db.categories.bulkAdd(backup.categories.filter((c) => !knownCategories.has(c.id)))

    const existing = await db.expenses.bulkGet(backup.expenses.map((e) => e.id))
    const result: ImportResult = { added: 0, updated: 0, unchanged: 0 }
    const toWrite: Expense[] = []
    backup.expenses.forEach((expense, i) => {
      const current = existing[i]
      if (!current) result.added++
      else if (expense.updatedAt > current.updatedAt) result.updated++
      else return void result.unchanged++
      toWrite.push(expense)
    })
    await db.expenses.bulkPut(toWrite)
    return result
  })
}
