import { IconDownload, IconFileSpreadsheet, IconUpload, type Icon } from '@tabler/icons-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { updateSettings, useSettings, type BackupReminderDays } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { formatDayShort, todayIso } from '../../domain/dates.ts'
import { t, tf, type StringKey } from '../../lib/i18n.ts'
import { field, label as labelClass } from '../../ui/styles.ts'
import { backupFileName, shareOrDownload } from './backupFormat.ts'
import { exportCsv } from './exportCsv.ts'
import { ImportError, type ImportErrorCode } from './importError.ts'
import { importJson, type ImportOutcome } from './importJson.ts'
import { saveBackupFile } from './saveBackup.ts'

const ERROR_TEXT: Record<ImportErrorCode, StringKey> = {
  notJson: 'importNotJson',
  notBackup: 'importNotBackup',
  unsupportedVersion: 'importUnsupportedVersion',
  invalidRecord: 'importInvalidRecord',
}

const REMINDER_DAYS: readonly BackupReminderDays[] = [7, 14, 30, 0]

/** A null code is a failure that is not about the file, such as a database error. */
type Outcome = { ok: true; result: ImportOutcome } | { ok: false; code: ImportErrorCode | null }

export function BackupSection() {
  const { locale, backupReminderDays, lastBackupDate } = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  // A quick double tap runs a button twice before React can re-render. The ref
  // is set synchronously, so the second tap does nothing.
  const busy = useRef(false)
  const pickingFile = useRef(false)
  const pickTimer = useRef<number | undefined>(undefined)
  const reminderId = useId()
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function saveBackup() {
    if (busy.current) return
    busy.current = true
    try {
      await saveBackupFile(t(locale, 'exportBackup'))
    } finally {
      busy.current = false
    }
  }

  async function saveCsv() {
    if (busy.current) return
    busy.current = true
    try {
      const [turns, services, adjustments] = await Promise.all([
        db.turns.toArray(),
        db.turnServices.toArray(),
        db.adjustments.toArray(),
      ])
      const file = new File(
        [exportCsv(turns, services, adjustments, locale)],
        backupFileName('turns', 'csv', todayIso()),
        { type: 'text/csv' },
      )
      await shareOrDownload(file, t(locale, 'exportCsv'))
    } finally {
      busy.current = false
    }
  }

  function chooseFile() {
    if (busy.current || pickingFile.current) return
    pickingFile.current = true
    // Older Safari never fires `cancel` when the picker is dismissed, so the
    // guard has to expire on its own or Restore would stay dead for good.
    window.clearTimeout(pickTimer.current)
    pickTimer.current = window.setTimeout(() => {
      pickingFile.current = false
    }, 1000)
    fileInput.current?.click()
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Clearing the value means picking the same file again still fires.
    event.target.value = ''
    window.clearTimeout(pickTimer.current)
    pickingFile.current = false
    if (!file || busy.current) return

    busy.current = true
    try {
      const result = await importJson(db, await file.text())
      if (result.settings) updateSettings({ ...result.settings, onboardingDone: true })
      else updateSettings({ onboardingDone: true })
      setOutcome({ ok: true, result })
    } catch (error) {
      // The merge is all or nothing, so a database failure left the data as it
      // was. Say that instead of leaving the person with no message at all.
      setOutcome({ ok: false, code: error instanceof ImportError ? error.code : null })
    } finally {
      busy.current = false
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-xs text-text-secondary">{t(locale, 'backup')}</h2>
      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
        <p className="text-xs text-text-secondary">{t(locale, 'backupHint')}</p>
        <Action icon={IconDownload} label={t(locale, 'exportBackup')} hint={t(locale, 'exportBackupHint')} onClick={saveBackup} />
        <Action icon={IconFileSpreadsheet} label={t(locale, 'exportCsv')} hint={t(locale, 'exportCsvHint')} onClick={saveCsv} />
        <Action
          icon={IconUpload}
          label={t(locale, 'importBackup')}
          hint={t(locale, 'importMerges')}
          onClick={chooseFile}
        />
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          onChange={restore}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="border-t border-border pt-3">
          <p className="text-sm text-text-secondary">
            {lastBackupDate === null
              ? t(locale, 'noBackupYet')
              : tf(locale, 'lastBackupOn', { date: formatDayShort(lastBackupDate, locale) })}
          </p>
          <label htmlFor={reminderId} className={`${labelClass} mt-3`}>
            {t(locale, 'remindMeToBackUp')}
          </label>
          <select
            id={reminderId}
            value={String(backupReminderDays)}
            onChange={(event) => {
              const days = REMINDER_DAYS.find((option) => String(option) === event.target.value)
              if (days !== undefined) updateSettings({ backupReminderDays: days })
            }}
            className={field}
          >
            <option value="7">{t(locale, 'backupEvery7Days')}</option>
            <option value="14">{t(locale, 'backupEvery14Days')}</option>
            <option value="30">{t(locale, 'backupEvery30Days')}</option>
            <option value="0">{t(locale, 'backupOff')}</option>
          </select>
        </div>
        <p role="status" className="text-xs empty:hidden">
          {outcome?.ok === true &&
            `${t(locale, 'importDone')}: ${outcome.result.added} ${t(locale, 'importAdded')}, ${outcome.result.updated} ${t(locale, 'importUpdated')}, ${outcome.result.unchanged} ${t(locale, 'importUnchanged')}`}
          {outcome?.ok === false && (
            <span className="text-danger-text">
              {outcome.code !== null && `${t(locale, ERROR_TEXT[outcome.code])} `}
              {t(locale, 'importFailed')}
            </span>
          )}
        </p>
      </div>
    </section>
  )
}

/** A button that says what it does and, underneath, what the result is for. */
function Action({ icon: Icon, label, hint, onClick }: { icon: Icon; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-2.5 rounded-control border border-border-strong bg-surface px-3 py-2.5 text-start"
    >
      <Icon size={18} aria-hidden="true" className="mt-0.5 flex-none text-brand-ink" />
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-text-secondary">{hint}</span>
      </span>
    </button>
  )
}
