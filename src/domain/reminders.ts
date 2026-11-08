import { diffDays, type IsoDate } from './dates.ts'
import { setAsideCents } from './taxes.ts'

export type ReminderId = 'backup' | 'paycheck' | 'tax' // later tasks add 'goal'

export interface ReminderQuarter {
  start: IsoDate
  end: IsoDate
}

export interface Reminder {
  id: ReminderId
  key: string // the occurrence, e.g. 'backup:2026-11-04'
  periodId?: string
  startDate?: IsoDate
  endDate?: IsoDate
  dueDate?: IsoDate
  quarter?: ReminderQuarter
  amountCents?: number
}

/** A pay period the paycheck reminder can look at. */
export interface PaycheckPeriod {
  id: string
  startDate: IsoDate
  endDate: IsoDate
  hasTurns: boolean
  checkedDate: IsoDate | null
}

/** The next quarter's due date and span, with what was earned inside it. */
export interface TaxDue {
  dueDate: IsoDate
  start: IsoDate
  end: IsoDate
  earnedCents: number
}

export interface DueReminderInput {
  today: IsoDate
  hasTurns: boolean
  backupReminderDays: number
  lastBackupDate: IsoDate | null
  firstTurnDate: IsoDate | null
  dismissed: Record<string, IsoDate>
  /** Only periods that could raise the reminder; harmless to pass them all. */
  paycheckPeriods?: readonly PaycheckPeriod[]
  /** null or missing: the technician did not ask to set money aside. */
  taxSetAsideBp?: number | null
  /** The quarter Home loaded for the next due date. */
  taxDue?: TaxDue | null
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

/**
 * A pay period that ended before today, has turns and was never checked.
 * The most recent one wins, so a dismissed old period does not hide the next.
 */
function paycheckReminder(input: DueReminderInput): Reminder | null {
  const periods = input.paycheckPeriods ?? []
  const due = periods
    .filter(
      (period) =>
        period.endDate < input.today &&
        period.hasTurns &&
        period.checkedDate === null &&
        input.dismissed[`paycheck:${period.id}`] === undefined,
    )
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
  if (!due) return null
  return {
    id: 'paycheck',
    key: `paycheck:${due.id}`,
    periodId: due.id,
    startDate: due.startDate,
    endDate: due.endDate,
  }
}

const TAX_WINDOW_DAYS = 14

/**
 * A quarterly tax date 14 days away or less, while the technician asked to set
 * money aside. The amount is that quarter's earned money times their percent.
 */
function taxReminder(input: DueReminderInput): Reminder | null {
  const bp = input.taxSetAsideBp
  const due = input.taxDue
  if (bp === null || bp === undefined || !due) return null

  const days = diffDays(due.dueDate, input.today)
  if (days < 0 || days > TAX_WINDOW_DAYS) return null

  return {
    id: 'tax',
    key: `tax:${due.dueDate}`,
    dueDate: due.dueDate,
    quarter: { start: due.start, end: due.end },
    amountCents: setAsideCents(due.earnedCents, bp),
  }
}

// Most urgent first. Later reminders are one more entry here.
const RULES: readonly ReminderRule[] = [paycheckReminder, backupReminder, taxReminder]

/** The most urgent reminder that is due and not dismissed for this occurrence, or null. */
export function dueReminder(input: DueReminderInput): Reminder | null {
  for (const rule of RULES) {
    const reminder = rule(input)
    if (reminder !== null && input.dismissed[reminder.key] === undefined) return reminder
  }
  return null
}
