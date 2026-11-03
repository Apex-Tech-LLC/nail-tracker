import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type DaftarDb } from '../../src/db/schema.ts'
import { addExpense, updateExpense } from '../../src/features/expenses/expenseStore.ts'

let db: DaftarDb
let counter = 0

beforeEach(() => {
  db = createDb(`store-${++counter}`)
})

afterEach(async () => {
  await db.delete()
})

const input = { amount: 120000, categoryId: 'groceries', date: '2026-11-03', note: '  میوه  ' }

describe('addExpense', () => {
  it('stores the expense with an id, timestamps and a trimmed note', async () => {
    const saved = await addExpense(db, input, 1000)
    expect(saved).toMatchObject({ amount: 120000, note: 'میوه', createdAt: 1000, updatedAt: 1000 })
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await db.expenses.get(saved.id)).toEqual(saved)
  })

  it('drops a blank note', async () => {
    const saved = await addExpense(db, { ...input, note: '   ' })
    expect(saved.note).toBeUndefined()
  })
})

describe('updateExpense', () => {
  it('changes fields and updatedAt but keeps id and createdAt', async () => {
    const saved = await addExpense(db, input, 1000)
    await updateExpense(db, saved.id, { ...input, amount: 150000, categoryId: 'cafe' }, 2000)
    expect(await db.expenses.get(saved.id)).toMatchObject({
      id: saved.id,
      amount: 150000,
      categoryId: 'cafe',
      createdAt: 1000,
      updatedAt: 2000,
    })
  })

  it('throws for an unknown id', async () => {
    await expect(updateExpense(db, 'missing', input)).rejects.toThrow()
  })
})
