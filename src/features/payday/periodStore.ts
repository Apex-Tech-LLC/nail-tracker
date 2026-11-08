import type { NailDb, PayPeriod } from '../../db/schema.ts'
import { addDays, type IsoDate } from '../../domain/dates.ts'
import {
  customPeriodProblem,
  missingPeriods,
  periodId,
  type PayPeriodType,
} from '../../domain/payPeriods.ts'
import { rulesOn, type PayRules } from '../../domain/payRules.ts'
import { payState, type PayStateName } from '../../domain/payday.ts'
import { buildStatement, type Statement } from '../../domain/statement.ts'
import { sumTotals, type Totals } from '../../domain/totals.ts'
import { loadRange } from '../turns/turnStore.ts'

export interface PeriodSummary {
  period: PayPeriod
  totals: Totals
  statement: Statement
  endRules: Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'>
  paidCents: number
  outstandingCents: number
  state: PayStateName
}

/**
 * Fills in every scheduled period the technician could have worked, from the
 * schedule anchor (or an earlier turn or adjustment, but no more than ten
 * years back) up to today. bulkPut keeps a double run harmless.
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

  // A mistyped year (0202 for 2026) would otherwise build centuries of weekly
  // periods and freeze the Payday tab. Ten years back is the oldest work or pay
  // that can still be owed.
  const earliestLimit = addDays(today, -3653)

  // The schedule starts at its anchor, so that is the earliest period even
  // before the first turn or adjustment is recorded.
  let earliest = today
  for (const date of [firstTurn?.localWorkDate, firstAdjustment?.localWorkDate, schedule.anchor]) {
    if (date != null && date < earliest) earliest = date
  }
  if (earliest < earliestLimit) earliest = earliestLimit

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
  const [periods, allocations, rules] = await Promise.all([
    db.payPeriods.orderBy('startDate').toArray(),
    db.paymentAllocations.toArray(),
    db.payRules.toArray(),
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
      const workDateByTurn = new Map(
        range.turns.map((turn): [string, IsoDate] => [turn.id, turn.localWorkDate]),
      )
      const statement = buildStatement({
        services: range.services.map((service) => ({
          localWorkDate: workDateByTurn.get(service.turnId) ?? period.startDate,
          priceCents: service.servicePriceCents,
          commissionRateBp: service.commissionRateSnapshotBp,
          commissionCents: service.commissionCents,
        })),
        turns: range.turns,
        adjustments: range.adjustments,
        rules,
        periodEnd: period.endDate,
      })
      const paidCents = paidByPeriod.get(period.id) ?? 0
      const { outstandingCents, state } = payState(statement.salonPaysCents, paidCents)

      return {
        period,
        totals,
        statement,
        endRules: rulesOn(rules, period.endDate),
        paidCents,
        outstandingCents,
        state,
      }
    }),
  )
}
