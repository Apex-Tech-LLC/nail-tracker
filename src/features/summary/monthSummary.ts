import type { DaftarDb, Expense } from '../../db/schema.ts'
import { monthRange, previousMonth, type Calendar } from '../../lib/jalali.ts'

export interface CategoryTotal {
  categoryId: string
  total: number
  /** Share of the month's total, from 0 to 1. */
  share: number
}

export interface MonthSummary {
  total: number
  count: number
  byCategory: CategoryTotal[]
  previousTotal: number
}

/** Totals per category, largest first (ties by id, so the order is stable). */
export function totalsByCategory(expenses: readonly Expense[]): CategoryTotal[] {
  const totals = new Map<string, number>()
  for (const e of expenses) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount)
  const sum = [...totals.values()].reduce((a, b) => a + b, 0)
  return [...totals.entries()]
    .map(([categoryId, total]) => ({ categoryId, total, share: sum ? total / sum : 0 }))
    .sort((a, b) => b.total - a.total || (a.categoryId < b.categoryId ? -1 : 1))
}

async function monthExpenses(db: DaftarDb, year: number, month: number, calendar: Calendar) {
  const { start, end } = monthRange(year, month, calendar)
  return db.expenses.where('date').between(start, end, true, true).toArray()
}

/**
 * One month in the chosen calendar, so a Jalali month like Aban (23 Oct to
 * 21 Nov) is summed as one month, not split across two Gregorian ones.
 */
export async function loadMonthSummary(
  db: DaftarDb,
  year: number,
  month: number,
  calendar: Calendar,
): Promise<MonthSummary> {
  const prev = previousMonth(year, month)
  const [expenses, previous] = await Promise.all([
    monthExpenses(db, year, month, calendar),
    monthExpenses(db, prev.year, prev.month, calendar),
  ])
  return {
    total: expenses.reduce((sum, e) => sum + e.amount, 0),
    count: expenses.length,
    byCategory: totalsByCategory(expenses),
    previousTotal: previous.reduce((sum, e) => sum + e.amount, 0),
  }
}
