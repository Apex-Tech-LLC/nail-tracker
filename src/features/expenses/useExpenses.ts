import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Category, type Expense } from '../../db/schema.ts'
import { monthRange, type Calendar } from '../../lib/jalali.ts'

export interface MonthData {
  expenses: Expense[]
  categories: Map<string, Category>
  /** Expenses in all months, to tell a first run from an empty month. */
  totalCount: number
}

/**
 * Live expenses of one month in the chosen calendar. Reads straight from
 * IndexedDB and re-renders on every change, so there is no separate state
 * store to keep in sync. Undefined while the first query is loading.
 */
export function useMonthExpenses(year: number, month: number, calendar: Calendar): MonthData | undefined {
  return useLiveQuery(async () => {
    const { start, end } = monthRange(year, month, calendar)
    const [expenses, categories, totalCount] = await Promise.all([
      db.expenses.where('date').between(start, end, true, true).toArray(),
      db.categories.toArray(),
      db.expenses.count(),
    ])
    return { expenses, categories: new Map(categories.map((c) => [c.id, c])), totalCount }
  }, [year, month, calendar])
}
