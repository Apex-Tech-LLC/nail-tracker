import Dexie, { type EntityTable } from 'dexie'
import type { Locale } from '../lib/locale.ts'
import { DEFAULT_CATEGORIES } from './seed.ts'

export interface Expense {
  id: string // crypto.randomUUID(), so records can later merge across devices
  amount: number // integer Toman, never a float
  categoryId: string
  date: string // ISO Gregorian "2026-11-03"; Jalali is display only
  note?: string
  createdAt: number
  updatedAt: number
}

export interface Category {
  id: string
  // Both languages are stored so switching language needs no lookup table.
  // A category the user creates gets the same name in both.
  names: Record<Locale, string>
  icon: string // Tabler icon name, e.g. "shopping-cart"
  order: number
}

export type DaftarDb = Dexie & {
  expenses: EntityTable<Expense, 'id'>
  categories: EntityTable<Category, 'id'>
}

/**
 * Opens the database. Each schema change gets a new version() with an
 * upgrade() that converts old data; never edit a released version.
 */
export function createDb(name = 'daftar'): DaftarDb {
  const db = new Dexie(name) as DaftarDb

  db.version(1).stores({
    expenses: 'id, date, categoryId, updatedAt',
    categories: 'id, order',
  })

  // Runs once, when the database is first created.
  db.on('populate', (tx) => {
    tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
  })

  return db
}

export const db = createDb()
