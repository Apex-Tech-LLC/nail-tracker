import { describe, expect, it } from 'vitest'
import type { DatedAdjustment, TurnFigures } from '../../src/domain/totals.ts'
import {
  byService,
  byWeekday,
  change,
  clients,
  lastYearSpan,
  previousReportSpan,
  records,
  tipsSummary,
  trendSpans,
} from '../../src/domain/reports.ts'

const turn = (overrides: Partial<TurnFigures> = {}): TurnFigures => ({
  localWorkDate: '2026-11-03',
  turnCount: 1,
  serviceRevenueTotalCents: 0,
  commissionTotalCents: 0,
  cashTipCents: 0,
  cardTipCents: 0,
  cashTipReceived: true,
  cardTipReceived: false,
  ...overrides,
})

const adjustment = (
  amountCents: number,
  localWorkDate: string,
  category: DatedAdjustment['category'] = 'bonus',
): DatedAdjustment => ({ amountCents, localWorkDate, category })

const service = (name: string, priceCents: number, commissionCents: number) => ({
  serviceNameSnapshot: name,
  servicePriceCents: priceCents,
  commissionCents,
})

describe('previousReportSpan', () => {
  it('moves a week back seven days', () => {
    expect(previousReportSpan('week', { start: '2026-11-01', end: '2026-11-07' })).toEqual({
      start: '2026-10-25',
      end: '2026-10-31',
    })
  })

  it('moves a month back to the previous calendar month', () => {
    expect(previousReportSpan('month', { start: '2026-10-01', end: '2026-10-31' })).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    })
  })

  it('crosses the year boundary for a January month', () => {
    expect(previousReportSpan('month', { start: '2027-01-01', end: '2027-01-31' })).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    })
  })

  it('moves a year back', () => {
    expect(previousReportSpan('year', { start: '2026-01-01', end: '2026-12-31' })).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    })
  })

  it('gives a custom span the same number of days ending the day before', () => {
    expect(previousReportSpan('custom', { start: '2026-11-10', end: '2026-11-14' })).toEqual({
      start: '2026-11-05',
      end: '2026-11-09',
    })
  })
})

describe('lastYearSpan', () => {
  it('moves both dates one year back', () => {
    expect(lastYearSpan({ start: '2026-11-01', end: '2026-11-07' })).toEqual({
      start: '2025-11-01',
      end: '2025-11-07',
    })
  })

  it('turns February 29 into February 28', () => {
    expect(lastYearSpan({ start: '2028-02-01', end: '2028-02-29' })).toEqual({
      start: '2027-02-01',
      end: '2027-02-28',
    })
  })
})

describe('change', () => {
  it('rounds the percent half up', () => {
    expect(change(421000, 390000)).toEqual({ differenceCents: 31000, percent: 8 })
  })

  it('has no percent when earlier is zero', () => {
    expect(change(50000, 0)).toEqual({ differenceCents: 50000, percent: null })
  })

  it('can be negative', () => {
    expect(change(0, 1000)).toEqual({ differenceCents: -1000, percent: -100 })
  })
})

describe('trendSpans', () => {
  it('week mode gives the 12 weeks ending with the span week', () => {
    const spans = trendSpans('week', { start: '2026-11-01', end: '2026-11-07' }, 0)

    expect(spans).toHaveLength(12)
    expect(spans[11]).toEqual({ start: '2026-11-01', end: '2026-11-07' })
    for (const span of spans) {
      const days =
        (Date.parse(`${span.end}T00:00:00Z`) - Date.parse(`${span.start}T00:00:00Z`)) / 86400000
      expect(days).toBe(6)
    }
  })

  it('month mode gives the 12 months ending with the span month across a year change', () => {
    const spans = trendSpans('month', { start: '2027-02-01', end: '2027-02-28' }, 0)

    expect(spans).toHaveLength(12)
    expect(spans[0]).toEqual({ start: '2026-03-01', end: '2026-03-31' })
    expect(spans[11]).toEqual({ start: '2027-02-01', end: '2027-02-28' })
  })

  it('year mode gives January to December of that year', () => {
    const spans = trendSpans('year', { start: '2026-01-01', end: '2026-12-31' }, 0)

    expect(spans).toHaveLength(12)
    expect(spans[0]).toEqual({ start: '2026-01-01', end: '2026-01-31' })
    expect(spans[11]).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })

  it('a short custom span gets one bucket per day', () => {
    const spans = trendSpans('custom', { start: '2026-11-10', end: '2026-11-14' }, 0)

    expect(spans).toEqual([
      { start: '2026-11-10', end: '2026-11-10' },
      { start: '2026-11-11', end: '2026-11-11' },
      { start: '2026-11-12', end: '2026-11-12' },
      { start: '2026-11-13', end: '2026-11-13' },
      { start: '2026-11-14', end: '2026-11-14' },
    ])
  })

  it('a custom span over 62 days gets one bucket per week', () => {
    const spans = trendSpans('custom', { start: '2026-01-01', end: '2026-03-31' }, 0)

    expect(spans).toHaveLength(14)
    expect(spans[0]).toEqual({ start: '2025-12-28', end: '2026-01-03' })
    expect(spans[13]).toEqual({ start: '2026-03-29', end: '2026-04-04' })
  })
})

