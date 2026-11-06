import type { Settings } from '../../app/settings.ts'
import type {
  Adjustment,
  PayPeriod,
  Payment,
  PaymentAllocation,
  Salon,
  ServicePreset,
  Turn,
  TurnService,
} from '../../db/schema.ts'
import type { IsoDate } from '../../domain/dates.ts'

/** Version of the backup file format. Bump it when a record changes, and add a step to MIGRATIONS. */
export const BACKUP_VERSION = 1

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
