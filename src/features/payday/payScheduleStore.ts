import type { NailDb } from '../../db/schema.ts'
import { weekRange, type IsoDate } from '../../domain/dates.ts'
import { isCounted, type PaySchedule } from '../../domain/paySpans.ts'
import type { PayPeriodType } from '../../domain/payPeriods.ts'
import { ensurePayPeriods } from './periodStore.ts'

/**
 * The schedule after picking a type. A weekly or two-week schedule counts from
 * a first day: switching between the two keeps the first day already set, and
 * any other start begins on the first day of the week the person is working in.
 */
export function scheduleFor(
  type: PayPeriodType,
  current: PaySchedule,
  weekStartDay: 0 | 1,
  today: IsoDate,
): PaySchedule {
  if (type !== 'weekly' && type !== 'biweekly') return { type, anchor: current.anchor }
  const anchor = isCounted(current) ? current.anchor : weekRange(today, weekStartDay).start
  return { type, anchor }
}

const isFilledIn = (schedule: PaySchedule) =>
  schedule.type === 'weekly' || schedule.type === 'biweekly'

/**
 * Makes the stored pay periods match a changed schedule. Rows that nothing
 * refers to (no payment, no paycheck record, not closed by hand) are dropped
 * and the new schedule fills in around the rest. Custom periods are typed in
 * by hand, so moving between custom and not set leaves them alone.
 */
export async function replaceStoredPeriods(
  db: NailDb,
  from: PaySchedule,
  to: PaySchedule,
  today: IsoDate,
  now: number = Date.now(),
): Promise<void> {
  const changed = from.type !== to.type || from.anchor !== to.anchor
  if (changed && (isFilledIn(from) || isFilledIn(to))) {
    await db.transaction('rw', db.payPeriods, db.paymentAllocations, db.paycheckRecords, async () => {
      const [periods, allocations, records] = await Promise.all([
        db.payPeriods.toArray(),
        db.paymentAllocations.toArray(),
        db.paycheckRecords.toArray(),
      ])
      const used = new Set([
        ...allocations.map((allocation) => allocation.payPeriodId),
        ...records.map((record) => record.payPeriodId),
      ])
      const unused = periods.filter((period) => period.status === 'open' && !used.has(period.id))
      await db.payPeriods.bulkDelete(unused.map((period) => period.id))
    })
  }
  await ensurePayPeriods(db, to, today, now)
}
