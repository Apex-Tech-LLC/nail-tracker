import { todayIso } from '../lib/jalali.ts'
import { db, type Expense } from './schema.ts'

// Development only: fills the list so screens can be checked before the
// add form exists. Loaded with a dynamic import behind import.meta.env.DEV,
// so it is not part of the production bundle.
const SAMPLES: [daysAgo: number, categoryId: string, amount: number, note?: string][] = [
  [0, 'groceries', 235000, 'میوه و نان'],
  [0, 'transport', 150000, 'تاکسی'],
  [1, 'bills', 720000, 'اینترنت'],
  [1, 'cafe', 200000],
  [3, 'groceries', 480000, 'خرید هفتگی'],
  [4, 'health', 350000, 'داروخانه'],
  [6, 'shopping', 1250000, 'کفش'],
  [8, 'transport', 90000],
]

export async function addSampleExpenses(): Promise<void> {
  const now = Date.now()
  const expenses: Expense[] = SAMPLES.map(([daysAgo, categoryId, amount, note], i) => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return {
      id: crypto.randomUUID(),
      amount,
      categoryId,
      date: todayIso(date),
      note,
      createdAt: now - i * 60_000,
      updatedAt: now - i * 60_000,
    }
  })
  await db.expenses.bulkAdd(expenses)
}
