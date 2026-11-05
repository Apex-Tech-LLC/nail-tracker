# T19: JSON backup and restore, with migrations

- **Branch:** `task/T19-backup-json`
- **Milestone:** M4 Offline and backup
- **Depends on:** T18
- **Size:** about 50 minutes

## Goal

All data can be written to one JSON text and read back. Bad files are refused with a clear reason. Old backup versions can be upgraded. No duplicates. No screen changes; T20 adds the buttons.

Read first: `git show daftar-base:src/features/backup/importJson.ts`. It has the same shape: error codes, small `toX` validators, merge in one transaction, newer `updatedAt` wins.

## Steps

### 1. `src/features/backup/backupFormat.ts`

```ts
import type { Settings } from '../../app/settings.ts'
import type { Adjustment, PayPeriod, Payment, PaymentAllocation, Salon, ServicePreset, Turn, TurnService } from '../../db/schema.ts'
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

export function backupFileName(kind: 'backup' | 'turns', extension: 'json' | 'csv', today: IsoDate): string {
  return `nail-tracker-${kind}-${today}.${extension}`
}
```
Copy the `download` function from `git show daftar-base:src/features/backup/backupFormat.ts` as it is.

### 2. `src/features/backup/exportJson.ts`

`exportJson(db: NailDb, settings: Settings, now: Date = new Date()): Promise<string>`. Reads all eight tables inside one `db.transaction('r', [...all tables], ...)`. Returns `JSON.stringify(backup, null, 2)`.

### 3. `src/features/backup/migrateBackup.ts`

```ts
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>

/** Key is the version a step upgrades FROM. Empty today: version 1 is the first. */
export const MIGRATIONS: Record<number, Migration> = {}

/** Upgrades a parsed backup one version at a time. */
export function migrateBackup(
  data: Record<string, unknown>,
  target: number = BACKUP_VERSION,
  migrations: Record<number, Migration> = MIGRATIONS,
): Record<string, unknown>
```
Behaviour:
- `version` must be a positive whole number, otherwise throw `new ImportError('notBackup')`.
- Higher than `target`: throw `new ImportError('unsupportedVersion')`.
- Loop from `version` up to `target - 1`. If a step is missing, throw `new ImportError('unsupportedVersion')`. After each step, set `version` to the next number.
- Return the result. Never change the input object: spread a copy first.

`ImportError` and `ImportErrorCode` live in `src/features/backup/importJson.ts` as in the old file. To avoid a loop between the two files, put them in `src/features/backup/importError.ts` and import from there in both.

### 4. `src/features/backup/importJson.ts`

```ts
export interface ImportResult {
  added: number
  updated: number
  unchanged: number
}

export interface ImportOutcome extends ImportResult {
  settings: Settings | null // set only if the database was empty, so the caller applies it
}

export async function importJson(db: NailDb, text: string): Promise<ImportOutcome>
```

**Step 1: read.**
- `JSON.parse` failure: `ImportError('notJson')`.
- Not an object, or `app !== 'nail-tracker'`: `ImportError('notBackup')`.
- `migrateBackup(parsed)`.
- Any of the eight arrays missing or not an array: `ImportError('notBackup')`.

**Step 2: validate every record.** One `toX(value: unknown): X | null` per table, and any `null` throws `ImportError('invalidRecord')`.

Helpers: `isObject`, `isText`, `isTime` from the old file, plus:
```ts
const isCents = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)
const isOwnCents = (value: unknown): value is number => isCents(value) && value >= 0
const isRate = (value: unknown): value is number => isCents(value) && value >= 0 && value <= 10_000
```
`isIsoDate` comes from `src/domain/dates.ts`.

| Table | Must hold |
|---|---|
| Salon | `id`, `name` text. `defaultCommissionRateBp` is `isRate` or `null`. `isActive` boolean. Times |
| ServicePreset | `id`, `nameEn`, `nameVi` text. `salonId` text or `null`. `defaultPriceCents` `isOwnCents` or `null`. `defaultCommissionRateBp` `isRate` or `null`. `isCustom`, `isActive` boolean. `sortOrder` number. Times |
| Turn | `id` text. `salonId` text or `null`. `occurredAt` time. `localWorkDate` date. `turnCount` whole number 0 or more. `clientType` one of three. `note` undefined or text. Money fields `isOwnCents`, except `commissionTotalCents` and `earnedTotalCents` which are `isCents`. Both received flags boolean. Times |
| TurnService | `id`, `turnId`, `serviceNameSnapshot` text. `servicePresetId` text or `null`. `servicePriceCents` `isOwnCents`. `commissionRateSnapshotBp` `isRate`. `commissionCents` `isCents`. `sortOrder` number. Times |
| Adjustment | `id` text. `occurredAt` time. `localWorkDate` date. `amountCents` `isCents`. `category` one of four. `note` undefined or text. Times |
| Payment | `id` text. `paymentDate` date. `amountCents` above 0. `paymentMethod` one of five. `notes` undefined or text. Times |
| PaymentAllocation | `id`, `paymentId`, `payPeriodId` text. `amountCents` above 0 |
| PayPeriod | `id` text. `startDate`, `endDate` dates, end not before start. `status` `open` or `closed`. Times |

