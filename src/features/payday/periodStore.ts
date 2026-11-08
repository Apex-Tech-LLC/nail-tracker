import type {
  Adjustment,
  NailDb,
  PaycheckRecord,
  PayPeriod,
  Payment,
  PaymentAllocation,
  Turn,
  TurnService,
  WorkDay,
} from '../../db/schema.ts'
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
import { loadRange, loadTurnDates } from '../turns/turnStore.ts'
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


/** The money side of a period, taken from the payment records once for a whole list. */
interface PeriodMoney {
  paidByPeriod: Map<string, number>
  receivedByPeriod: Map<string, Received>
  paymentCountByPeriod: Map<string, number>
  recordByPeriod: Map<string, PaycheckRecord>
}

function periodMoney(
  allocations: readonly PaymentAllocation[],
  payments: readonly Payment[],
  records: readonly PaycheckRecord[],
): PeriodMoney {
  const methodByPayment = new Map(payments.map((payment) => [payment.id, payment.paymentMethod]))
  const money: PeriodMoney = {
    paidByPeriod: new Map(),
    receivedByPeriod: new Map(),
    paymentCountByPeriod: new Map(),
    recordByPeriod: new Map(records.map((record) => [record.payPeriodId, record])),
  }

  for (const allocation of allocations) {
    const periodId = allocation.payPeriodId
    money.paidByPeriod.set(
      periodId,
      (money.paidByPeriod.get(periodId) ?? 0) + allocation.amountCents,
    )

    const received = money.receivedByPeriod.get(periodId) ?? {
      checkCents: 0,
      cashCents: 0,
      otherCents: 0,
    }
    const method = methodByPayment.get(allocation.paymentId)
    if (method === 'check') received.checkCents += allocation.amountCents
    else if (method === 'cash') received.cashCents += allocation.amountCents
    else received.otherCents += allocation.amountCents
    money.receivedByPeriod.set(periodId, received)
    money.paymentCountByPeriod.set(
      periodId,
      (money.paymentCountByPeriod.get(periodId) ?? 0) + 1,
    )
  }

  return money
}

function summarizePeriod(input: {
  period: PayPeriod
  turns: readonly Turn[]
  adjustments: readonly Adjustment[]
  services: readonly TurnService[]
  workDays: readonly WorkDay[]
  rules: readonly PayRules[]
  money: PeriodMoney
}): PeriodSummary {
  const { period, turns, adjustments, services, workDays, rules, money } = input
  const totals = sumTotals(turns, adjustments)
  const workDateByTurn = new Map(
    turns.map((turn): [string, IsoDate] => [turn.id, turn.localWorkDate]),
  )
  const statement = buildStatement({
    services: services.map((service) => ({
      localWorkDate: workDateByTurn.get(service.turnId) ?? period.startDate,
      priceCents: service.servicePriceCents,
      commissionRateBp: service.commissionRateSnapshotBp,
      commissionCents: service.commissionCents,
    })),
    turns,
    adjustments,
    rules,
    periodEnd: period.endDate,
    daysOff: dayOffDates(workDays),
  })
  const paidCents = money.paidByPeriod.get(period.id) ?? 0
  const { outstandingCents, state } = payState(statement.salonPaysCents, paidCents)
  const received = money.receivedByPeriod.get(period.id) ?? {
    checkCents: 0,
    cashCents: 0,
    otherCents: 0,
  }
  const record = money.recordByPeriod.get(period.id) ?? null
  const paymentsCount = money.paymentCountByPeriod.get(period.id) ?? 0

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
}

/** The period holding `date`, or -1. Periods never overlap, so this is a plain binary search. */
function periodIndexAt(periods: readonly PayPeriod[], date: IsoDate): number {
  let low = 0
  let high = periods.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const period = periods[middle]
    if (date < period.startDate) high = middle - 1
    else if (date > period.endDate) low = middle + 1
    else return middle
  }
  return -1
}

function emptyBuckets<T>(count: number): T[][] {
  return Array.from({ length: count }, () => [])
}

/**
 * Every period's figures. One indexed read of the whole span covers every
 * period, then each period is split out in memory: a week-by-week read would
 * mean hundreds of database round trips on a five-year history.
 */
