import type { NailDb, PayPeriod } from '../../db/schema.ts'
import type { IsoDate } from '../../domain/dates.ts'
import {
  customPeriodProblem,
  missingPeriods,
  periodId,
  type PayPeriodType,
} from '../../domain/payPeriods.ts'
import { payState, type PayStateName } from '../../domain/payday.ts'
import { sumTotals, type Totals } from '../../domain/totals.ts'
import { loadRange } from '../turns/turnStore.ts'

export interface PeriodSummary {
  period: PayPeriod
  totals: Totals
  paidCents: number
  outstandingCents: number
  state: PayStateName
}

/**
 * Fills in every scheduled period the technician could have worked, from the
 * schedule anchor (or an earlier turn or adjustment) up to today. bulkPut
 * keeps a double run harmless.
 */
export async function ensurePayPeriods(
  db: NailDb,
  schedule: { type: PayPeriodType; anchor: IsoDate | null },
  today: IsoDate,
  now: number = Date.now(),
): Promise<void> {
  const [firstTurn, firstAdjustment, existing] = await Promise.all([
    db.turns.orderBy('localWorkDate').first(),
    db.adjustments.orderBy('localWorkDate').first(),
    db.payPeriods.toArray(),
  ])

  // The schedule starts at its anchor, so that is the earliest period even
  // before the first turn or adjustment is recorded.
  let earliest = today
  for (const date of [firstTurn?.localWorkDate, firstAdjustment?.localWorkDate, schedule.anchor]) {
    if (date != null && date < earliest) earliest = date
  }

  const missing = missingPeriods(existing, schedule, earliest, today)
  if (missing.length === 0) return

  await db.payPeriods.bulkPut(
    missing.map((span) => ({
      id: periodId(span.startDate, span.endDate),
      startDate: span.startDate,
      endDate: span.endDate,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })),
  )
}

export async function addCustomPeriod(
  db: NailDb,
  start: IsoDate,
  end: IsoDate,
  now: number = Date.now(),
): Promise<string> {
  const existing = await db.payPeriods.toArray()
  const problem = customPeriodProblem(start, end, existing)
  if (problem) throw new Error(problem)

  const id = periodId(start, end)
  await db.payPeriods.add({
    id,
    startDate: start,
    endDate: end,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function setPeriodStatus(
  db: NailDb,
  id: string,
  status: 'open' | 'closed',
  now: number = Date.now(),
): Promise<void> {
  await db.payPeriods.update(id, { status, updatedAt: now })
}

/** A period that already has allocated money is kept, so the payment trail stays intact. */
export async function deletePeriod(db: NailDb, id: string): Promise<boolean> {
  const allocation = await db.paymentAllocations.where('payPeriodId').equals(id).first()
  if (allocation) return false

  await db.payPeriods.delete(id)
  return true
}

export async function loadPeriodSummaries(db: NailDb): Promise<PeriodSummary[]> {
  const [periods, allocations] = await Promise.all([
    db.payPeriods.orderBy('startDate').toArray(),
    db.paymentAllocations.toArray(),
  ])

  const paidByPeriod = new Map<string, number>()
  for (const allocation of allocations) {
    paidByPeriod.set(
      allocation.payPeriodId,
      (paidByPeriod.get(allocation.payPeriodId) ?? 0) + allocation.amountCents,
    )
  }

  return Promise.all(
    periods.map(async (period) => {
      const range = await loadRange(db, period.startDate, period.endDate)
      const totals = sumTotals(range.turns, range.adjustments)
      const paidCents = paidByPeriod.get(period.id) ?? 0
      const { outstandingCents, state } = payState(totals.expectedPayoutCents, paidCents)

      return { period, totals, paidCents, outstandingCents, state }
    }),
  )
}
