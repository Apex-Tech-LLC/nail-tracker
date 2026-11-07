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
