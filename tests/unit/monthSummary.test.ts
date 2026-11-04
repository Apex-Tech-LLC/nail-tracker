import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type DaftarDb, type Expense } from '../../src/db/schema.ts'
import { loadMonthSummary, totalsByCategory } from '../../src/features/summary/monthSummary.ts'

let db: DaftarDb
let counter = 0

beforeEach(() => {
  db = createDb(`summary-${++counter}`)
})

afterEach(async () => {
  await db.delete()
})

let seq = 0
function expense(date: string, amount: number, categoryId = 'groceries'): Expense {
  seq++
  return { id: `e${seq}`, amount, categoryId, date, createdAt: seq, updatedAt: seq }
}

describe('totalsByCategory', () => {
  it('sums per category, largest first, with each share of the total', () => {
    const totals = totalsByCategory([
      expense('2026-11-01', 100, 'cafe'),
      expense('2026-11-02', 300, 'bills'),
      expense('2026-11-03', 100, 'cafe'),
      expense('2026-11-04', 500, 'groceries'),
    ])
    expect(totals).toEqual([
      { categoryId: 'groceries', total: 500, share: 0.5 },
      { categoryId: 'bills', total: 300, share: 0.3 },
      { categoryId: 'cafe', total: 200, share: 0.2 },
    ])
  })

  it('breaks ties by id so the order never flickers', () => {
    const totals = totalsByCategory([expense('2026-11-01', 100, 'transport'), expense('2026-11-01', 100, 'cafe')])
    expect(totals.map((c) => c.categoryId)).toEqual(['cafe', 'transport'])
  })

  it('returns nothing for no expenses', () => {
    expect(totalsByCategory([])).toEqual([])
  })
})

describe('loadMonthSummary', () => {
  // Aban 1405 runs from 2026-10-23 to 2026-11-21.
  beforeEach(async () => {
    await db.expenses.bulkAdd([
      expense('2026-10-22', 1_000, 'bills'), // 30 Mehr: previous Jalali month
      expense('2026-10-23', 200, 'groceries'), // 1 Aban
      expense('2026-11-05', 300, 'cafe'), // 14 Aban
      expense('2026-11-21', 500, 'groceries'), // 30 Aban
      expense('2026-11-22', 9_000, 'bills'), // 1 Azar: next Jalali month
    ])
  })

  it('totals a Jalali month across the Gregorian month boundary', async () => {
    const summary = await loadMonthSummary(db, 1405, 8, 'jalali')
    expect(summary.total).toBe(1_000)
    expect(summary.count).toBe(3)
    expect(summary.byCategory.map((c) => [c.categoryId, c.total])).toEqual([
      ['groceries', 700],
      ['cafe', 300],
    ])
    expect(summary.previousTotal).toBe(1_000)
  })

  it('totals Gregorian months by their own boundaries', async () => {
    const november = await loadMonthSummary(db, 2026, 11, 'gregorian')
    expect(november.total).toBe(300 + 500 + 9_000)
    expect(november.previousTotal).toBe(1_000 + 200)
  })

  it('is empty for a month with no expenses', async () => {
    const summary = await loadMonthSummary(db, 1405, 1, 'jalali')
    expect(summary).toEqual({ total: 0, count: 0, byCategory: [], previousTotal: 0 })
  })
})
