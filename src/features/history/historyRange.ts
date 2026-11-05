import type { Adjustment, Turn, TurnService } from '../../db/schema.ts'
import { addDays, weekRange, type IsoDate } from '../../domain/dates.ts'
import { sumTotals } from '../../domain/totals.ts'

export type RangeChoice = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom'

export function rangeFor(
  choice: Exclude<RangeChoice, 'custom'>,
  today: IsoDate,
  weekStart: 0 | 1,
): { start: IsoDate; end: IsoDate } {
  switch (choice) {
    case 'today':
      return { start: today, end: today }
    case 'yesterday': {
      const day = addDays(today, -1)
      return { start: day, end: day }
    }
    case 'thisWeek':
      return weekRange(today, weekStart)
    case 'lastWeek':
      return weekRange(addDays(today, -7), weekStart)
  }
}

export interface DayGroup {
  date: IsoDate
  turns: Turn[]
  adjustments: Adjustment[]
  earnedCents: number
}

/** Newest day first; inside a day, newest turn first by the moment it happened. */
export function groupByDay(
  turns: readonly Turn[],
  adjustments: readonly Adjustment[],
): DayGroup[] {
  const byDate = new Map<IsoDate, { turns: Turn[]; adjustments: Adjustment[] }>()

  function dayOf(date: IsoDate) {
    const group = byDate.get(date)
    if (group) return group
    const created = { turns: [], adjustments: [] }
    byDate.set(date, created)
    return created
  }

  for (const turn of turns) dayOf(turn.localWorkDate).turns.push(turn)
  for (const adjustment of adjustments) dayOf(adjustment.localWorkDate).adjustments.push(adjustment)

  return [...byDate.entries()]
    .sort(([a], [b]) => (a === b ? 0 : a < b ? 1 : -1))
    .map(([date, group]) => {
      const dayTurns = [...group.turns].sort(
        (a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt,
      )
      const dayAdjustments = [...group.adjustments].sort(
        (a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt,
      )
      return {
        date,
        turns: dayTurns,
        adjustments: dayAdjustments,
        earnedCents: sumTotals(dayTurns, dayAdjustments).earnedCents,
      }
    })
}

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

/** Empty text matches everything; otherwise any service name may contain the text. */
export function matchesSearch(services: readonly TurnService[], text: string): boolean {
  const needle = fold(text.trim())
  if (needle === '') return true
  return services.some((service) => fold(service.serviceNameSnapshot).includes(needle))
}
