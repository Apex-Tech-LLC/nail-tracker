import type { NailDb, PaycheckRecord, PayPeriod } from '../../db/schema.ts'
import { addDays, type IsoDate } from '../../domain/dates.ts'
import {
  customPeriodProblem,
  missingPeriods,
  periodId,
  type PayPeriodType,
} from '../../domain/payPeriods.ts'
import {
  checkPaycheck,
  type CheckResult,
  type Received,
} from '../../domain/paycheckCheck.ts'
import { rulesOn, type PayRules } from '../../domain/payRules.ts'
import { payState, type PayStateName } from '../../domain/payday.ts'
import { buildStatement, type Statement } from '../../domain/statement.ts'
import { sumTotals, type Totals } from '../../domain/totals.ts'
import { dayOffDates, loadWorkDays } from '../history/workDays.ts'
import { loadRange } from '../turns/turnStore.ts'
import { stubFromRecord } from '../paycheck/paycheckStore.ts'

export interface PeriodSummary {
  period: PayPeriod
  totals: Totals
  statement: Statement
  endRules: Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'>
  paidCents: number
  outstandingCents: number
  state: PayStateName
  /** What was paid for this period, split by the way it arrived. */
  received: Received
  paymentsCount: number
  record: PaycheckRecord | null
  /** Null until at least one payment is recorded. */
  check: CheckResult | null
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
  const [periods, allocations, rules, payments, records] = await Promise.all([
    db.payPeriods.orderBy('startDate').toArray(),
    db.paymentAllocations.toArray(),
    db.payRules.toArray(),
    db.payments.toArray(),
    db.paycheckRecords.toArray(),
  ])

  const methodByPayment = new Map(payments.map((payment) => [payment.id, payment.paymentMethod]))
  const paidByPeriod = new Map<string, number>()
  const receivedByPeriod = new Map<string, Received>()
  const paymentCountByPeriod = new Map<string, number>()

  for (const allocation of allocations) {
    paidByPeriod.set(
      allocation.payPeriodId,
      (paidByPeriod.get(allocation.payPeriodId) ?? 0) + allocation.amountCents,
    )

    const received = receivedByPeriod.get(allocation.payPeriodId) ?? {
      checkCents: 0,
      cashCents: 0,
      otherCents: 0,
    }
    const method = methodByPayment.get(allocation.paymentId)
    if (method === 'check') received.checkCents += allocation.amountCents
    else if (method === 'cash') received.cashCents += allocation.amountCents
    else received.otherCents += allocation.amountCents
    receivedByPeriod.set(allocation.payPeriodId, received)
    paymentCountByPeriod.set(
      allocation.payPeriodId,
      (paymentCountByPeriod.get(allocation.payPeriodId) ?? 0) + 1,
    )
  }

  const recordByPeriod = new Map(records.map((record) => [record.payPeriodId, record]))

  return Promise.all(
    periods.map(async (period) => {
      const [range, workDays] = await Promise.all([
        loadRange(db, period.startDate, period.endDate),
        loadWorkDays(db, period.startDate, period.endDate),
      ])
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
        daysOff: dayOffDates(workDays),
      })
      const paidCents = paidByPeriod.get(period.id) ?? 0
      const { outstandingCents, state } = payState(statement.salonPaysCents, paidCents)
      const received = receivedByPeriod.get(period.id) ?? {
        checkCents: 0,
        cashCents: 0,
        otherCents: 0,
      }
      const record = recordByPeriod.get(period.id) ?? null
      const paymentsCount = paymentCountByPeriod.get(period.id) ?? 0

      return {
        period,
        totals,
        statement,
        endRules: rulesOn(rules, period.endDate),
        paidCents,
        outstandingCents,
        state,
        received,
        paymentsCount,
        record,
        check: paymentsCount > 0 ? checkPaycheck(statement, received, stubFromRecord(record)) : null,
      }
    }),
  )
}
