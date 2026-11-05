# T11: Service presets screen

- **Branch:** `task/T11-presets`
- **Milestone:** M2 Core tracking
- **Depends on:** T10
- **Size:** about 45 minutes

## Goal

At `#/settings/services` a person can add, rename, reorder and remove the service chips, and set a usual price and commission for each.

## Steps

### 1. `src/features/presets/presetStore.ts`

Each function takes `db: NailDb` first and `now = Date.now()` last.

| Function | Behaviour |
|---|---|
| `addPreset(db, input, now)` | `input` is `{ nameEn, nameVi, defaultPriceCents, defaultCommissionRateBp }`. New `crypto.randomUUID()` id, `salonId: null`, `isCustom: true`, `isActive: true`, `sortOrder` = highest existing `sortOrder` + 1 (0 + 1 if none). Names are trimmed. Returns the id |
| `updatePreset(db, id, input, now)` | Changes those four fields and `updatedAt`. Throws `new Error('Preset not found')` if missing |
| `removePreset(db, id, now)` | **Soft remove:** sets `isActive: false` and `updatedAt`. Never deletes the row |
| `movePreset(db, id, direction: -1 \| 1, now)` | Swaps `sortOrder` with the next **active** preset in that direction, in one transaction. Does nothing at the top or bottom. Sets `updatedAt` on both |

### 2. `src/features/presets/PresetsPage.tsx`

Export `PresetsPage({ onDone }: { onDone: () => void })`.

Load: `useLiveQuery(() => db.servicePresets.orderBy('sortOrder').filter((p) => p.isActive).toArray())`.

Page:
1. Header like the turn form: an X button (`close`, calls `onDone`) and `<h1>` `t(locale,'servicePresets')`.
2. A list. Each row is a `card` in `flex items-center gap-2`:
   - Name in the current language, and below it in `text-sm text-text-secondary` the usual price if set, and the rate if set (`formatRate`).
   - Up and down buttons with `aria-label` `moveUp` and `moveDown` plus the service name, e.g. `Move up: Pedicure`. Use icons `IconArrowUp`, `IconArrowDown`. First row's up and last row's down are `disabled`. Each is `min-h-11 min-w-11`.
   - An edit button (`aria-label` `edit` + name, `IconPencil`).
3. `addPreset` button, `secondaryButton`, opens the editor with empty values.

### 3. Editor

Create `src/features/presets/PresetEditor.tsx`, shown in place of the list (not a route; keep `editing` state in the page as `ServicePreset | 'new' | null`).

Fields:

| Field | Control | Rule |
|---|---|---|
| `presetNameEn` | text | At least one of the two names is needed. If one is empty, it is saved as a copy of the other |
| `presetNameVi` | text | If both are empty, show `errorServiceName` |
| `presetDefaultPrice` | `MoneyField` | Empty means `null`. Otherwise `parseCents`, else `errorAmount` |
| `presetDefaultRate` | `PercentField`, hint `presetDefaultRateHint` | Empty means `null`. Otherwise `parseRateBp`, else `errorRate` |

Buttons: `save`, `cancel`, and when editing an existing one a `dangerButton` `remove`. That opens `ConfirmDialog` with `presetRemoveTitle`, `presetRemoveBody`, `remove`, `cancel`, `danger`.

### 4. Route and link

- `src/app/routes.tsx`: `<Route path={paths.services}>{() => <PresetsPage onDone={goBack} />}</Route>`.
- `src/features/settings/SettingsPage.tsx`: add `<Link href={paths.services} className={secondaryButton + ' block text-center'}>` with `t(locale,'manageServices')` under the language tiles.

### 5. The Add Turn form

Check that a preset removed here no longer appears on the form, and that the `lastServicePresetId` rule falls back to the first preset when that preset was removed. T06 already wrote both. Fix it if not.

### 6. Tests

Create `tests/unit/presetStore.test.ts` (database setup as in `tests/unit/turnStore.test.ts`):

| Case | Expected |
|---|---|
| `addPreset` with `nameEn: ' Polish change '`, `nameVi: 'Đổi màu'` | Saved trimmed, `isCustom` true, `sortOrder` 11 on a fresh database |
| `updatePreset` on `gel-x` with a price of `7000` | `defaultPriceCents` is `7000`, `updatedAt` changed |
| `updatePreset` on a missing id | rejects with `Preset not found` |
| `removePreset('manicure')` | Row still exists with `isActive` false |
| `movePreset('pedicure', -1)` | `orderBy('sortOrder')` now starts `pedicure`, `manicure` |
| `movePreset('manicure', -1)` | Nothing changes |
| Move skips removed rows | Remove `pedicure`. `movePreset('gel-manicure', -1)`. Active order starts `gel-manicure`, `manicure` |
| Old turns keep their name | `addTurn` with a line named `Pedicure` and `servicePresetId: 'pedicure'`. `updatePreset` renames it to `Spa Pedi`. The `TurnService` row still says `Pedicure` |

Create `tests/e2e/presets.spec.ts`, `seedSettings(page)` first:

| Test | Steps | Expected |
|---|---|---|
| Add | Open `./#/settings/services`. Press Add a service. Name in English `Polish Change`, Usual price `15`, Save. Open `./#/add` | A `Polish Change` chip shows. Pressing it fills `Service amount` with `15.00` |
| Name needed | Press Add a service, Save | `Enter a service name.` shows |
| Remove | Press the `Edit: Removal` button, then Remove, then confirm. Open `./#/add` | No `Removal` chip |
| Reorder | Press `Move down: Manicure`. Open `./#/add` | First chip is Pedicure |

Locate the edit button with `page.getByRole('button', { name: 'Edit: Removal' })`, so the `aria-label` must read exactly `Edit: Removal`, `Move up: Pedicure`, `Move down: Manicure`: `${t(locale,'edit')}: ${name}`.

## Files

Create `src/features/presets/presetStore.ts`, `src/features/presets/PresetsPage.tsx`, `src/features/presets/PresetEditor.tsx`, `tests/unit/presetStore.test.ts`, `tests/e2e/presets.spec.ts`. Edit `src/app/routes.tsx`, `src/features/settings/SettingsPage.tsx`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/presets.spec.ts tests/e2e/add-turn.spec.ts --workers=2` passes.

## Not in this task

The rest of Settings (T17).
