import type { Expense } from '../../db/schema.ts'

export interface DayGroup {
  date: string
  total: number
  expenses: Expense[]
}

/** Groups expenses by date, newest day first and newest entry first within a day. */
export function groupByDay(expenses: readonly Expense[]): DayGroup[] {
  const byDate = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const day = byDate.get(expense.date)
    if (day) day.push(expense)
    else byDate.set(expense.date, [expense])
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({
      date,
      total: items.reduce((sum, e) => sum + e.amount, 0),
      expenses: items.sort((a, b) => b.createdAt - a.createdAt),
    }))
}

export function sumAmounts(expenses: readonly Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0)
}
