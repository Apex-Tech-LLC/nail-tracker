import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type DaftarDb, type Expense } from '../../src/db/schema.ts'
import { DEFAULT_CATEGORIES } from '../../src/db/seed.ts'

let db: DaftarDb
let counter = 0

function openFresh() {
  db = createDb(`test-${++counter}`)
  return db
}

afterEach(async () => {
  await db.delete()
})

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: crypto.randomUUID(),
    amount: 100000,
    categoryId: 'groceries',
    date: '2026-11-03',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('seed', () => {
  it('adds the default categories on first open', async () => {
    const categories = await openFresh().categories.orderBy('order').toArray()
    expect(categories).toEqual(DEFAULT_CATEGORIES)
  })

  it('does not seed again when the database is reopened', async () => {
    const name = `test-${++counter}`
    const first = createDb(name)
    await first.categories.delete('other')
    first.close()

    db = createDb(name)
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length - 1)
  })

  it('has unique ids and both language names for every category', () => {
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size).toBe(DEFAULT_CATEGORIES.length)
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.names.fa).not.toBe('')
      expect(c.names.en).not.toBe('')
    }
  })
})

describe('expenses', () => {
  it('stores and reads back an expense unchanged', async () => {
    openFresh()
    const e = expense({ note: 'میوه' })
    await db.expenses.add(e)
    expect(await db.expenses.get(e.id)).toEqual(e)
  })

  it('finds a month of expenses with a date string range', async () => {
    openFresh()
    await db.expenses.bulkAdd([
      expense({ date: '2026-10-22' }),
      expense({ date: '2026-10-23' }),
      expense({ date: '2026-11-21' }),
      expense({ date: '2026-11-22' }),
    ])
    // Aban 1405 runs 2026-10-23 to 2026-11-21.
    const aban = await db.expenses.where('date').between('2026-10-23', '2026-11-21', true, true).toArray()
    expect(aban.map((e) => e.date).sort()).toEqual(['2026-10-23', '2026-11-21'])
  })

  it('filters by category', async () => {
    openFresh()
    await db.expenses.bulkAdd([expense({ categoryId: 'bills' }), expense({}), expense({})])
    expect(await db.expenses.where('categoryId').equals('groceries').count()).toBe(2)
  })
})
