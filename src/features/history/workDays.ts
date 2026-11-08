import type { NailDb, WorkDay } from '../../db/schema.ts'
import type { IsoDate } from '../../domain/dates.ts'

export function loadWorkDays(db: NailDb, start: IsoDate, end: IsoDate): Promise<WorkDay[]> {
  return db.workDays.where('date').between(start, end, true, true).toArray()
}

export function dayOffDates(workDays: readonly WorkDay[]): Set<IsoDate> {
  return new Set(workDays.filter((workDay) => workDay.dayOff).map((workDay) => workDay.date))
}

/**
 * Saves one day's start and end time. Nulls clear the hours; the day off
 * answer and the day's first-saved moment stay as they were.
 */
export async function setWorkHours(
  db: NailDb,
  date: IsoDate,
  startTime: string | null,
  endTime: string | null,
  now: number = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.workDays, async () => {
    const existing = await db.workDays.get(date)
    await db.workDays.put({
      date,
      dayOff: existing?.dayOff ?? false,
      startTime,
      endTime,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  })
}

/**
 * Marks a day off or normal again. A day with turns can be off too, so the
 * turns are left alone; hours from hours tracking are kept.
 */
export async function setDayOff(
  db: NailDb,
  date: IsoDate,
  dayOff: boolean,
  now: number = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.workDays, async () => {
    const existing = await db.workDays.get(date)
    await db.workDays.put({
      date,
      dayOff,
      startTime: existing?.startTime ?? null,
      endTime: existing?.endTime ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  })
}
