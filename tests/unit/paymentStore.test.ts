import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import { periodId } from '../../src/domain/payPeriods.ts'
import {
  addPayment,
  deletePayment,
  loadPaymentsForPeriod,
  updatePayment,
  type PaymentInput,
} from '../../src/features/payday/paymentStore.ts'

let db: NailDb
let counter = 0

function openFresh() {
  db = createDb(`test-${++counter}`)
  return db
}

afterEach(async () => {
  await db.delete()
})

const WEEK_ONE = periodId('2026-11-01', '2026-11-07')
const WEEK_TWO = periodId('2026-11-08', '2026-11-14')

function paymentInput(overrides: Partial<PaymentInput> = {}): PaymentInput {
  return {
    paymentDate: '2026-11-04',
    amountCents: 90000,
    paymentMethod: 'directDeposit',
    allocations: [
      { payPeriodId: WEEK_ONE, amountCents: 60000 },
      { payPeriodId: WEEK_TWO, amountCents: 30000 },
    ],
    ...overrides,
  }
}

describe('addPayment', () => {
  it('saves the payment and one allocation row per line', async () => {
    const fresh = openFresh()

    const id = await addPayment(fresh, paymentInput({ notes: '  ' }), 100)

    const payment = await fresh.payments.get(id)
    expect(payment).toMatchObject({
      id,
      paymentDate: '2026-11-04',
      amountCents: 90000,
      paymentMethod: 'directDeposit',
      createdAt: 100,
      updatedAt: 100,
    })
    expect(payment).not.toHaveProperty('notes')

    const allocations = await fresh.paymentAllocations.where('paymentId').equals(id).toArray()
    expect(allocations).toHaveLength(2)
    expect(allocations.map((row) => [row.payPeriodId, row.amountCents]).sort()).toEqual(
      [
        [WEEK_ONE, 60000],
        [WEEK_TWO, 30000],
      ].sort(),
    )
    expect(new Set(allocations.map((row) => row.id)).size).toBe(2)
  })

  it('rejects lines that do not add up and saves nothing', async () => {
    const fresh = openFresh()

    await expect(
      addPayment(
        fresh,
        paymentInput({
          allocations: [
            { payPeriodId: WEEK_ONE, amountCents: 60000 },
            { payPeriodId: WEEK_TWO, amountCents: 20000 },
          ],
        }),
      ),
    ).rejects.toThrow('mismatch')

    expect(await fresh.payments.count()).toBe(0)
    expect(await fresh.paymentAllocations.count()).toBe(0)
  })

  it('rejects an amount of zero', async () => {
    const fresh = openFresh()

    await expect(addPayment(fresh, paymentInput({ amountCents: 0 }))).rejects.toThrow('amount')

    expect(await fresh.payments.count()).toBe(0)
  })
})

describe('updatePayment', () => {
  it('keeps createdAt and replaces the allocation rows', async () => {
    const fresh = openFresh()
    const id = await addPayment(fresh, paymentInput(), 100)
    const oldRows = await fresh.paymentAllocations.where('paymentId').equals(id).toArray()

    await updatePayment(
      fresh,
      id,
      paymentInput({
        paymentDate: '2026-11-10',
        amountCents: 50000,
        paymentMethod: 'zelle',
        notes: 'edited',
        allocations: [{ payPeriodId: WEEK_TWO, amountCents: 50000 }],
      }),
      200,
    )

    expect(await fresh.payments.get(id)).toMatchObject({
      createdAt: 100,
      updatedAt: 200,
      paymentDate: '2026-11-10',
      amountCents: 50000,
      paymentMethod: 'zelle',
      notes: 'edited',
    })

    const newRows = await fresh.paymentAllocations.where('paymentId').equals(id).toArray()
    expect(newRows).toHaveLength(1)
    expect(newRows[0]).toMatchObject({ payPeriodId: WEEK_TWO, amountCents: 50000 })
    for (const oldRow of oldRows) {
      expect(await fresh.paymentAllocations.get(oldRow.id)).toBeUndefined()
    }
  })

  it('rejects a missing payment', async () => {
    const fresh = openFresh()

    await expect(updatePayment(fresh, 'missing', paymentInput())).rejects.toThrow(
      'Payment not found',
    )
  })
})

describe('deletePayment', () => {
  it('removes the payment and its allocation rows', async () => {
    const fresh = openFresh()
    const id = await addPayment(fresh, paymentInput())

    await deletePayment(fresh, id)

    expect(await fresh.payments.count()).toBe(0)
    expect(await fresh.paymentAllocations.count()).toBe(0)
  })
})

describe('loadPaymentsForPeriod', () => {
  it('returns the allocated part of each payment, newest first', async () => {
    const fresh = openFresh()
    const older = await addPayment(
      fresh,
      paymentInput({
        paymentDate: '2026-11-02',
        amountCents: 60000,
        allocations: [{ payPeriodId: WEEK_ONE, amountCents: 60000 }],
      }),
      100,
    )
    const newer = await addPayment(
      fresh,
      paymentInput({
        paymentDate: '2026-11-05',
        amountCents: 50000,
        allocations: [
          { payPeriodId: WEEK_ONE, amountCents: 25000 },
          { payPeriodId: WEEK_TWO, amountCents: 25000 },
        ],
      }),
      200,
    )

    const rows = await loadPaymentsForPeriod(fresh, WEEK_ONE)

    expect(rows.map((row) => [row.payment.id, row.allocatedCents])).toEqual([
      [newer, 25000],
      [older, 60000],
    ])
  })
})
