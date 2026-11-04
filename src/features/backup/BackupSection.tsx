import { IconDownload, IconFileSpreadsheet, IconUpload, type Icon } from '@tabler/icons-react'
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
  const { locale, calendar } = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function saveBackup() {
    download(await exportJson(db), backupFileName('backup', 'json', todayIso(), calendar), 'application/json')
  }

  async function saveCsv() {
    const [expenses, categories] = await Promise.all([db.expenses.toArray(), db.categories.toArray()])
    download(exportCsv(expenses, categories, locale), backupFileName('expenses', 'csv', todayIso(), calendar), 'text/csv')
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
          onClick={() => fileInput.current?.click()}
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
