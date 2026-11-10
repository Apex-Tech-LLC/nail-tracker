import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import { addPeriodPayments, setCheckedDate } from '../../src/features/paycheck/paycheckStore.ts'
import { ensurePayPeriods, setPeriodStatus } from '../../src/features/payday/periodStore.ts'
import { replaceStoredPeriods, scheduleFor } from '../../src/features/payday/payScheduleStore.ts'

let db: NailDb | undefined
let counter = 0

function openFresh() {
  const fresh = createDb(`schedule-${++counter}`)
  db = fresh
  return fresh
}

afterEach(async () => {
  await db?.delete()
  db = undefined
})

const today = '2026-11-16'
const oldSchedule = { type: 'biweekly', anchor: '2026-11-01' } as const
const newSchedule = { type: 'biweekly', anchor: '2026-10-25' } as const

async function startDates(fresh: NailDb) {
  return (await fresh.payPeriods.orderBy('startDate').toArray()).map((period) => period.startDate)
}

describe('scheduleFor', () => {
  const noSchedule = { type: 'none', anchor: null } as const

  it('starts a counted schedule on the first day of this week', () => {
    // 2026-11-11 is a Wednesday.
    expect(scheduleFor('biweekly', noSchedule, 0, '2026-11-11')).toEqual({
      type: 'biweekly',
      anchor: '2026-11-08',
    })
    expect(scheduleFor('weekly', noSchedule, 1, '2026-11-11')).toEqual({
      type: 'weekly',
      anchor: '2026-11-09',
    })
  })

  it('keeps the first day when switching between weekly and every two weeks', () => {
    expect(scheduleFor('weekly', oldSchedule, 0, '2026-11-11')).toEqual({
      type: 'weekly',
      anchor: '2026-11-01',
    })
  })

  it('keeps whatever first day is saved for custom and not set', () => {
    expect(scheduleFor('custom', oldSchedule, 0, today)).toEqual({
      type: 'custom',
      anchor: '2026-11-01',
    })
  })
})

describe('replaceStoredPeriods', () => {
  it('replaces periods nothing refers to when the first day moves', async () => {
    const fresh = openFresh()
    await ensurePayPeriods(fresh, oldSchedule, today, 100)
    expect(await startDates(fresh)).toEqual(['2026-11-01', '2026-11-15'])

    await replaceStoredPeriods(fresh, oldSchedule, newSchedule, today, 200)

    expect(await startDates(fresh)).toEqual(['2026-10-25', '2026-11-08'])
  })

  it('keeps a period with a payment, a paycheck record or a hand closing, and fills in around them', async () => {
    const fresh = openFresh()
    await ensurePayPeriods(fresh, { type: 'weekly', anchor: '2026-11-01' }, '2026-11-22', 100)
    const [first, second, third] = await fresh.payPeriods.orderBy('startDate').toArray()
    await addPeriodPayments(fresh, first.id, '2026-11-08', [{ method: 'check', cents: 5000 }], 150)
    await setCheckedDate(fresh, second.id, '2026-11-15', 150)
    await setPeriodStatus(fresh, third.id, 'closed', 150)

    await replaceStoredPeriods(
      fresh,
      { type: 'weekly', anchor: '2026-11-01' },
      { type: 'biweekly', anchor: '2026-10-28' },
      '2026-11-22',
      200,
    )

    const kept = await startDates(fresh)
    expect(kept).toEqual(expect.arrayContaining(['2026-11-01', '2026-11-08', '2026-11-15']))
    expect(await fresh.paymentAllocations.count()).toBe(1)
  })

  it('leaves custom periods typed in by hand alone', async () => {
    const fresh = openFresh()
    await fresh.payPeriods.add({
      id: 'period-2026-11-01-2026-11-10',
      startDate: '2026-11-01',
      endDate: '2026-11-10',
      status: 'open',
      createdAt: 1,
      updatedAt: 1,
    })

    await replaceStoredPeriods(
      fresh,
      { type: 'custom', anchor: null },
      { type: 'none', anchor: null },
      today,
      200,
    )

    expect(await startDates(fresh)).toEqual(['2026-11-01'])
  })

  it('does not touch the stored periods when the schedule did not change', async () => {
    const fresh = openFresh()
    await ensurePayPeriods(fresh, oldSchedule, today, 100)

    await replaceStoredPeriods(fresh, oldSchedule, oldSchedule, today, 200)

    const periods = await fresh.payPeriods.toArray()
    expect(periods.every((period) => period.createdAt === 100)).toBe(true)
  })
})
