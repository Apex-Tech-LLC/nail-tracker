# T20: CSV export, backup buttons, delete all data

- **Branch:** `task/T20-csv-backup-ui`
- **Milestone:** M4 Offline and backup
- **Depends on:** T19
- **Size:** about 50 minutes

## Goal

Settings can save a backup, restore one, export a spreadsheet, and delete everything. Earnings can export its date range.

## Steps

### 1. `src/features/backup/exportCsv.ts`

```ts
import type { Adjustment, Turn, TurnService } from '../../db/schema.ts'
import type { Locale } from '../../lib/locale.ts'
```

Keep the first lines of the old file: the BOM and `csvCell`. See `git show daftar-base:src/features/backup/exportCsv.ts`.

**Trap:** `csvCell` puts `'` in front of any text starting with `-`, to stop spreadsheet formulas. A money value like `-5.00` is text starting with `-`, and must **not** get the `'`. So add:
```ts
/** A money value: plain digits for spreadsheets, never treated as a possible formula. */
const moneyCell = (cents: number): string => centsToInput(cents)
```
and build rows of already finished cells: text goes through `csvCell`, money goes through `moneyCell`, numbers through `String`.

`exportCsv(turns, services, adjustments, locale): string`:

- First row, using `t`: `csvType`, `csvDate`, `csvTime`, `csvTurns`, `csvServices`, `csvServiceRevenue`, `csvCommission`, `csvCashTip`, `csvCardTip`, `csvEarned`, `csvClientType`, `csvNote`.
- Then one row per turn and one per adjustment, oldest first: sort by date, then by `occurredAt`.

| Column | Turn row | Adjustment row |
|---|---|---|
| Type | `csvRowTurn` | `csvRowAdjustment` |
| Date | `localWorkDate` | `localWorkDate` |
| Time | `timeOf(occurredAt)` | `timeOf(occurredAt)` |
| Turns | `turnCount` | empty |
| Services | Names in order, joined with ` + ` | The category's words from `ADJUSTMENT_LABEL` |
| Service revenue | money | empty |
| Commission | money | empty |
| Cash tip | money | empty |
| Card tip | money | empty |
| Earned | `earnedTotalCents` as money | `amountCents` as money |
| Client type | Words for the type. Empty for `unspecified` | empty |
| Note | `note ?? ''` | `note ?? ''` |

Result: `BOM + rows.map((row) => row.join(',')).join('\r\n') + '\r\n'`.

Client type words: `{ unspecified: '', walkIn: t(locale,'clientWalkIn'), request: t(locale,'clientRequest') }`.

### 2. Delete everything: `src/features/backup/deleteAllData.ts`

```ts
export async function deleteAllData(db: NailDb): Promise<void>
```
In one transaction over all eight tables: clear each. Then put back `DEFAULT_SALON` and `DEFAULT_PRESETS`. Clearing does not run `populate` again, so this is needed.

### 3. Reset settings

In `src/app/settings.ts` add:
```ts
/** Back to first-launch defaults, except the language, which stays as the person chose it. */
export function resetSettings(): void {
  const { locale } = current
  current = resolveSettings(JSON.stringify({ locale }), [])
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Not saved, but still applied for this session.
  }
  listeners.forEach((listener) => listener())
}
```

### 4. `src/features/backup/BackupSection.tsx`

Start from `git show daftar-base:src/features/backup/BackupSection.tsx`, including its `Action` component, the hidden file input, and `<p role="status">` for the result. Changes:

- Imports: `todayIso` from `src/domain/dates.ts`, no `formatAmount`. Plain numbers in the result text.
- `saveBackup`: `download(await exportJson(db, getSettings()), backupFileName('backup', 'json', todayIso()), 'application/json')`.
- `saveCsv`: read `turns`, `turnServices`, `adjustments`, and `download(exportCsv(...), backupFileName('turns', 'csv', todayIso()), 'text/csv')`.
- `restore`: after `importJson` succeeds:
  ```ts
  if (outcome.settings) updateSettings({ ...outcome.settings, onboardingDone: true })
  else updateSettings({ onboardingDone: true })
  ```
- The old file shows `importDone` and counts. Keep it: `` `${t(locale,'importDone')}: ${added} ${t(locale,'importAdded')}, ${updated} ${t(locale,'importUpdated')}, ${unchanged} ${t(locale,'importUnchanged')}` ``.
- Failure shows the matching message from `ERROR_TEXT`, then `importFailed`.

### 5. Delete section