describe('byService', () => {
  it('counts each service line, totals price and share, and averages the price', () => {
    const services = Array.from({ length: 14 }, () => service('Gel-X', 7000, 4200))

    expect(byService(services)).toEqual([
      {
        name: 'Gel-X',
        count: 14,
        priceCents: 98000,
        shareCents: 58800,
        averageCents: 7000,
      },
    ])
  })

  it('counts a turn with three services as three lines', () => {
    const lines = byService([
      service('Manicure', 3500, 2100),
      service('Gel-X', 7000, 4200),
      service('Art', 1000, 600),
    ])

    expect(lines).toHaveLength(3)
    expect(lines.map((line) => line.name)).toEqual(['Gel-X', 'Manicure', 'Art'])
  })

  it('sorts equal shares by name', () => {
    const lines = byService([service('Powder', 5000, 3000), service('Acrylic', 5000, 3000)])

    expect(lines.map((line) => line.name)).toEqual(['Acrylic', 'Powder'])
  })
})

describe('byWeekday', () => {
  it('averages earned over the days worked, then finds the best and slowest', () => {
    const turns = [
      turn({ localWorkDate: '2026-10-31', commissionTotalCents: 30000 }),
      turn({ localWorkDate: '2026-11-07', commissionTotalCents: 32000 }),
      turn({ localWorkDate: '2026-11-03', commissionTotalCents: 9500 }),
    ]
    const lines = byWeekday(turns, [], 0)

    const saturday = lines.find((line) => line.weekday === 6)
    expect(saturday).toEqual({
      weekday: 6,
      days: 2,
      averageEarnedCents: 31000,
      averageTurns: 10,
      best: true,
      slowest: false,
    })

    const tuesday = lines.find((line) => line.weekday === 2)
    expect(tuesday).toEqual({
      weekday: 2,
      days: 1,
      averageEarnedCents: 9500,
      averageTurns: 10,
      best: false,
      slowest: true,
    })
  })

  it('starts the seven lines at the week start day', () => {
    const lines = byWeekday([], [], 1)

    expect(lines.map((line) => line.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('gives average turns in tenths', () => {
    const lines = byWeekday(
      [
        turn({ localWorkDate: '2026-10-31', turnCount: 2 }),
        turn({ localWorkDate: '2026-11-07', turnCount: 3 }),
      ],
      [],
      0,
    )

    expect(lines.find((line) => line.weekday === 6)?.averageTurns).toBe(25)
  })

  it('marks nothing when fewer than two weekdays were worked', () => {
    const lines = byWeekday([turn({ localWorkDate: '2026-10-31' })], [], 0)

    expect(lines.some((line) => line.best || line.slowest)).toBe(false)
  })

  it('adds adjustments on worked days only', () => {
    const turns = [
      turn({ localWorkDate: '2026-10-31', commissionTotalCents: 30000 }),
      turn({ localWorkDate: '2026-11-07', commissionTotalCents: 30000 }),
    ]
    const lines = byWeekday(turns, [adjustment(10000, '2026-10-31'), adjustment(90000, '2026-11-03')], 0)

    expect(lines.find((line) => line.weekday === 6)?.averageEarnedCents).toBe(35000)
    expect(lines.find((line) => line.weekday === 2)).toMatchObject({ days: 0, averageEarnedCents: 0 })
  })
})

describe('clients', () => {
  it('shares clients between request and walk-in and averages their tips', () => {
    const turns = [
      ...Array.from({ length: 38 }, () =>
        ({ ...turn(), clientType: 'request' as const, cashTipCents: 1000 }),
      ),
      ...Array.from({ length: 62 }, () =>
        ({ ...turn(), clientType: 'walkIn' as const, cashTipCents: 500 }),
      ),
    ]

    expect(clients(turns)).toEqual([
      { kind: 'request', clients: 38, percent: 38, averageTipCents: 1000 },
      { kind: 'walkIn', clients: 62, percent: 62, averageTipCents: 500 },
    ])
  })

  it('does not count a zero-turn entry as a client', () => {
    const turns = [
      { ...turn(), clientType: 'request' as const },
      { ...turn({ turnCount: 0, cashTipCents: 9000 }), clientType: 'walkIn' as const },
    ]

    expect(clients(turns)).toEqual([
      { kind: 'request', clients: 1, percent: 100, averageTipCents: 0 },
    ])
  })
})

describe('tipsSummary', () => {
  it('adds cash and card tips, averages per client and takes a share of the price', () => {
    const turns = [
      turn({
        serviceRevenueTotalCents: 60000,
        cashTipCents: 5000,
        cardTipCents: 4000,
        cardTipReceived: false,
      }),
      turn({
        serviceRevenueTotalCents: 40000,
        cashTipCents: 3000,
        cardTipCents: 3000,
        cardTipReceived: true,
      }),
    ]

    expect(tipsSummary(turns)).toEqual({
      cashCents: 8000,
      cardCents: 7000,
      averagePerClientCents: 7500,
      percentOfPrice: 15,
      cardHeldCents: 4000,
    })
  })

  it('has no percent when the price total is zero', () => {
    expect(tipsSummary([turn({ cashTipCents: 2500 })]).percentOfPrice).toBeNull()
  })

  it('counts a zero-turn entry in money but not in clients', () => {
    const turns = [
      turn({ serviceRevenueTotalCents: 10000, cashTipCents: 1000 }),
      turn({ turnCount: 0, cardTipCents: 2500, cardTipReceived: false }),
    ]

    expect(tipsSummary(turns)).toMatchObject({
      cashCents: 1000,
      cardCents: 2500,
      averagePerClientCents: 3500,
      cardHeldCents: 2500,
    })
  })
})

describe('records', () => {
  const days = (from: string, count: number) =>
    Array.from({ length: count }, (_, index) => {
      const date = new Date(`${from}T00:00:00Z`)
      date.setUTCDate(date.getUTCDate() + index)
      return date.toISOString().slice(0, 10)
    })

  it('is null with fewer than 28 days before today', () => {
    const turns = days('2026-10-12', 27).map((localWorkDate) => turn({ localWorkDate }))

    expect(records(turns, [], 0, '2026-11-07')).toBeNull()
  })

  it('appears once the first turn is 28 days before today', () => {
    const turns = [turn({ localWorkDate: '2026-10-10' })]

    expect(records(turns, [], 0, '2026-11-07')).not.toBeNull()
  })

  it('is null with no turns at all', () => {
    expect(records([], [], 0, '2026-11-07')).toBeNull()
  })

  it('finds the best day, week and month, and most turns, with ties to the earlier date', () => {
    const turns = [
      turn({ localWorkDate: '2026-10-27', turnCount: 2, commissionTotalCents: 5000 }),
      turn({ localWorkDate: '2026-11-02', commissionTotalCents: 10000 }),
      turn({ localWorkDate: '2026-11-03', turnCount: 4, commissionTotalCents: 30000 }),
      turn({ localWorkDate: '2026-11-04', turnCount: 4, commissionTotalCents: 30000 }),
    ]
    const result = records(turns, [adjustment(40000, '2026-11-06')], 1, '2026-11-30')

    expect(result).toEqual({
      bestDay: { date: '2026-11-06', cents: 40000 },
      bestWeek: { start: '2026-11-02', cents: 110000 },
      bestMonth: { start: '2026-11-01', cents: 110000 },
      mostTurns: { date: '2026-11-03', turns: 4 },
    })
  })

  it('splits weeks by the chosen week start', () => {
    const turns = [
      turn({ localWorkDate: '2026-11-01', commissionTotalCents: 10000 }),
      turn({ localWorkDate: '2026-11-02', commissionTotalCents: 20000 }),
    ]

    expect(records(turns, [], 0, '2026-12-01')?.bestWeek).toEqual({
      start: '2026-11-01',
      cents: 30000,
    })
    expect(records(turns, [], 1, '2026-12-01')?.bestWeek).toEqual({
      start: '2026-11-02',
      cents: 20000,
    })
  })
})
