import { describe, expect, it } from 'vitest'
import type { Expense } from '../../src/db/schema.ts'
import { groupByDay, sumAmounts } from '../../src/features/expenses/groupByDay.ts'

function expense(id: string, date: string, amount: number, createdAt: number): Expense {
  return { id, amount, categoryId: 'groceries', date, createdAt, updatedAt: createdAt }
}

describe('groupByDay', () => {
  it('returns no groups for no expenses', () => {
    expect(groupByDay([])).toEqual([])
  })

  it('groups by date, newest day first, with a daily total', () => {
    const groups = groupByDay([
      expense('a', '2026-11-02', 720000, 1),
      expense('b', '2026-11-03', 235000, 2),
      expense('c', '2026-11-02', 200000, 3),
      expense('d', '2026-11-03', 150000, 4),
    ])
    expect(groups.map((g) => [g.date, g.total])).toEqual([
      ['2026-11-03', 385000],
      ['2026-11-02', 920000],
    ])
  })

  it('puts the latest entry of a day first', () => {
    const [today] = groupByDay([
      expense('first', '2026-11-03', 1, 10),
      expense('last', '2026-11-03', 1, 30),
      expense('middle', '2026-11-03', 1, 20),
    ])
    expect(today.expenses.map((e) => e.id)).toEqual(['last', 'middle', 'first'])
  })

  it('does not reorder the input array', () => {
    const input = [expense('a', '2026-11-01', 1, 1), expense('b', '2026-11-03', 1, 2)]
    groupByDay(input)
    expect(input.map((e) => e.id)).toEqual(['a', 'b'])
  })
})

describe('sumAmounts', () => {
  it('adds integer Toman exactly', () => {
    expect(sumAmounts([expense('a', '2026-11-03', 100000, 1), expense('b', '2026-11-03', 200000, 2)])).toBe(300000)
  })
})
