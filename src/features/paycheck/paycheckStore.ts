import type { IsoDate } from '../../domain/dates.ts'
import type { Stub } from '../../domain/paycheckCheck.ts'
import type { NailDb, PaycheckRecord } from '../../db/schema.ts'
import { loadPaymentsForPeriod } from '../payday/paymentStore.ts'

export interface PeriodPayments {
  checkCents: number
  cashCents: number
  otherCents: number
  count: number
}

/**
 * What the salon paid for this period, split the way the check compares it:
 * the check part, the cash part, and everything else.
 */
export async function loadPeriodPayments(
  db: NailDb,
  periodId: string,
): Promise<PeriodPayments> {
  const rows = await loadPaymentsForPeriod(db, periodId)
  const totals: PeriodPayments = { checkCents: 0, cashCents: 0, otherCents: 0, count: 0 }

  for (const { payment, allocatedCents } of rows) {
    totals.count += 1
    if (payment.paymentMethod === 'check') totals.checkCents += allocatedCents
    else if (payment.paymentMethod === 'cash') totals.cashCents += allocatedCents
    else totals.otherCents += allocatedCents
  }

  return totals
}

export function stubFromRecord(record: PaycheckRecord | null): Stub | null {
  if (!record) return null
  return {
    servicesCents: record.stubServicesCents,
    tipsCents: record.stubTipsCents,
    deductionsCents: record.stubDeductionsCents,
  }
}

async function recordForPeriod(
  db: NailDb,
  periodId: string,
): Promise<PaycheckRecord | undefined> {
  return db.paycheckRecords.where('payPeriodId').equals(periodId).first()
}

/** Saves the stub numbers, creating the period's record the first time. */
export async function saveStub(
  db: NailDb,
  periodId: string,
  stub: Stub,
  now: number = Date.now(),
): Promise<void> {
  const existing = await recordForPeriod(db, periodId)
  if (existing) {
    await db.paycheckRecords.update(existing.id, {
      stubServicesCents: stub.servicesCents,
      stubTipsCents: stub.tipsCents,
      stubDeductionsCents: stub.deductionsCents,
      updatedAt: now,
    })
    return
  }

  await db.paycheckRecords.add({
    id: crypto.randomUUID(),
    payPeriodId: periodId,
    stubServicesCents: stub.servicesCents,
    stubTipsCents: stub.tipsCents,
    stubDeductionsCents: stub.deductionsCents,
    checkedDate: null,
    createdAt: now,
    updatedAt: now,
  })
}

/** Sets or clears the day the technician checked this period's paycheck. */
export async function setCheckedDate(
  db: NailDb,
  periodId: string,
  checkedDate: IsoDate | null,
  now: number = Date.now(),
): Promise<void> {
  const existing = await recordForPeriod(db, periodId)
  if (existing) {
    await db.paycheckRecords.update(existing.id, { checkedDate, updatedAt: now })
    return
  }

  await db.paycheckRecords.add({
    id: crypto.randomUUID(),
    payPeriodId: periodId,
    stubServicesCents: null,
    stubTipsCents: null,
    stubDeductionsCents: null,
    checkedDate,
    createdAt: now,
    updatedAt: now,
  })
}

export { recordForPeriod as loadPaycheckRecord }
