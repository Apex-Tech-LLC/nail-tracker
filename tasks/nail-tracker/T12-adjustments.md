# T12: Adjustments

- **Branch:** `task/T12-adjustments`
- **Milestone:** M2 Core tracking
- **Depends on:** T11
- **Size:** about 35 minutes

## Goal

A person can add, edit and delete a signed money correction. It shows on History and changes totals.

## Steps

### 1. `src/features/adjustments/adjustmentStore.ts`

```ts
export interface AdjustmentInput {
  occurredAt: number
  localWorkDate: IsoDate
  amountCents: number
  category: AdjustmentCategory
  note?: string
}
```

| Function | Behaviour |
|---|---|
| `addAdjustment(db, input, now = Date.now())` | Throws `new Error('An adjustment cannot be zero')` if `amountCents` is 0. New UUID, `createdAt` and `updatedAt` = `now`. Empty note is left out. Returns the id |
| `updateAdjustment(db, id, input, now = Date.now())` | Same zero check. Throws `new Error('Adjustment not found')` if missing. Uses `db.adjustments.put`, keeps `id` and `createdAt` |
| `deleteAdjustment(db, id)` | Removes it |

### 2. `src/features/adjustments/AdjustmentForm.tsx`

Export `AdjustmentForm({ adjustmentId, onDone }: { adjustmentId?: string; onDone: () => void })`. Same load and not-found pattern as `TurnForm` in T09.

Page:
1. Header: X button, `<h1>` `newAdjustment` or `editAdjustment`. In edit mode, a trash button on the right opens `ConfirmDialog` with `deleteAdjustmentTitle`, `deleteAdjustmentBody`, `delete`, `cancel`, `danger`.
2. Date chips and date box, same as the turn form. Move that part out of `TurnForm.tsx` into `src/ui/WorkDateField.tsx` first, with props `{ value: IsoDate; onChange: (value: IsoDate) => void; error?: string }`, and use it in both forms. It takes today's date from `useToday()`.
3. Amount: `MoneyField`-like, but a minus sign must be typeable. `inputMode="decimal"` on iPhone has no minus key, so use `inputMode="text"` here. Add a `inputMode?: 'decimal' | 'text'` prop to `MoneyField`, default `'decimal'`. Label `amountSigned`, and show hint `amountSignedHint` below it.
4. Category: four chips with `aria-pressed`, from `ADJUSTMENT_LABEL`. Default `bonus`. When `bookkeepingDeduction` is chosen, show `adjBookkeepingHint` under the chips.
5. Note: `textarea`, label `note`.
6. Save button.

Validate: `parseSignedCents(amount)` is not null and not 0, else `errorAdjustmentAmount`. Date as before.

`occurredAt` on save: `Date.now()` for a new one. When editing, keep the old value unless the date changed, then `localDateTimeToMs(date, '12:00')`.

### 3. Routes

In `src/app/routes.tsx`, **in this order**, because `/adjustment/new` would otherwise be read as an id:
```tsx
<Route path={paths.adjustmentNew}>{() => <AdjustmentForm onDone={goBack} />}</Route>
<Route path="/adjustment/:id">
  {(params) => <AdjustmentForm key={params.id} adjustmentId={params.id} onDone={goBack} />}
</Route>
```

### 4. Tests

Create `tests/unit/adjustmentStore.test.ts`:

| Case | Expected |
|---|---|
| Add `-2500` `tipCorrection` | Saved signed, `note` undefined when given `''` |
| Add `0` | rejects with `An adjustment cannot be zero`, nothing saved |
| Update | Keeps `createdAt`, changes `amountCents`, sets `updatedAt` |
| Update a missing id | rejects with `Adjustment not found` |
| Delete | Gone |

Create `tests/e2e/adjustments.spec.ts`, `seedSettings(page)` and `await page.clock.setFixedTime(new Date('2026-11-04T12:00:00'))` first:

| Test | Steps | Expected |
|---|---|---|
| Negative | `addTurn(page, { amount: '100' })`. Open `./#/adjustment/new`. Amount `-25`, type Commission correction, note `Wrong price`, Save. Open History | Shows `Commission correction`, `Wrong price`, `-$25.00`, day total `$35.00` |
| On Today | Same. Open `./` | Shows `Adjustments` with `-$25.00` and Total earned `$35.00` |
| Zero | Amount `0`, Save | `Enter an amount that is not zero, like 25 or -25.` |
| Edit | Add `10` Bonus. On History tap it, change to `20`, Save | Shows `$20.00` |
| Delete | Add one. On History tap it, Delete, confirm | `Nothing recorded for these dates.` |

The adjustment forms use `goBack`, which returns to History when opened from there. A test that opens the form with `page.goto` lands on Today after Save. Open History yourself after that.

## Files

Create `src/features/adjustments/adjustmentStore.ts`, `src/features/adjustments/AdjustmentForm.tsx`, `src/ui/WorkDateField.tsx`, `tests/unit/adjustmentStore.test.ts`, `tests/e2e/adjustments.spec.ts`. Edit `src/features/turns/TurnForm.tsx`, `src/ui/MoneyField.tsx`, `src/app/routes.tsx`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/adjustments.spec.ts tests/e2e/add-turn.spec.ts tests/e2e/edit-turn.spec.ts --workers=2` passes.

## Not in this task

Earnings and Payday totals (T13, T15). They pick adjustments up through `sumTotals`.
