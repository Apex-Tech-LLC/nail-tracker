import type { DaftarDb, Expense } from '../../db/schema.ts'

export interface ExpenseInput {
  amount: number
  categoryId: string
  date: string
  note?: string
}

function clean(input: ExpenseInput): ExpenseInput {
  const note = input.note?.trim()
  return { amount: input.amount, categoryId: input.categoryId, date: input.date, note: note || undefined }
}

export async function addExpense(db: DaftarDb, input: ExpenseInput, now = Date.now()): Promise<Expense> {
  const expense: Expense = { id: crypto.randomUUID(), ...clean(input), createdAt: now, updatedAt: now }
  await db.expenses.add(expense)
  return expense
}

/** Replaces the editable fields and bumps updatedAt; createdAt never changes. */
export async function updateExpense(db: DaftarDb, id: string, input: ExpenseInput, now = Date.now()): Promise<void> {
  const existing = await db.expenses.get(id)
  if (!existing) throw new Error(`Expense not found: ${id}`)
  await db.expenses.put({ ...existing, ...clean(input), updatedAt: now })
}
