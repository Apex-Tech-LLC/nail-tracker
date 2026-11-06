import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import { addTurn, type TurnInput } from '../../src/features/turns/turnStore.ts'
import {
  addCustomPeriod,
  deletePeriod,
  ensurePayPeriods,
  loadPeriodSummaries,
  setPeriodStatus,
} from '../../src/features/payday/periodStore.ts'

let db: NailDb
let counter = 0

function openFresh() {
  db = createDb(`test-${++counter}`)
  return db
}

afterEach(async () => {
  await db.delete()
})

const weekly = { type: 'weekly', anchor: '2026-11-01' } as const

function turnInput(overrides: Partial<TurnInput> = {}): TurnInput {
  return {
    occurredAt: 1_800_000_000_000,
    localWorkDate: '2026-11-04',
    turnCount: 1,
    clientType: 'walkIn',
    cashTipCents: 0,
    cardTipCents: 0,
    cashTipReceived: false,
    cardTipReceived: false,
    lines: [{ servicePresetId: null, name: 'Manicure', priceCents: 10000, rateBp: 6000 }],
    ...overrides,
  }
}

async function periodsOldestFirst(fresh: NailDb) {
  return (await fresh.payPeriods.toArray()).sort((a, b) => a.startDate.localeCompare(b.startDate))
}

describe('ensurePayPeriods', () => {
  it('fills every scheduled period from today back to the anchor', async () => {
    const fresh = openFresh()

    await ensurePayPeriods(fresh, weekly, '2026-11-16', 100)

    expect(await periodsOldestFirst(fresh)).toEqual([
      {
        id: 'period-2026-11-01-2026-11-07',
        startDate: '2026-11-01',
        endDate: '2026-11-07',
        status: 'open',
        createdAt: 100,
        updatedAt: 100,
      },
      {
        id: 'period-2026-11-08-2026-11-14',
        startDate: '2026-11-08',
        endDate: '2026-11-14',
        status: 'open',
        createdAt: 100,
        updatedAt: 100,
      },
      {
        id: 'period-2026-11-15-2026-11-21',
        startDate: '2026-11-15',
        endDate: '2026-11-21',
        status: 'open',
        createdAt: 100,
        updatedAt: 100,
      },
    ])

    const summaries = await loadPeriodSummaries(fresh)
    expect(summaries.map((summary) => summary.period.startDate)).toEqual([
      '2026-11-01',
      '2026-11-08',
      '2026-11-15',
    ])
  })

  it('changes nothing when it runs a second time', async () => {
    const fresh = openFresh()

    await ensurePayPeriods(fresh, weekly, '2026-11-16', 100)
    await ensurePayPeriods(fresh, weekly, '2026-11-16', 200)

    const periods = await periodsOldestFirst(fresh)
    expect(periods).toHaveLength(3)
    expect(periods[0]).toMatchObject({ createdAt: 100, updatedAt: 100 })
  })

  it('starts earlier when a turn was recorded before the anchor', async () => {
    const fresh = openFresh()
    await addTurn(fresh, turnInput({ localWorkDate: '2026-10-28' }), 100)

    await ensurePayPeriods(fresh, weekly, '2026-11-02', 100)

    expect((await periodsOldestFirst(fresh)).map((period) => period.startDate)).toEqual([
      '2026-10-25',
      '2026-11-01',
    ])
  })

  it('never goes back more than ten years for a mistyped anchor year', async () => {
    const fresh = openFresh()

    await ensurePayPeriods(fresh, { type: 'weekly', anchor: '0202-11-03' }, '2026-11-04', 100)

    const periods = await periodsOldestFirst(fresh)
    expect(periods.length).toBeLessThanOrEqual(523)
    expect(
      periods.some((period) => period.startDate <= '2026-11-04' && '2026-11-04' <= period.endDate),
    ).toBe(true)
  })

  it('never goes back more than ten years for a mistyped turn year', async () => {
    const fresh = openFresh()
    await addTurn(fresh, turnInput({ localWorkDate: '0202-11-03' }), 100)

    await ensurePayPeriods(fresh, weekly, '2026-11-04', 100)

    const periods = await periodsOldestFirst(fresh)
    expect(periods.length).toBeLessThanOrEqual(523)
    expect(
      periods.some((period) => period.startDate <= '2026-11-04' && '2026-11-04' <= period.endDate),
    ).toBe(true)
  })

  it('still covers a turn nine years before today', async () => {
    const fresh = openFresh()
    await addTurn(fresh, turnInput({ localWorkDate: '2017-11-04' }), 100)

    await ensurePayPeriods(fresh, weekly, '2026-11-04', 100)

    const periods = await periodsOldestFirst(fresh)
    expect(
      periods.some((period) => period.startDate <= '2017-11-04' && '2017-11-04' <= period.endDate),
    ).toBe(true)
    expect(periods.some((period) => period.endDate >= '2026-11-04')).toBe(true)
  })

  it('makes no periods for a schedule of none', async () => {
    const fresh = openFresh()

    await ensurePayPeriods(fresh, { type: 'none', anchor: '2026-11-01' }, '2026-11-16', 100)

    expect(await fresh.payPeriods.count()).toBe(0)
  })
})

