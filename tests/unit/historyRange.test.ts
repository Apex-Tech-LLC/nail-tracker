import { describe, expect, it } from 'vitest'
import type { Adjustment, Turn, TurnService } from '../../src/db/schema.ts'
import {
  groupByDay,
  matchesSearch,
  rangeFor,
} from '../../src/features/history/historyRange.ts'

function makeTurn(overrides: Partial<Turn> & Pick<Turn, 'id' | 'localWorkDate'>): Turn {
  return {
    salonId: 'default',
    occurredAt: 0,
    turnCount: 1,
    clientType: 'unspecified',
    cashTipCents: 0,
    cardTipCents: 0,
    cashTipReceived: false,
    cardTipReceived: false,
    serviceRevenueTotalCents: 0,
    commissionTotalCents: 0,
    earnedTotalCents: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makeAdjustment(
  overrides: Partial<Adjustment> & Pick<Adjustment, 'id' | 'localWorkDate' | 'amountCents' | 'category'>,
): Adjustment {
  return {
    occurredAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('rangeFor', () => {
  it('today is one day', () => {
    expect(rangeFor('today', '2026-11-04', 0)).toEqual({
      start: '2026-11-04',
      end: '2026-11-04',
    })
  })

  it('yesterday is the day before', () => {
    expect(rangeFor('yesterday', '2026-11-01', 0)).toEqual({
      start: '2026-10-31',
      end: '2026-10-31',
    })
  })

  it('this week starts on Sunday when the week starts on Sunday', () => {
    expect(rangeFor('thisWeek', '2026-11-04', 0)).toEqual({
      start: '2026-11-01',
      end: '2026-11-07',
    })
  })

  it('this week starts on Monday when the week starts on Monday', () => {
    expect(rangeFor('thisWeek', '2026-11-04', 1)).toEqual({
      start: '2026-11-02',
      end: '2026-11-08',
    })
  })

  it('last week is the week before this one', () => {
    expect(rangeFor('lastWeek', '2026-11-04', 0)).toEqual({
      start: '2026-10-25',
      end: '2026-10-31',
    })
  })
})

describe('groupByDay', () => {
  it('lists the newest day first, turns newest first, and counts adjustments in the day total', () => {
    const turns = [
      makeTurn({
        id: 'a',
        localWorkDate: '2026-11-02',
        occurredAt: 100,
        commissionTotalCents: 1000,
        cashTipCents: 500,
      }),
      makeTurn({
        id: 'b',
        localWorkDate: '2026-11-02',
        occurredAt: 200,
        commissionTotalCents: 2000,
      }),
      makeTurn({
        id: 'c',
        localWorkDate: '2026-11-01',
        occurredAt: 50,
        commissionTotalCents: 500,
      }),
    ]
    const adjustment = makeAdjustment({
      id: 'adj',
      localWorkDate: '2026-11-02',
      amountCents: 300,
      category: 'bonus',
    })

    const groups = groupByDay(turns, [adjustment])

    expect(groups.map((group) => group.date)).toEqual(['2026-11-02', '2026-11-01'])
    expect(groups[0].turns.map((turn) => turn.id)).toEqual(['b', 'a'])
    expect(groups[0].adjustments.map((item) => item.id)).toEqual(['adj'])
    expect(groups[0].earnedCents).toBe(1500 + 2000 + 300)
    expect(groups[1].earnedCents).toBe(500)
  })
})

describe('matchesSearch', () => {
  it('ignores Vietnamese accents and case', () => {
    const services = [{ serviceNameSnapshot: 'Làm móng chân' } as TurnService]

    expect(matchesSearch(services, 'mong')).toBe(true)
  })

  it('matches part of a service name, ignoring case', () => {
    const services = [{ serviceNameSnapshot: 'Gel-X' } as TurnService]

    expect(matchesSearch(services, 'gel')).toBe(true)
    expect(matchesSearch(services, 'pedi')).toBe(false)
  })

  it('matches everything when the search is empty', () => {
    const services = [{ serviceNameSnapshot: 'Gel-X' } as TurnService]

    expect(matchesSearch(services, '')).toBe(true)
    expect(matchesSearch(services, '   ')).toBe(true)
  })
})
