import { IconDownload, IconFileSpreadsheet, IconUpload, type Icon } from '@tabler/icons-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { getSettings, updateSettings, useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { todayIso } from '../../domain/dates.ts'
import { t, type StringKey } from '../../lib/i18n.ts'
import { backupFileName, download } from './backupFormat.ts'
import { exportCsv } from './exportCsv.ts'
import { exportJson } from './exportJson.ts'
import { ImportError, type ImportErrorCode } from './importError.ts'
import { importJson, type ImportOutcome } from './importJson.ts'

const ERROR_TEXT: Record<ImportErrorCode, StringKey> = {
  notJson: 'importNotJson',
  notBackup: 'importNotBackup',
  unsupportedVersion: 'importUnsupportedVersion',
  invalidRecord: 'importInvalidRecord',
}

type Outcome = { ok: true; result: ImportOutcome } | { ok: false; code: ImportErrorCode }

export function BackupSection() {
  const { locale } = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  // A quick double tap runs a button twice before React can re-render. The ref
  // is set synchronously, so the second tap does nothing.
  const busy = useRef(false)
  const pickingFile = useRef(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  // Dismissing the picker must not leave the restore button guarded forever.
  useEffect(() => {
    const input = fileInput.current
    if (!input) return
    const handleCancel = () => {
      pickingFile.current = false
    }
    input.addEventListener('cancel', handleCancel)
    return () => input.removeEventListener('cancel', handleCancel)
  }, [])

  async function saveBackup() {
    if (busy.current) return
    busy.current = true
    try {
      download(
        await exportJson(db, getSettings()),
        backupFileName('backup', 'json', todayIso()),
        'application/json',
      )
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
      download(
        exportCsv(turns, services, adjustments, locale),
        backupFileName('turns', 'csv', todayIso()),
        'text/csv',
      )
    } finally {
      busy.current = false
    }
  }

  function chooseFile() {
    if (busy.current || pickingFile.current) return
    pickingFile.current = true
    fileInput.current?.click()
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Clearing the value means picking the same file again still fires.
    event.target.value = ''
    pickingFile.current = false
    if (!file || busy.current) return

    busy.current = true
    try {
      const result = await importJson(db, await file.text())
      if (result.settings) updateSettings({ ...result.settings, onboardingDone: true })
      else updateSettings({ onboardingDone: true })
      setOutcome({ ok: true, result })
    } catch (error) {
      if (!(error instanceof ImportError)) throw error
      setOutcome({ ok: false, code: error.code })
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
        <p role="status" className="text-xs empty:hidden">
          {outcome?.ok === true &&
            `${t(locale, 'importDone')}: ${outcome.result.added} ${t(locale, 'importAdded')}, ${outcome.result.updated} ${t(locale, 'importUpdated')}, ${outcome.result.unchanged} ${t(locale, 'importUnchanged')}`}
          {outcome?.ok === false && (
            <span className="text-danger-text">
              {t(locale, ERROR_TEXT[outcome.code])} {t(locale, 'importFailed')}
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
      <Icon size={18} aria-hidden="true" className="mt-0.5 flex-none text-brand-600" />
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-text-secondary">{hint}</span>
      </span>
    </button>
  )
}
