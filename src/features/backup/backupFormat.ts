import type { Settings } from '../../app/settings.ts'
import type {
  Adjustment,
  PaycheckRecord,
  PayPeriod,
  Payment,
  PaymentAllocation,
  Salon,
  ServicePreset,
  Turn,
  TurnService,
  WorkDay,
} from '../../db/schema.ts'
import type { IsoDate } from '../../domain/dates.ts'
import type { PayRules } from '../../domain/payRules.ts'

/** Version of the backup file format. Bump it when a record changes, and add a step to MIGRATIONS. */
export const BACKUP_VERSION = 4

export interface Backup {
  app: 'nail-tracker'
  version: number
  exportedAt: string
  settings: Settings
  salons: Salon[]
  servicePresets: ServicePreset[]
  turns: Turn[]
  turnServices: TurnService[]
  adjustments: Adjustment[]
  payPeriods: PayPeriod[]
  payments: Payment[]
  paymentAllocations: PaymentAllocation[]
  payRules: PayRules[]
  paycheckRecords: PaycheckRecord[]
  workDays: WorkDay[]
}

export function backupFileName(
  kind: 'backup' | 'turns' | 'statement' | 'report',
  extension: 'json' | 'csv' | 'png',
  today: IsoDate,
): string {
  return `nail-tracker-${kind}-${today}.${extension}`
}

/** A file named after a whole year, used by the tax CSV and the year picture. */
export function yearFileName(
  kind: 'taxes' | 'year',
  extension: 'csv' | 'png',
  year: number,
): string {
  return `nail-tracker-${kind}-${year}.${extension}`
}

/**
 * Hands a file to the browser as a download. It takes the file itself, not
 * just text, so a picture downloads as a real PNG instead of broken text.
 */
export function download(content: Blob | string, fileName: string, type: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Some browsers start the download after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/**
 * Hands a file to the phone's own share sheet when it can take files, so it
 * can go to Drive, iCloud, mail or a message. Otherwise it downloads as
 * before. A share the person cancels is not an error.
 */
export async function shareOrDownload(
  file: File,
  title: string = file.name,
): Promise<ShareOutcome> {
  const canShareFiles =
    typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }) === true
  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
      // On iPhone Safari the tap's user activation can expire while the backup
      // is built, so the sheet refuses to open. The file still has to be safe,
      // so any other error falls through to the download.
    }
  }
  download(file, file.name, file.type)
  return 'downloaded'
}
