import { isIsoDate, type IsoDate } from '../../domain/dates.ts'
import { defaultPayRules, NO_RULES, type PayRules } from '../../domain/payRules.ts'
import { BACKUP_VERSION } from './backupFormat.ts'
import { ImportError } from './importError.ts'

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>

function firstWorkDate(data: Record<string, unknown>): IsoDate {
  const turns = Array.isArray(data.turns) ? data.turns : []
  const dates = turns
    .map((turn) =>
      typeof turn === 'object' && turn !== null
        ? (turn as Record<string, unknown>).localWorkDate
        : undefined,
    )
    .filter(isIsoDate)
    .sort()
  return dates[0] ?? NO_RULES.startDate
}

function upgradeFromVersionOne(data: Record<string, unknown>): Record<string, unknown> {
  const rules: PayRules[] = [defaultPayRules(firstWorkDate(data), 1)]
  return { ...data, payRules: rules, paycheckRecords: [] }
}

function upgradeFromVersionTwo(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data, workDays: [] }
}

function upgradeFromVersionThree(data: Record<string, unknown>): Record<string, unknown> {
  const rules = Array.isArray(data.payRules) ? data.payRules : []
  return {
    ...data,
    payRules: rules.map((rule) =>
      typeof rule === 'object' && rule !== null
        ? { ...(rule as Record<string, unknown>), guarantee: { kind: 'none' }, tiers: null }
        : rule,
    ),
  }
}

/** Key is the version a step upgrades FROM. */
export const MIGRATIONS: Record<number, Migration> = {
  1: upgradeFromVersionOne,
  2: upgradeFromVersionTwo,
  3: upgradeFromVersionThree,
}

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
