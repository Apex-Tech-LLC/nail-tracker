import { describe, expect, it } from 'vitest'
import {
  hoursPay,
  openDay,
  perHourCents,
  suggestHours,
  suggestionForDay,
  workMinutes,
} from '../../src/domain/hours.ts'
import type { DatedAdjustment, TurnFigures } from '../../src/domain/totals.ts'

/** A local clock time on Wednesday 2026-11-04, so the test never depends on the runner's zone. */
function at(hours: number, minutes: number, day = 4): number {
  return new Date(2026, 10, day, hours, minutes).getTime()
}

function turn(overrides: Partial<TurnFigures> & Pick<TurnFigures, 'localWorkDate'>): TurnFigures {
  return {
    turnCount: 1,
    serviceRevenueTotalCents: 0,
    commissionTotalCents: 0,
    cashTipCents: 0,
    cardTipCents: 0,
    cashTipReceived: false,
    cardTipReceived: false,
    ...overrides,
  }
}

describe('workMinutes', () => {
  it('is the plain difference within one day', () => {
    expect(workMinutes('09:00', '17:00')).toBe(480)
  })

  it('crosses midnight when the end is earlier than the start', () => {
    expect(workMinutes('21:00', '01:30')).toBe(270)
  })

  it('is zero when the times match', () => {
    expect(workMinutes('09:00', '09:00')).toBe(0)
  })
})

describe('suggestHours', () => {
  it('takes 20 minutes either side and rounds to the quarter-hour', () => {
    const suggestion = suggestHours(at(10, 5), at(18, 40))
    expect(suggestion.start).toBe('09:45')
    expect(suggestion.end).toBe('19:00')
  })

  it('leaves exactly quarter-hour times where they are', () => {
    const suggestion = suggestHours(at(10, 20), at(18, 40))
    expect(suggestion.start).toBe('10:00')
    expect(suggestion.end).toBe('19:00')
  })
})

describe('suggestionForDay', () => {
  it('uses the first and last turn of the day', () => {
    const suggestion = suggestionForDay(
      [{ occurredAt: at(10, 5) }, { occurredAt: at(18, 40) }],
      '2026-11-04',
    )
    expect(suggestion?.start).toBe('09:45')
    expect(suggestion?.end).toBe('19:00')
  })

  it('ignores a turn entered days later with no time typed', () => {
    expect(
      suggestionForDay([{ occurredAt: at(12, 0, 7) }], '2026-11-04'),
    ).toBeNull()
  })

  it('keeps a turn saved in the early hours after midnight', () => {
    const suggestion = suggestionForDay(
      [{ occurredAt: at(10, 5) }, { occurredAt: at(3, 0, 5) }],
      '2026-11-04',
    )
    expect(suggestion?.start).toBe('09:45')
    expect(suggestion?.end).toBe('03:30')
  })

  it('has no suggestion when no turn falls on that day', () => {
    expect(suggestionForDay([], '2026-11-04')).toBeNull()
  })
})

describe('openDay', () => {
  it('closes yesterday after midnight', () => {
    const day = openDay(
      [{ date: '2026-11-04', startTime: '21:00', endTime: null }],
      '2026-11-05',
    )
    expect(day?.date).toBe('2026-11-04')
  })

  it('prefers today over yesterday', () => {
    const day = openDay(
      [
        { date: '2026-11-04', startTime: '21:00', endTime: null },
        { date: '2026-11-05', startTime: '09:00', endTime: null },
      ],
      '2026-11-05',
    )
    expect(day?.date).toBe('2026-11-05')
  })

  it('skips a day that already ended and days older than yesterday', () => {
    expect(
      openDay(
        [
          { date: '2026-11-02', startTime: '09:00', endTime: null },
          { date: '2026-11-05', startTime: '09:00', endTime: '17:00' },
        ],
        '2026-11-05',
      ),
    ).toBeNull()
  })
})

describe('hoursPay', () => {
  const day = { date: '2026-11-04', startTime: '09:00', endTime: '17:00' }
  const turns = [
    turn({ localWorkDate: '2026-11-04', commissionTotalCents: 20_000, cashTipCents: 4000 }),
  ]

  it('gives $30.00 with tips and $25.00 without for 8 hours', () => {
    const pay = hoursPay(turns, [], [day])
    expect(pay.minutes).toBe(480)
    expect(pay.withTipsCents).toBe(3000)
    expect(pay.withoutTipsCents).toBe(2500)
  })

  it('counts only the days that have both times', () => {
    const pay = hoursPay(
      turns,
      [],
      [
        day,
        // A start with no end is a forgotten day: its money and minutes do not count.
        { date: '2026-11-05', startTime: '09:00', endTime: null },
      ],
    )
    expect(pay.minutes).toBe(480)
    expect(pay.withTipsCents).toBe(3000)
  })

  it('counts adjustments on the measured days only', () => {
    const adjustments: DatedAdjustment[] = [
      { localWorkDate: '2026-11-04', amountCents: 800, category: 'bonus' },
      { localWorkDate: '2026-11-05', amountCents: 1600, category: 'bonus' },
    ]
    const pay = hoursPay(turns, adjustments, [day])
    expect(pay.withTipsCents).toBe(3100)
    expect(pay.withoutTipsCents).toBe(2600)
  })
})

describe('perHourCents', () => {
  it('rounds half up to the cent', () => {
    expect(perHourCents(1000, 480)).toBe(125)
  })

  it('is null with no minutes', () => {
    expect(perHourCents(1000, 0)).toBeNull()
  })
})
