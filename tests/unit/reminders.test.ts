import { describe, expect, it } from 'vitest'
import { dueReminder, type DueReminderInput } from '../../src/domain/reminders.ts'

const base: DueReminderInput = {
  today: '2026-11-18',
  hasTurns: true,
  backupReminderDays: 14,
  lastBackupDate: '2026-11-04',
  firstTurnDate: '2026-10-01',
  dismissed: {},
}

describe('dueReminder', () => {
  it('is quiet when reminders are off', () => {
    expect(dueReminder({ ...base, backupReminderDays: 0 })).toBeNull()
  })

  it('is quiet with no turns', () => {
    expect(dueReminder({ ...base, hasTurns: false, firstTurnDate: null })).toBeNull()
  })

  it('waits for the full interval: 13 days is early, 14 days is due', () => {
    expect(dueReminder({ ...base, lastBackupDate: '2026-11-05' })).toBeNull()
    expect(dueReminder({ ...base, lastBackupDate: '2026-11-04' })).toEqual({
      id: 'backup',
      key: 'backup:2026-11-04',
    })
  })

  it('counts from the first turn when there was never a backup', () => {
    expect(
      dueReminder({
        ...base,
        lastBackupDate: null,
        firstTurnDate: '2026-11-03',
      }),
    ).toEqual({ id: 'backup', key: 'backup:2026-11-03' })

    expect(
      dueReminder({
        ...base,
        lastBackupDate: null,
        firstTurnDate: '2026-11-10',
      }),
    ).toBeNull()
  })

  it('keeps a dismissed occurrence hidden', () => {
    expect(dueReminder({ ...base, dismissed: { 'backup:2026-11-04': '2026-11-17' } })).toBeNull()
  })

  it('shows again for a new occurrence after a newer backup', () => {
    const dismissed = { 'backup:2026-10-01': '2026-10-02' }
    expect(dueReminder({ ...base, lastBackupDate: '2026-10-01', dismissed })).toBeNull()
    expect(dueReminder({ ...base, lastBackupDate: '2026-11-04', dismissed })).toEqual({
      id: 'backup',
      key: 'backup:2026-11-04',
    })
  })
})

describe('paycheck reminder', () => {
  const period = {
    id: 'period-2026-11-08-2026-11-14',
    startDate: '2026-11-08',
    endDate: '2026-11-14',
    hasTurns: true,
    checkedDate: null,
  }

  it('comes before the backup reminder', () => {
    // The backup is also overdue here, so the order decides.
    expect(dueReminder({ ...base, paycheckPeriods: [period] })).toEqual({
      id: 'paycheck',
      key: 'paycheck:period-2026-11-08-2026-11-14',
      periodId: 'period-2026-11-08-2026-11-14',
      startDate: '2026-11-08',
      endDate: '2026-11-14',
    })
  })

  it('waits until the period has ended', () => {
    expect(
      dueReminder({ ...base, paycheckPeriods: [{ ...period, endDate: '2026-11-18' }] }),
    ).toMatchObject({ id: 'backup' })
  })

  it('ignores a period with no turns or a checked period', () => {
    expect(
      dueReminder({ ...base, paycheckPeriods: [{ ...period, hasTurns: false }] }),
    ).toMatchObject({ id: 'backup' })
    expect(
      dueReminder({ ...base, paycheckPeriods: [{ ...period, checkedDate: '2026-11-16' }] }),
    ).toMatchObject({ id: 'backup' })
  })

  it('takes the most recent unchecked period', () => {
    const older = {
      id: 'period-2026-11-01-2026-11-07',
      startDate: '2026-11-01',
      endDate: '2026-11-07',
      hasTurns: true,
      checkedDate: null,
    }
    expect(
      dueReminder({ ...base, paycheckPeriods: [older, period] }),
    ).toMatchObject({ periodId: period.id })
  })

  it('stays hidden for the day it was dismissed, then lets the backup through', () => {
    const dismissed = { 'paycheck:period-2026-11-08-2026-11-14': '2026-11-18' }
    expect(dueReminder({ ...base, dismissed, paycheckPeriods: [period] })).toEqual({
      id: 'backup',
      key: 'backup:2026-11-04',
    })
  })
})
