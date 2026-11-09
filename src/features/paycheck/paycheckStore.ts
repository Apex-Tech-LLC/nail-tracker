import type { IsoDate } from '../../domain/dates.ts'
import type { Stub } from '../../domain/paycheckCheck.ts'
import type { NailDb, PaycheckRecord, PaymentMethod } from '../../db/schema.ts'
import type { PeriodSummary } from '../payday/periodStore.ts'
import { addPayment, deletePayment, loadPaymentsForPeriod } from '../payday/paymentStore.ts'

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

/** One amount the salon paid for a period, in the way it arrived. */
export interface PeriodPaymentPart {
  method: PaymentMethod
  cents: number
}

/**
 * Records each part as its own payment, fully allocated to this period.
 * Parts of zero or less are left out. Returns the new payment ids.
 */
export async function addPeriodPayments(
  db: NailDb,
  periodId: string,
  paymentDate: IsoDate,
  parts: readonly PeriodPaymentPart[],
  now: number = Date.now(),
): Promise<string[]> {
  return db.transaction('rw', db.payments, db.paymentAllocations, async () => {
    const ids: string[] = []
    for (const part of parts) {
      if (part.cents <= 0) continue
      ids.push(
        await addPayment(
          db,
          {
            paymentDate,
            amountCents: part.cents,
            paymentMethod: part.method,
            allocations: [{ payPeriodId: periodId, amountCents: part.cents }],
          },
          now,
        ),
      )
    }
    return ids
  })
}

/**
 * The payments that match the statement, or null when the one-tap button does
 * not apply: something is already recorded or checked, the salon pays nothing,
 * or there is no check/cash split to copy.
 */
export function exactPaymentParts(summary: PeriodSummary): PeriodPaymentPart[] | null {
  const { statement, record, paymentsCount } = summary
  const { checkCents, cashCents, salonPaysCents } = statement
  if (paymentsCount !== 0 || record?.checkedDate != null) return null
  if (salonPaysCents <= 0 || checkCents === null || cashCents === null) return null
  if (checkCents < 0 || cashCents < 0) return null

  const parts: PeriodPaymentPart[] = []
  if (checkCents > 0) parts.push({ method: 'check', cents: checkCents })
  if (cashCents > 0) parts.push({ method: 'cash', cents: cashCents })
  return parts
}

/** The salon paid exactly the statement: record the parts and mark the period checked, together. */
export async function recordExactPayment(
  db: NailDb,
  periodId: string,
  today: IsoDate,
  parts: readonly PeriodPaymentPart[],
  now: number = Date.now(),
): Promise<string[]> {
  return db.transaction('rw', db.payments, db.paymentAllocations, db.paycheckRecords, async () => {
    const ids = await addPeriodPayments(db, periodId, today, parts, now)
    await setCheckedDate(db, periodId, today, now)
    return ids
  })
}

/** Takes back recordExactPayment: deletes only those payments and clears the checked day. */
export async function undoExactPayment(
  db: NailDb,
  periodId: string,
  paymentIds: readonly string[],
  now: number = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.payments, db.paymentAllocations, db.paycheckRecords, async () => {
    for (const id of paymentIds) await deletePayment(db, id)
    await setCheckedDate(db, periodId, null, now)
  })
}
