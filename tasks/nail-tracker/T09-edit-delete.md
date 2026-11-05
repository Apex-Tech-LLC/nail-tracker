# T09: Edit and delete a turn

- **Branch:** `task/T09-edit-delete`
- **Milestone:** M2 Core tracking
- **Depends on:** T08
- **Size:** about 40 minutes

## Goal

Tapping a turn opens the same form filled in. Saving changes it. Delete asks first. Every total updates by itself.

## Steps

### 1. `src/ui/ConfirmDialog.tsx`

A shared dialog using the browser's native `<dialog>`:
```tsx
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}
```
- In `useEffect`, call `ref.current.showModal()` when `open` turns true and `ref.current.close()` when it turns false. Check `ref.current.open` first, or the browser throws.
- Handle the dialog's `onCancel` event (the Escape key) with `event.preventDefault()` then `props.onCancel()`.
- Markup: `<dialog ref={ref} aria-labelledby={titleId} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-card bg-surface p-4 text-text backdrop:bg-black/40">` with an `<h2 id={titleId} className="text-lg font-medium">`, the body in a `<div className="mt-2 text-sm text-text-secondary">`, and two buttons in `mt-4 flex flex-col gap-2`. Confirm uses `dangerButton` if `danger` is true, otherwise `primaryButton`. Cancel uses `secondaryButton`.
- `body` is a `ReactNode` because T20 puts an input inside it.

### 2. Form: edit mode

`TurnForm` takes `turnId?: string`:
```tsx
export function TurnForm({ turnId, onDone }: { turnId?: string; onDone: () => void }) {
```
Load the turn and its services, using null for "not found" and undefined for "still loading":
```ts
const existing = useLiveQuery(async () => {
  if (!turnId) return null
  const turn = await db.turns.get(turnId)
  if (!turn) return null
  const services = await db.turnServices.where('turnId').equals(turnId).sortBy('sortOrder')
  return { turn, services }
}, [turnId])
```
- While `presets` or `existing` is `undefined`, return `null`.
- If `turnId` is set and `existing` is `null`: show `<p>{t(locale,'entryNotFound')}</p>` and a link back to Today (`backToToday`).

Starting values in edit mode:

| Field | Value |
|---|---|
| Heading | `editTurn` |
| Date | `turn.localWorkDate`. Chip is Today or Yesterday if it matches, otherwise Other day with the date box showing |
| Lines | One per service. `choice` is `servicePresetId` if that preset is in the active list. Otherwise `'other'` with `customName` = `serviceNameSnapshot`. `amount` = `centsToInput(servicePriceCents)`, `rate` = `rateToInput(commissionRateSnapshotBp)`, `rateTouched: true` |
| Cash, card | `centsToInput` if above 0, otherwise empty |
| Turn count, client type, note, both tip-received boxes | From the turn |
| Time | `timeOf(turn.occurredAt)` |
| More options | Open only if turn count is not 1, or the client type is set, or there is a note |

In edit mode a preset's name on a line:
- If the chip for that preset is unchanged, keep the old `serviceNameSnapshot`, so a saved name is not rewritten by editing a tip. Keep `originalName` and `originalChoice` on `LineState` for this.
- If the chip changed, use the preset's current name.

`rateTouched: true` on every loaded line is what stops an old turn's rate changing to today's default. This is required by the spec: "Never silently change historical commission calculations".

Saving in edit mode:
- Calls `updateTurn(db, turnId, input)`.
- `occurredAt`: if the time box still equals `timeOf(turn.occurredAt)` **and** the date is unchanged, keep `turn.occurredAt`. If the time is unchanged but the date changed, use `localDateTimeToMs(date, time)`. If the time box was emptied, keep `turn.occurredAt`.
- No "Save & Add Another" button in edit mode.
- Do not update `lastServicePresetId` in edit mode.

### 3. Delete

In edit mode, the header shows a trash button on the right: `aria-label={t(locale,'delete')}`, `className="p-1 text-danger-text"`. It opens `ConfirmDialog` with `deleteTurnTitle`, `deleteTurnBody`, `delete`, `cancel`, `danger`. Confirm runs `await deleteTurn(db, turnId)` then `onDone()`.

### 4. Route

In `src/app/routes.tsx`:
```tsx
<Route path="/edit/:id">{(params) => <TurnForm key={params.id} turnId={params.id} onDone={goBack} />}</Route>
```

### 5. Tests

Create `tests/e2e/edit-turn.spec.ts`, `seedSettings(page)` first:

| Test | Steps | Expected |
|---|---|---|
| Edit | `addTurn(page, { amount: '100', cash: '10' })`. Click `Turn #1`. Change amount to `200`. Save | Heading was `Edit Turn`. Today shows `$130.00` |
| Keeps its rate | Seed `{ defaultCommissionRateBp: 6000 }`. Add `100`. Run `await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('nail-tracker.settings')!); s.defaultCommissionRateBp = 5000; localStorage.setItem('nail-tracker.settings', JSON.stringify(s)) })`, then `page.reload()`. Open the turn | `Commission %` box still says `60`, and after Save, Today still shows `$60.00` |
| Delete, cancel | Add. Open it. Press Delete. Press Cancel in the dialog | The form is still there |
| Delete | Add. Open it. Press Delete. Press Delete in the dialog | Today shows `No turns yet` |
| Missing | Open `./#/edit/nope` | Shows `This entry no longer exists.` |

In the dialog use `page.getByRole('dialog').getByRole('button', { name: 'Delete' })`.

## Files

Create `src/ui/ConfirmDialog.tsx`, `tests/e2e/edit-turn.spec.ts`. Edit `src/features/turns/TurnForm.tsx`, `src/features/turns/ServiceLineFields.tsx` if needed, `src/app/routes.tsx`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/edit-turn.spec.ts tests/e2e/add-turn.spec.ts --workers=2` passes.

## Not in this task

History (T10).