**Note:** `serviceNameSnapshot` may be an empty string for nobody, but `isText` rejects empty. That is right: the form requires a name.

**Step 3: check the file against itself.** All throw `ImportError('invalidRecord')`:
- Duplicate `id` inside any one array.
- A `TurnService.turnId` not in the file's turns.
- A `PaymentAllocation.paymentId` not in the file's payments, or `payPeriodId` not in the file's periods.

**Step 4: merge in one transaction** over all eight tables. Nothing is written if something throws.

- `wasEmpty`: `turns`, `adjustments`, `payments` and `payPeriods` all have 0 rows, read inside the transaction.
- For `salons`, `servicePresets`, `adjustments`, `payPeriods`: per record, not there = add (`added`), file's `updatedAt` is newer = put (`updated`), else `unchanged`.
- For `turns`: same rule, and **a turn and its services are one unit**. When a turn is added or updated, delete its existing `turnServices` and add the file's. When unchanged, ignore the file's services for it.
- For `payments`: same, and allocations go with the payment in the same way.
- Service and allocation rows are not counted in the result.

Return `{ added, updated, unchanged, settings: wasEmpty ? settingsFromFile : null }`. Build `settingsFromFile` with `resolveSettings(JSON.stringify(data.settings), ['en'])`, which throws away anything malformed.

`importJson` itself must not call `updateSettings`, so it stays testable. T20 applies it.

### 5. Tests

Create `tests/unit/backup.test.ts` (database setup as `tests/unit/turnStore.test.ts`). Use `addTurn`, `addAdjustment`, `addPayment` from the stores and `addCustomPeriod`.

| Case | Expected |
|---|---|
| Round trip | Make a turn with 2 services, an adjustment, a period, a payment with an allocation. `exportJson`, import into a **new** empty database | Every table's rows `toEqual` the originals, sorted by id. Result `settings` is not null |
| Second restore adds nothing | Import the same text again | `added` 0, `updated` 0, row counts unchanged, `settings` null |
| Newer wins | Export. Change a turn's price with `updateTurn`. Import the old file | Turn keeps the new price, `unchanged` counts it |
| File is newer | Export, edit the JSON's turn `updatedAt` up by 1000 and its `cashTipCents`. Import | Turn updated, `updated` is 1, and it has the file's services only |
| Not JSON | `'{'` | `ImportError` code `notJson`, and no table changed |
| Wrong app | `{"app":"daftar","version":1}` | code `notBackup` |
| Missing array | Valid file with `turns` removed | code `notBackup` |
| Newer version | `version: 2` | code `unsupportedVersion` |
| Bad record | A turn with `cashTipCents: 1.5` | code `invalidRecord`, nothing written |
| Bad date | A turn with `localWorkDate: '2026-02-30'` | code `invalidRecord` |
| Duplicate id | Two turns with the same id | code `invalidRecord` |
| Broken link | A `TurnService` with an unknown `turnId` | code `invalidRecord` |
| Migration | `migrateBackup({ version: 1, a: 1 }, 3, { 1: (d) => ({ ...d, b: 2 }), 2: (d) => ({ ...d, c: 3 }) })` | `{ version: 3, a: 1, b: 2, c: 3 }` |
| Migration gap | Same, without step 2 | code `unsupportedVersion` |
| Input untouched | Keep the object passed in | It still has `version: 1` |

To test an error's code:
```ts
await expect(importJson(db, text)).rejects.toMatchObject({ code: 'notJson' })
```

## Files

Create `src/features/backup/backupFormat.ts`, `exportJson.ts`, `migrateBackup.ts`, `importError.ts`, `importJson.ts`, and `tests/unit/backup.test.ts`.

## Done when

- `pnpm exec vitest run tests/unit/backup.test.ts --maxWorkers=2` passes.
- `pnpm gate` passes.

## Not in this task

Any button (T20). CSV (T20).
