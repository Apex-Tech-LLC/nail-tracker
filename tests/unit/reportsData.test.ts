import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import { loadReport, type ReportRequest } from '../../src/features/reports/reportsData.ts'
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

const WEEK: ReportRequest = {
  choice: 'week',
  span: { start: '2026-11-01', end: '2026-11-07' },
  anchor: '2026-11-04',
  weekStart: 0,
  today: '2026-11-04',
  locale: 'en',
}

describe('loadReport', () => {
  it('reads the range, the previous span, last year and the trend, and keeps the all-time balance', async () => {
    const fresh = openFresh()
    await seedWeek(fresh)

    const report = await loadReport(fresh, WEEK)

    expect(report.totals.earnedCents).toBe(8500)
    expect(report.paidInRangeCents).toBe(4000)
    // Commission $60 + card tip $15, less the $40 payment.
    expect(report.outstandingAllTimeCents).toBe(3500)

    expect(report.previous.span).toEqual({ start: '2026-10-25', end: '2026-10-31' })
    expect(report.previous.change).toEqual({ differenceCents: 8500, percent: null })
    expect(report.lastYear.span).toEqual({ start: '2025-11-01', end: '2025-11-07' })
    expect(report.lastYear.hasTurns).toBe(false)

    expect(report.bars).toHaveLength(12)
    expect(report.bars[11]).toMatchObject({ start: '2026-11-01', end: '2026-11-07', earnedCents: 8500 })
    expect(report.currentBarIndex).toBe(11)
  })

  it('splits the money into services, clients, tips and weekdays', async () => {
    const fresh = openFresh()
    await seedWeek(fresh)

    const report = await loadReport(fresh, WEEK)

    expect(report.serviceLines).toEqual([
      { name: 'Manicure', count: 1, priceCents: 10000, shareCents: 6000, averageCents: 10000 },
    ])
    expect(report.clientLines).toEqual([
      { kind: 'walkIn', clients: 1, percent: 100, averageTipCents: 2500 },
    ])
    expect(report.tips).toEqual({
      cashCents: 1000,
      cardCents: 1500,
      averagePerClientCents: 2500,
      percentOfPrice: 25,
      cardHeldCents: 1500,
    })
    expect(report.weekdayLines[1]).toMatchObject({ weekday: 1, days: 1, averageEarnedCents: 8500 })
  })

  it('a range with nothing in it still shows the all-time balance', async () => {
    const fresh = openFresh()
    await seedWeek(fresh)

    const report = await loadReport(fresh, {
      ...WEEK,
      span: { start: '2026-12-01', end: '2026-12-07' },
      anchor: '2026-12-04',
    })

    expect(report.totals.earnedCents).toBe(0)
    expect(report.paidInRangeCents).toBe(0)
    expect(report.outstandingAllTimeCents).toBe(3500)
  })

  it('a day looks back over the 14 days ending on that day', async () => {
    const fresh = openFresh()
    await seedWeek(fresh)

    const report = await loadReport(fresh, {
      ...WEEK,
      choice: 'day',
      span: { start: '2026-11-04', end: '2026-11-04' },
    })

    expect(report.bars).toHaveLength(14)
    expect(report.bars[13]).toMatchObject({ start: '2026-11-04', end: '2026-11-04', earnedCents: 0 })
    expect(report.bars[11]).toMatchObject({ start: '2026-11-02', earnedCents: 8500 })
    expect(report.currentBarIndex).toBe(13)
  })
})
