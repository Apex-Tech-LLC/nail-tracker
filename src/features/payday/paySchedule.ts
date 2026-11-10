import { getSettings, updateSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import type { IsoDate } from '../../domain/dates.ts'
import type { PayPeriodType } from '../../domain/payPeriods.ts'
import type { PaySchedule } from '../../domain/paySpans.ts'
import { replaceStoredPeriods, scheduleFor } from './payScheduleStore.ts'

// One change at a time, so two quick taps cannot fix the periods out of order.
let queue: Promise<void> = Promise.resolve()

/**
 * Saves the pay schedule and fixes the stored periods to match. Settings,
 * first-time setup and Home all change the schedule here. The setting applies
 * at once; the returned promise settles when the periods are fixed too.
 */
export function savePaySchedule(next: PaySchedule, today: IsoDate): Promise<void> {
  const { payPeriodType, payPeriodAnchorDate } = getSettings()
  const from = { type: payPeriodType, anchor: payPeriodAnchorDate }
  updateSettings({ payPeriodType: next.type, payPeriodAnchorDate: next.anchor })

  const run = queue.then(() => replaceStoredPeriods(db, from, next, today))
  queue = run.catch(() => undefined)
  return run
}

/** Picks weekly, every two weeks, custom or not set. */
export function choosePaySchedule(type: PayPeriodType, today: IsoDate): Promise<void> {
  const { payPeriodType, payPeriodAnchorDate, weekStartDay } = getSettings()
  const current = { type: payPeriodType, anchor: payPeriodAnchorDate }
  return savePaySchedule(scheduleFor(type, current, weekStartDay, today), today)
}

/** Moves the first day of the pay period, keeping the schedule type. */
export function setPayAnchor(anchor: IsoDate, today: IsoDate): Promise<void> {
  return savePaySchedule({ type: getSettings().payPeriodType, anchor }, today)
}