export async function loadPeriodSummaries(db: NailDb): Promise<PeriodSummary[]> {
  const [periods, allocations, rules, payments, records] = await Promise.all([
    db.payPeriods.orderBy('startDate').toArray(),
    db.paymentAllocations.toArray(),
    db.payRules.toArray(),
    db.payments.toArray(),
    db.paycheckRecords.toArray(),
  ])

  if (periods.length === 0) return []

  const spanStart = periods.reduce(
    (earliest, period) => (period.startDate < earliest ? period.startDate : earliest),
    periods[0].startDate,
  )
  const spanEnd = periods.reduce(
    (latest, period) => (period.endDate > latest ? period.endDate : latest),
    periods[0].endDate,
  )
  const [range, allServices, workDays] = await Promise.all([
    loadTurnDates(db, spanStart, spanEnd),
    // One sequential read of the lines beats one index lookup per turn id on a
    // five-year history; lines of turns outside the span are dropped below.
    db.turnServices.toArray(),
    loadWorkDays(db, spanStart, spanEnd),
  ])

  const turnsByPeriod = emptyBuckets<Turn>(periods.length)
  for (const turn of range.turns) {
    const index = periodIndexAt(periods, turn.localWorkDate)
    if (index !== -1) turnsByPeriod[index].push(turn)
  }
  const adjustmentsByPeriod = emptyBuckets<Adjustment>(periods.length)
  for (const adjustment of range.adjustments) {
    const index = periodIndexAt(periods, adjustment.localWorkDate)
    if (index !== -1) adjustmentsByPeriod[index].push(adjustment)
  }
  const servicesByTurnId = new Map<string, TurnService[]>()
  for (const service of allServices) {
    const list = servicesByTurnId.get(service.turnId)
    if (list) list.push(service)
    else servicesByTurnId.set(service.turnId, [service])
  }
  const workDaysByPeriod = periods.map((period) =>
    workDays.filter((day) => day.date >= period.startDate && day.date <= period.endDate),
  )
  const money = periodMoney(allocations, payments, records)

  return periods.map((period, index) => {
    const periodTurns = turnsByPeriod[index]
    const periodServices: TurnService[] = []
    for (const turn of periodTurns) {
      const lines = servicesByTurnId.get(turn.id)
      if (lines) periodServices.push(...lines)
    }
    return summarizePeriod({
      period,
      turns: periodTurns,
      adjustments: adjustmentsByPeriod[index],
      services: periodServices,
      workDays: workDaysByPeriod[index],
      rules,
      money,
    })
  })
}

/** One period's figures, for the period page and the record form: no other period is read. */
export async function loadPeriodSummary(
  db: NailDb,
  periodId: string,
): Promise<PeriodSummary | null> {
  const period = await db.payPeriods.get(periodId)
  if (!period) return null

  const [allocations, rules, payments, record, range, workDays] = await Promise.all([
    db.paymentAllocations.where('payPeriodId').equals(periodId).toArray(),
    db.payRules.toArray(),
    db.payments.toArray(),
    db.paycheckRecords.where('payPeriodId').equals(periodId).first(),
    loadRange(db, period.startDate, period.endDate),
    loadWorkDays(db, period.startDate, period.endDate),
  ])

  return summarizePeriod({
    period,
    turns: range.turns,
    adjustments: range.adjustments,
    services: range.services,
    workDays,
    rules,
    money: periodMoney(allocations, payments, record === undefined ? [] : [record]),
  })
}

/** Which periods have turns and were checked, for Home's reminder: no statements worked out. */
export interface PeriodPresence {
  period: PayPeriod
  statementTurns: number
  checkedDate: IsoDate | null
}

export async function loadPeriodPresence(db: NailDb): Promise<PeriodPresence[]> {
  const [periods, records] = await Promise.all([
    db.payPeriods.orderBy('startDate').toArray(),
    db.paycheckRecords.toArray(),
  ])
  if (periods.length === 0) return []

  const spanStart = periods.reduce(
    (earliest, period) => (period.startDate < earliest ? period.startDate : earliest),
    periods[0].startDate,
  )
  const spanEnd = periods.reduce(
    (latest, period) => (period.endDate > latest ? period.endDate : latest),
    periods[0].endDate,
  )
  const turns = await db.turns.where('localWorkDate').between(spanStart, spanEnd, true, true).toArray()
  const turnsByPeriod = new Array<number>(periods.length).fill(0)
  for (const turn of turns) {
    const index = periodIndexAt(periods, turn.localWorkDate)
    if (index !== -1) turnsByPeriod[index] += turn.turnCount
  }
  const recordByPeriod = new Map(records.map((record) => [record.payPeriodId, record]))

  return periods.map((period, index) => ({
    period,
    statementTurns: turnsByPeriod[index],
    checkedDate: recordByPeriod.get(period.id)?.checkedDate ?? null,
  }))
}
