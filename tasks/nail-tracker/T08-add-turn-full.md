# T08: Several services, More options, Save & Add Another

- **Branch:** `task/T08-add-turn-full`
- **Milestone:** M2 Core tracking
- **Depends on:** T07
- **Size:** about 50 minutes

## Goal

The Add Turn form handles several services on one customer visit, per-service commission, a turn count, a time, a client type, tip-received switches, a note, and "Save & Add Another".

## Steps

All changes are in `src/features/turns/TurnForm.tsx` unless stated. Split the service part into its own file `src/features/turns/ServiceLineFields.tsx` so the form stays readable.

### 1. Service lines

Replace the single service state with a list:
```ts
interface LineState {
  key: string // crypto.randomUUID(), for React and for finding the line
  choice: string // preset id, or 'other'
  customName: string
  amount: string
  rate: string
  rateTouched: boolean
}
```
- The form starts with one line.
- `ServiceLineFields` shows one line: the service chips, the name input when Other is chosen, the amount, and the rate box when `showPerLine` is true. Wrap it in `<div data-testid="service-line">`.
- Below the lines: a `secondaryButton` with a plus icon, `t(locale,'addService')`. A new line starts with the same `choice` rule as the first line, an empty amount and the default rate.
- When there is more than one line, each line has a small remove button: `aria-label={t(locale,'removeService')}`, trash icon.

### 2. One rate box or many

```ts
const showPerLine = settings.perServiceRates || new Set(lines.map((line) => line.rate)).size > 1
```
- When `showPerLine` is false: show the one `Commission %` box as now. Typing in it sets `rate` and `rateTouched` on **every** line.
- When it is true: hide that box, and each line shows its own `PercentField`.
- Picking a preset with a `defaultCommissionRateBp` sets that line's rate unless `rateTouched` is true. This can flip `showPerLine` to true by itself. That is correct.

### 3. Live preview

Use `turnTotals` with every line. Lines that cannot be read yet count as $0. When there is more than one line, add a `serviceRevenue` row at the top of the preview.

### 4. More options

A button `t(locale, open ? 'fewerOptions' : 'moreOptions')` with `aria-expanded`, placed under the preview. When open it shows:

| Field | Control | Starts as | Rule |
|---|---|---|---|
| `turnCount` | Text input, `inputMode="numeric"`, hint `turnCountHint` under it | `1` | Whole number 0 to 99, using `/^\d{1,2}$/`. Else `errorTurnCount` |
| `time` | `<input type="time">`, `field` class | empty | Empty means "use now" |
| `clientType` | Three chips: `clientUnspecified`, `clientWalkIn`, `clientRequest` | Not set | |
| `cashTipReceivedLabel` | Checkbox | `settings.cashTipHandling === 'inHand'` | |
| `cardTipReceivedLabel` | Checkbox | `settings.cardTipHandling === 'inHand'` | |
| `note` | `<textarea rows={2}>`, `field` class | empty | |

Checkboxes are a real `<input type="checkbox">` inside a `<label className="flex items-center gap-3 py-2">`, with `className="size-5"`.

Errors in hidden fields must not be invisible: if the turn count is wrong, open More options before showing the error.

### 5. When the turn happened

```ts
const occurredAt = time ? localDateTimeToMs(date, time) : Date.now()
```
`localWorkDate` is always the chosen work date. That is how a shift past midnight stays on the day it began: the person keeps the earlier work date, and with no typed time `occurredAt` is simply now.

### 6. Save & Add Another

Below Save, a `secondaryButton` of `type="button"`: `t(locale,'saveAndAddAnother')`. It runs the same validation and save, then instead of `onDone()`:
- Resets the lines to one fresh line. The chip stays on the service just used (`lastServicePresetId` is updated by the save, but read it from what was saved, not from a stale `settings` value).
- Clears amount, tips, note, time, client type and turn count (back to 1). Keeps the date.
- Closes More options.
- Shows `t(locale,'savedAddAnother')` in a `<p role="status" className="text-sm text-positive-text">` above the form buttons until the next change to any field.
- Moves focus to the first amount box (use a `ref`).

The status `<p>` wrapper stays mounted at all times, so screen readers announce it: `<p role="status">{saved ? text : ''}</p>`.

`updateSettings({ lastServicePresetId })` uses the **last** line's preset when it is not null.

Put the shared part in `async function save(): Promise<boolean>`, returning `false` when validation failed.

### 7. Validation for each line

Same rules as T06, for every line. Errors are stored by the line's `key`. If any line is wrong, nothing saves.

### 8. Tests

Change the `addTurn` helper in `tests/e2e/helpers.ts`: no change should be needed, because a single line still has one `Service amount` box and one `Commission %` box. If it breaks, the form is wrong.

Add to `tests/e2e/add-turn.spec.ts`:

| Test | Steps | Expected |
|---|---|---|
| Three services | Open form. Line 1 Gel Manicure `40`. Press Add service. Line 2 Pedicure `50`. Press Add service. Line 3 Nail Art / Design `15`. Card tip `15` | Preview shows `$105.00`, `$63.00`, `$78.00`. After Save, Today shows `$78.00` and `1` turn and `Turn #1` |
| Different rates | Seed `{ perServiceRates: true }`. Line 1 Gel-X `75`, rate `60`. Add service. Line 2 Nail Art / Design `20`, rate `70` | Preview commission `$59.00` |
| Remove a line | Add a line, press its remove button | Only one `data-testid="service-line"` remains |
| Zero turns | Open More options, Turn count `0`, amount `20`, Save | Today shows `No turn` |
| Bad turn count | Turn count `abc`, Save | Text `Enter a whole number from 0 to 99.` shows |
| Save & Add Another | Amount `30`, press Save & Add Another | Stays on `#/add`, status text `Saved. Add the next turn.` shows, amount is empty. Amount `40`, Save. Today shows `Turn #2` |

Locate line fields with:
```ts
const lines = page.getByTestId('service-line')
await lines.nth(1).getByRole('button', { name: 'Pedicure', exact: true }).click()
await lines.nth(1).getByLabel('Service amount').fill('50')
```

Unit tests stay as they are.

## Files

Edit `src/features/turns/TurnForm.tsx`, `tests/e2e/add-turn.spec.ts`. Create `src/features/turns/ServiceLineFields.tsx`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/add-turn.spec.ts tests/e2e/today.spec.ts --workers=2` passes.

## Not in this task

Editing a saved turn (T09).
