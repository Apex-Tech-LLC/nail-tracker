import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import { loadEarnings } from '../../src/features/earnings/earningsData.ts'
import { addTurn } from '../../src/features/turns/turnStore.ts'

let db: NailDb
let counter = 0

function openFresh() {
  db = createDb(`test-${++counter}`)
  return db
}

afterEach(async () => {
  await db.delete()
})

/** A $100 turn at 60% on Monday Nov 2: cash $10 in hand, card $15 still with the salon. */
async function seedWeek(fresh: NailDb): Promise<void> {
  await addTurn(fresh, {
    occurredAt: 1_800_000_000_000,
    localWorkDate: '2026-11-02',
    turnCount: 1,
    clientType: 'walkIn',
    cashTipCents: 1000,
    cardTipCents: 1500,
    cashTipReceived: true,
    cardTipReceived: false,
    lines: [{ servicePresetId: null, name: 'Manicure', priceCents: 10000, rateBp: 6000 }],
  })
  await fresh.payments.add({
    id: 'payment-1',
    paymentDate: '2026-11-03',
    amountCents: 4000,
    paymentMethod: 'cash',
    createdAt: 1,
    updatedAt: 1,
  })
}

describe('loadEarnings', () => {
  it('shows what was earned and paid in the range, and what is still owed in total', async () => {
    const fresh = openFresh()
    await seedWeek(fresh)

    const earnings = await loadEarnings(fresh, '2026-11-01', '2026-11-07')

    expect(earnings.totals.earnedCents).toBe(8500)
    expect(earnings.paidInRangeCents).toBe(4000)
    // Commission $60 + card tip $15, less the $40 payment.
    expect(earnings.outstandingAllTimeCents).toBe(3500)
  })

  it('a range with nothing in it still shows the all-time balance', async () => {
    const fresh = openFresh()
    await seedWeek(fresh)

    const earnings = await loadEarnings(fresh, '2026-12-01', '2026-12-07')

    expect(earnings.totals.earnedCents).toBe(0)
    expect(earnings.paidInRangeCents).toBe(0)
    expect(earnings.outstandingAllTimeCents).toBe(3500)
  })
})
