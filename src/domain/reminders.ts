import { diffDays, type IsoDate } from './dates.ts'

export type ReminderId = 'backup' // later tasks add 'paycheck', 'goal', 'tax'

export interface Reminder {
  id: ReminderId
  key: string // the occurrence, e.g. 'backup:2026-11-04'
}

export interface DueReminderInput {
  today: IsoDate
  hasTurns: boolean
  backupReminderDays: number
  lastBackupDate: IsoDate | null
  firstTurnDate: IsoDate | null
  dismissed: Record<string, IsoDate>
}

type ReminderRule = (input: DueReminderInput) => Reminder | null

/**
 * Backup is due when reminders are on, there is a turn, and the days since
 * the last backup (or the first turn when there was never one) reach the
 * chosen interval. The key holds the date the count started from, so a
 * dismissal lasts until a newer backup makes the reminder due again.
 */
function backupReminder(input: DueReminderInput): Reminder | null {
  if (input.backupReminderDays <= 0 || !input.hasTurns) return null
  const start = input.lastBackupDate ?? input.firstTurnDate
  if (start === null || diffDays(input.today, start) < input.backupReminderDays) return null
  return { id: 'backup', key: `backup:${start}` }
}

// Most urgent first. Later reminders are one more entry here.
const RULES: readonly ReminderRule[] = [backupReminder]

/** The most urgent reminder that is due and not dismissed for this occurrence, or null. */
export function dueReminder(input: DueReminderInput): Reminder | null {
  for (const rule of RULES) {
    const reminder = rule(input)
    if (reminder !== null && input.dismissed[reminder.key] === undefined) return reminder
  }
  return null
}
