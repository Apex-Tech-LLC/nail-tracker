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
  kind: 'backup' | 'turns',
  extension: 'json' | 'csv',
  today: IsoDate,
): string {
  return `nail-tracker-${kind}-${today}.${extension}`
}

/** Hands a file to the browser as a download. */
export function download(content: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
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
  download(await file.text(), file.name, file.type)
  return 'downloaded'
}