Create `src/features/backup/DeleteAllSection.tsx`:
- `<h2>` `deleteAllData`, hint `deleteAllHint`, `dangerButton` `deleteAllData`.
- Opens `ConfirmDialog` with `confirmDisabled={typed.trim() !== word}` where `const word = t(locale,'deleteAllWord')`. Title `deleteAllTitle`.
- `body` holds `tf(locale,'deleteAllBody',{ word })` and a text input labelled `deleteAllInput`, `field` class, `autoComplete="off"`, `autoCapitalize="characters"`.
- Add `confirmDisabled` handling to the confirm button in `ConfirmDialog` if T09 left it out: `disabled={confirmDisabled}` with `disabled:opacity-50`.
- Confirm: `await deleteAllData(db)`, `resetSettings()`, close, then `navigate(paths.onboarding, { replace: true })`.

### 6. Put them on the screen

- `SettingsPage.tsx`: add `<BackupSection />` then `<DeleteAllSection />` just above the version line.
- `EarningsPage.tsx`: below the last card, a `secondaryButton` `exportCsvRange`. It calls `loadRange(db, start, end)`, then `download(exportCsv(...), backupFileName('turns', 'csv', todayIso()), 'text/csv')`.

### 7. Tests

Create `tests/unit/exportCsv.test.ts`. Build one `Turn`, its `TurnService` rows and one `Adjustment` with helpers.

| Case | Expected |
|---|---|
| Starts with the BOM | `csv.charCodeAt(0)` is `0xfeff` |
| Header in English | First line after the BOM starts `Type,Date,Time,Turns,Services` |
| Header in Vietnamese | With `'vi'`, it starts `Loại,Ngày,Giờ,Turn,Dịch vụ` |
| Turn row | $100 at 60%, cash `1000`, card `1500`, on `2026-11-04`: the row holds `2026-11-04`, `100.00`, `60.00`, `10.00`, `15.00`, `85.00` |
| Two services | Cell reads `Gel Manicure + Pedicure` |
| Negative money | Adjustment `-500`: row ends with `-5.00` in the Earned column, with **no** `'` before it |
| Formula in a note | Note `=HYPERLINK("x")`: the cell starts with `"'=HYPERLINK` |
| Comma in a note | Note `a, b`: the cell is `"a, b"` |
| Order | Older date comes first, whichever order they went in |

Add to `tests/unit/backup.test.ts`:

| Case | Expected |
|---|---|
| `deleteAllData` | After adding a turn and removing a preset: `turns` count 0, 10 active presets, 1 salon |

Create `tests/e2e/backup.spec.ts`, with `seedSettings(page)` first. Read `git show daftar-base:tests/e2e/backup.spec.ts` for how it catches a download and uploads a file.

| Test | Steps | Expected |
|---|---|---|
| Round trip | `addTurn(page, { amount: '100', cash: '10' })`. Open Settings, catch the download from `Save backup file`. Keep the file's path. Delete all data with the word `DELETE`. Finish onboarding by pressing Skip four times. Open Settings, upload to the hidden file input with `setInputFiles`. Open `./` | Status shows `Restore finished`. Today shows `$70.00`. The file name matches `/^nail-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/` |
| Bad file | Upload a buffer: `{ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('nope') }` | Shows `This file is damaged or is not JSON.` and `Your current data was not changed.` |
| Not ours | Upload `{"app":"other","version":1}` | Shows `This is not a Nail Tracker backup file.` |
| CSV | Add a turn. Catch the download from `Export history (CSV)`. Read it with `fs.readFileSync(await download.path(), 'utf8')` | Text holds `100.00`. Name matches `/^nail-tracker-turns-.*\.csv$/` |
| Delete word | Press Delete all data | Confirm is disabled. Type `delete`: still disabled. Type `DELETE`: enabled |
| Vietnamese word | Seed `{ locale: 'vi' }`, open the dialog | Type `XÓA`: confirm is enabled |
| Delete | Add a turn, delete all data | URL ends in `#/onboarding`. After four Skips, Today shows `No turns yet` |
| Earnings CSV | Add a turn. On Earnings, catch the download from `Export this range (CSV)` | Text holds `100.00` |

## Files

Create `src/features/backup/exportCsv.ts`, `deleteAllData.ts`, `BackupSection.tsx`, `DeleteAllSection.tsx`, `tests/unit/exportCsv.test.ts`, `tests/e2e/backup.spec.ts`. Edit `src/app/settings.ts`, `src/ui/ConfirmDialog.tsx`, `src/features/settings/SettingsPage.tsx`, `src/features/earnings/EarningsPage.tsx`, `tests/unit/backup.test.ts`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/backup.spec.ts tests/e2e/settings.spec.ts --workers=2` passes.

## Not in this task

Offline checks (T21).
