import { getSettings, updateSettings } from '../../app/settings.ts'
import { todayIso } from '../../domain/dates.ts'
import { db } from '../../db/schema.ts'
import { backupFileName, shareOrDownload, type ShareOutcome } from './backupFormat.ts'
import { exportJson } from './exportJson.ts'

/**
 * Builds the backup file and saves it with the phone's share sheet or a
 * download. A cancelled share is not a backup; anything else was saved
 * somewhere, so the day is remembered.
 */
export async function saveBackupFile(title: string): Promise<ShareOutcome> {
  const today = todayIso()
  const file = new File(
    [await exportJson(db, getSettings())],
    backupFileName('backup', 'json', today),
    { type: 'application/json' },
  )
  const result = await shareOrDownload(file, title)
  if (result !== 'cancelled') updateSettings({ lastBackupDate: today })
  return result
}
