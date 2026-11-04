import { IconDownload, IconFileSpreadsheet, IconUpload } from '@tabler/icons-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { t, type StringKey } from '../../lib/i18n.ts'
import { todayIso } from '../../lib/jalali.ts'
import { formatAmount } from '../../lib/money.ts'
import { backupFileName, download } from './backupFormat.ts'
import { exportCsv } from './exportCsv.ts'
import { exportJson } from './exportJson.ts'
import { ImportError, importJson, type ImportErrorCode, type ImportResult } from './importJson.ts'

const ERROR_TEXT: Record<ImportErrorCode, StringKey> = {
  notJson: 'importNotJson',
  notBackup: 'importNotBackup',
  unsupportedVersion: 'importUnsupportedVersion',
  invalidRecord: 'importInvalidRecord',
}

type Outcome = { ok: true; result: ImportResult } | { ok: false; code: ImportErrorCode }

export function BackupSection() {
  const { locale } = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function saveBackup() {
    download(await exportJson(db), backupFileName('backup', 'json', todayIso()), 'application/json')
  }

  async function saveCsv() {
    const [expenses, categories] = await Promise.all([db.expenses.toArray(), db.categories.toArray()])
    download(exportCsv(expenses, categories, locale), backupFileName('expenses', 'csv', todayIso()), 'text/csv')
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // so picking the same file again still fires
    if (!file) return
    try {
      setOutcome({ ok: true, result: await importJson(db, await file.text()) })
    } catch (error) {
      if (!(error instanceof ImportError)) throw error
      setOutcome({ ok: false, code: error.code })
    }
  }

  const button = 'flex items-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm'

  return (
    <section>
      <h2 className="mb-2 text-xs text-text-secondary">{t(locale, 'backup')}</h2>
      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
        <p className="text-xs text-text-secondary">{t(locale, 'backupHint')}</p>
        <button type="button" onClick={saveBackup} className={button}>
          <IconDownload size={18} aria-hidden="true" className="text-brand-600" />
          {t(locale, 'exportBackup')}
        </button>
        <button type="button" onClick={saveCsv} className={button}>
          <IconFileSpreadsheet size={18} aria-hidden="true" className="text-brand-600" />
          {t(locale, 'exportCsv')}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className={button}>
          <IconUpload size={18} aria-hidden="true" className="text-brand-600" />
          {t(locale, 'importBackup')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          onChange={restore}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
        <p className="text-xs text-text-secondary">{t(locale, 'importMerges')}</p>
        <p role="status" className="text-xs empty:hidden">
          {outcome?.ok === true &&
            `${t(locale, 'importDone')}: ${[
              `${formatAmount(outcome.result.added, locale)} ${t(locale, 'importAdded')}`,
              `${formatAmount(outcome.result.updated, locale)} ${t(locale, 'importUpdated')}`,
              `${formatAmount(outcome.result.unchanged, locale)} ${t(locale, 'importUnchanged')}`,
            ].join(locale === 'fa' ? '، ' : ', ')}`}
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
