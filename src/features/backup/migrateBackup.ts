import { BACKUP_VERSION } from './backupFormat.ts'
import { ImportError } from './importError.ts'

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>

/** Key is the version a step upgrades FROM. Empty today: version 1 is the first. */
export const MIGRATIONS: Record<number, Migration> = {}

/** Upgrades a parsed backup one version at a time. */
export function migrateBackup(
  data: Record<string, unknown>,
  target: number = BACKUP_VERSION,
  migrations: Record<number, Migration> = MIGRATIONS,
): Record<string, unknown> {
  const version = data.version
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
    throw new ImportError('notBackup', String(version))
  }
  if (version > target) throw new ImportError('unsupportedVersion', String(version))

  let migrated: Record<string, unknown> = { ...data }
  for (let from = version; from < target; from++) {
    const step = migrations[from]
    if (!step) throw new ImportError('unsupportedVersion', String(version))
    migrated = { ...step(migrated), version: from + 1 }
  }
  return migrated
}