describe('addCustomPeriod', () => {
  it('rejects a period that overlaps one that already exists', async () => {
    const fresh = openFresh()
    await ensurePayPeriods(fresh, weekly, '2026-11-07', 100)

    await expect(
      addCustomPeriod(fresh, '2026-11-06', '2026-11-10', 100),
    ).rejects.toThrow('overlap')
    expect(await fresh.payPeriods.count()).toBe(1)
  })

  it('rejects an end date before the start date', async () => {
    const fresh = openFresh()

    await expect(
      addCustomPeriod(fresh, '2026-11-20', '2026-11-08', 100),
    ).rejects.toThrow('endBeforeStart')
    expect(await fresh.payPeriods.count()).toBe(0)
  })

  it('adds a period that overlaps nothing and returns its id', async () => {
    const fresh = openFresh()

    const id = await addCustomPeriod(fresh, '2026-11-08', '2026-11-20', 100)

    expect(id).toBe('period-2026-11-08-2026-11-20')
    expect(await fresh.payPeriods.get(id)).toMatchObject({ status: 'open' })
  })
})

describe('setPeriodStatus', () => {
  it('closes the period and records when it changed', async () => {
    const fresh = openFresh()
    const id = await addCustomPeriod(fresh, '2026-11-08', '2026-11-20', 100)

    await setPeriodStatus(fresh, id, 'closed', 200)

    expect(await fresh.payPeriods.get(id)).toMatchObject({
      status: 'closed',
      createdAt: 100,
      updatedAt: 200,
    })
  })
})

describe('deletePeriod', () => {
  it('keeps a period that money has been allocated to', async () => {
    const fresh = openFresh()
    await ensurePayPeriods(fresh, weekly, '2026-11-07', 100)
    const id = 'period-2026-11-01-2026-11-07'
    await fresh.payments.add({
      id: 'payment-1',
      paymentDate: '2026-11-08',
      amountCents: 140000,
      paymentMethod: 'cash',
      createdAt: 100,
      updatedAt: 100,
    })
    await fresh.paymentAllocations.add({
      id: 'allocation-1',
      paymentId: 'payment-1',
      payPeriodId: id,
      amountCents: 140000,
    })

    expect(await deletePeriod(fresh, id)).toBe(false)
    expect(await fresh.payPeriods.get(id)).toBeDefined()
  })

  it('deletes a period that has no allocated money', async () => {
    const fresh = openFresh()
    const id = await addCustomPeriod(fresh, '2026-11-08', '2026-11-20', 100)

    expect(await deletePeriod(fresh, id)).toBe(true)
    expect(await fresh.payPeriods.get(id)).toBeUndefined()
  })
})

describe('loadPeriodSummaries', () => {
  it('spec: a $2,000 turn leaves $40 of the payout outstanding', async () => {
    const fresh = openFresh()
    await ensurePayPeriods(fresh, weekly, '2026-11-07', 100)
    const id = 'period-2026-11-01-2026-11-07'
    await addTurn(
      fresh,
      turnInput({
        localWorkDate: '2026-11-03',
        lines: [{ servicePresetId: null, name: 'Gel-X', priceCents: 200000, rateBp: 6000 }],
        cardTipCents: 24000,
        cardTipReceived: false,
        cashTipCents: 18000,
        cashTipReceived: true,
      }),
      100,
    )
    await fresh.payments.add({
      id: 'payment-1',
      paymentDate: '2026-11-08',
      amountCents: 140000,
      paymentMethod: 'directDeposit',
      createdAt: 100,
      updatedAt: 100,
    })
    await fresh.paymentAllocations.add({
      id: 'allocation-1',
      paymentId: 'payment-1',
      payPeriodId: id,
      amountCents: 140000,
    })

    const summaries = await loadPeriodSummaries(fresh)

    expect(summaries).toHaveLength(1)
    expect(summaries[0].period.id).toBe(id)
    expect(summaries[0].totals).toMatchObject({
      commissionCents: 120000,
      cashTipsCents: 18000,
      cardTipsCents: 24000,
      tipsInHandCents: 18000,
      earnedCents: 162000,
      expectedPayoutCents: 144000,
    })
    expect(summaries[0]).toMatchObject({
      paidCents: 140000,
      outstandingCents: 4000,
      state: 'owed',
    })
  })
})
