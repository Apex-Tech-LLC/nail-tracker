import type { IsoDate } from '../../domain/dates.ts'
import { allocationProblem, type AllocationLine } from '../../domain/payday.ts'
import type { NailDb, Payment, PaymentAllocation, PaymentMethod } from '../../db/schema.ts'

export interface PaymentInput {
  paymentDate: IsoDate
  amountCents: number
  paymentMethod: PaymentMethod
  notes?: string
  allocations: AllocationLine[]
}

function checkInput(input: PaymentInput): void {
  const problem = allocationProblem(input.amountCents, input.allocations)
  if (problem) throw new Error(problem)
}

function paymentRecord(
  id: string,
  input: PaymentInput,
  createdAt: number,
  now: number,
): Payment {
  const notes = input.notes?.trim()
  return {
    id,
    paymentDate: input.paymentDate,
    amountCents: input.amountCents,
    paymentMethod: input.paymentMethod,
    ...(notes ? { notes } : {}),
    createdAt,
    updatedAt: now,
  }
}

function allocationRows(paymentId: string, allocations: readonly AllocationLine[]): PaymentAllocation[] {
  return allocations.map((line) => ({
    id: crypto.randomUUID(),
    paymentId,
    payPeriodId: line.payPeriodId,
    amountCents: line.amountCents,
  }))
}

export async function addPayment(
  db: NailDb,
  input: PaymentInput,
  now: number = Date.now(),
): Promise<string> {
  checkInput(input)
  const id = crypto.randomUUID()

  await db.transaction('rw', db.payments, db.paymentAllocations, async () => {
    await db.payments.add(paymentRecord(id, input, now, now))
    await db.paymentAllocations.bulkAdd(allocationRows(id, input.allocations))
  })

  return id
}

export async function updatePayment(
  db: NailDb,
  id: string,
  input: PaymentInput,
  now: number = Date.now(),
): Promise<void> {
  checkInput(input)

  await db.transaction('rw', db.payments, db.paymentAllocations, async () => {
    const existing = await db.payments.get(id)
    if (!existing) throw new Error('Payment not found')

    await db.payments.put(paymentRecord(id, input, existing.createdAt, now))
    await db.paymentAllocations.where('paymentId').equals(id).delete()
    await db.paymentAllocations.bulkAdd(allocationRows(id, input.allocations))
  })
}

export async function deletePayment(db: NailDb, id: string): Promise<void> {
  await db.transaction('rw', db.payments, db.paymentAllocations, async () => {
    await db.payments.delete(id)
    await db.paymentAllocations.where('paymentId').equals(id).delete()
  })
}

export interface PaymentForPeriod {
  payment: Payment
  allocatedCents: number
}

export async function loadPaymentsForPeriod(
  db: NailDb,
  periodId: string,
): Promise<PaymentForPeriod[]> {
  const allocations = await db.paymentAllocations
    .where('payPeriodId')
    .equals(periodId)
    .toArray()
  if (allocations.length === 0) return []

  const payments = await db.payments
    .where('id')
    .anyOf(allocations.map((allocation) => allocation.paymentId))
    .toArray()
  const byId = new Map(payments.map((payment) => [payment.id, payment]))

  return allocations
    .flatMap((allocation) => {
      const payment = byId.get(allocation.paymentId)
      return payment ? [{ payment, allocatedCents: allocation.amountCents }] : []
    })
    .sort(
      (a, b) =>
        b.payment.paymentDate.localeCompare(a.payment.paymentDate) ||
        b.payment.createdAt - a.payment.createdAt,
    )
}
