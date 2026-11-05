# T06: Add Turn form, the basic version

- **Branch:** `task/T06-add-turn-basic`
- **Milestone:** M2 Core tracking
- **Depends on:** T05
- **Size:** about 50 minutes

## Goal

From `#/add` a person can pick a service, type a price and tips, see the commission and earnings before saving, and save. One service only for now. T08 adds more.

Pattern to read first: `git show daftar-base:src/features/expenses/ExpenseForm.tsx` (how a form is laid out, how date chips work, how it calls `requestPersistence`).

## Steps

### 1. Shared style file

Create `src/ui/styles.ts` holding the class names from the handbook (`tasks/nail-tracker/README.md`, "UI rules"), each with `export`: `card`, `field`, `label`, `chip`, `chipOn`, `chipOff`, `primaryButton`, `secondaryButton`, `dangerButton`, `errorText`.

### 2. Money input

Create `src/ui/MoneyField.tsx`:

```tsx
interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}
```
Renders a `label` and a text input with a `$` shown inside on the left (a `<span aria-hidden="true">` positioned absolute, input gets `pl-7`). Input attributes: `type="text"`, `inputMode="decimal"`, `autoComplete="off"`, `aria-invalid={!!error}`, `aria-describedby` pointing at the error when there is one. Shows `error` in a `<p className={errorText}>`. Uses `useId()`. Also create `src/ui/PercentField.tsx`, the same but with `%` on the right (input gets `pr-7`) and no `$`.

### 3. The form

Create `src/features/turns/TurnForm.tsx` exporting `TurnForm({ onDone }: { onDone: () => void })`.

Load presets with:
```ts
const presets = useLiveQuery(() => db.servicePresets.orderBy('sortOrder').filter((p) => p.isActive).toArray())
if (!presets) return null
```
Then render an inner component that receives `presets`, so `useState` starts with real values.

Page, top to bottom:

1. **Header:** an X button (`aria-label` `t(locale,'close')`, calls `onDone`), and `<h1>` `t(locale,'newTurn')`. Copy the header markup from the old form.
2. **Date chips:** `today`, `yesterday`, `otherDay`, as `<button type="button" aria-pressed={...}>` with `chip` classes. With "Other day" chosen, show `<input type="date">` labelled `t(locale,'workDate')` using the `field` class. The value is `IsoDate` text. Default is today.
3. **Service chips:** one chip per preset, showing `locale === 'vi' ? preset.nameVi : preset.nameEn`, then a last chip `t(locale,'presetOther')`. Wrap them in `flex flex-wrap gap-2`, with a `<p className={label}>` `t(locale,'service')` above. Each is `<button type="button" aria-pressed>`.
   - Starting choice: the preset whose id is `settings.lastServicePresetId` if it is in the list, otherwise the first preset.
   - The chosen key is a preset id, or the text `'other'`.
   - Choosing a preset with `defaultPriceCents` fills the amount with `centsToInput(defaultPriceCents)`, but only if the amount box is empty.
   - Choosing "Other" shows a text input labelled `t(locale,'serviceName')`.
4. **Amount:** `MoneyField` with label `t(locale,'serviceAmount')`. `autoFocus` is fine on this input.
5. **Tips:** two `MoneyField`s in a two column grid (`grid grid-cols-2 gap-3`): `cashTip`, `cardTip`. They start empty and empty means $0.
6. **Commission:** `PercentField` labelled `t(locale,'commissionPercent')`, starting with `rateToInput(rate)`, where `rate` is the preset's `defaultCommissionRateBp ?? settings.defaultCommissionRateBp`. Changing service updates this box unless the person has typed in it (keep a `rateTouched` state).
7. **Live preview:** a `card` with two rows, label on the left and amount on the right: `previewCommission` and `previewEarned`. The earned row is `text-2xl font-semibold text-positive-text`. Both amounts come from `turnTotals`. If a field cannot be read yet, treat it as 0. Mark the card `aria-live="polite"`.
8. **Save:** `<button type="submit" className={primaryButton}>` `t(locale,'save')`. Stick it near the bottom with `mt-auto` as the old form does.

### 4. Saving

On submit (`event.preventDefault()`):

| Check | How | Error key, shown under the field |
|---|---|---|
| Amount | `parseCents(amount)` is not null. **$0 is allowed.** Empty is an error | `errorAmount` |
| Cash, card | Empty is 0. Otherwise `parseCents` not null | `errorAmount` |
| Rate | `parseRateBp` not null | `errorRate` |
| Other's name | Not empty after trim, only if Other is chosen | `errorServiceName` |
| Date | `isIsoDate(date)` | `errorDate` |

If nothing is wrong, call:
```ts
await addTurn(db, {
  occurredAt: Date.now(),
  localWorkDate: date,
  turnCount: 1,
  clientType: 'unspecified',
  cashTipCents,
  cardTipCents,
  cashTipReceived: settings.cashTipHandling === 'inHand',
  cardTipReceived: settings.cardTipHandling === 'inHand',
  lines: [{ servicePresetId, name, priceCents, rateBp }],
})
```
- `name` is the preset's name in the current language, or the typed name. `servicePresetId` is `null` for Other.
- After saving: `updateSettings({ lastServicePresetId: servicePresetId })` only when it is not null, then `void requestPersistence()` (from `src/pwa/persistStorage.ts`), then `onDone()`.

### 5. Route and button

- `src/app/routes.tsx`: add `<Route path={paths.add}>{() => <TurnForm onDone={goBack} />}</Route>` with `const goBack = useGoBack()` at the top of `Routes`.
- `src/features/today/TodayPage.tsx`: under the placeholder text add `<Link href={paths.add} className={primaryButton}>` with `t(locale,'addTurn')`. T07 replaces this page. Give the link `text-center block` too.

### 6. Tests

Add to `tests/e2e/helpers.ts`:
```ts
interface TurnOptions {
  service?: string
  amount: string
  cash?: string
  card?: string
  rate?: string
}

/** Fills and saves the Add Turn form (English UI), and waits for Today. */
export async function addTurn(page: Page, { service = 'Manicure', amount, cash, card, rate }: TurnOptions): Promise<void> {
  await page.goto('./#/add')
  await page.getByRole('button', { name: service, exact: true }).click()
  await page.getByLabel('Service amount').fill(amount)
  if (cash) await page.getByLabel('Cash tip').fill(cash)
  if (card) await page.getByLabel('Card tip').fill(card)
  if (rate) await page.getByLabel('Commission %').fill(rate)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Add Turn' })).toBeVisible()
}
```

Create `tests/e2e/add-turn.spec.ts`, using `seedSettings(page)` before each test:

| Test | Steps | Expected |
|---|---|---|
| Live preview | Open `./#/add`. Pick Gel-X. Amount `100`. Cash tip `10`. Card tip `15` | Page shows `$60.00` and `$85.00` |
| Rate from settings | Seed `{ defaultCommissionRateBp: 5000 }`, open form | `Commission %` box holds `50` |
| Error | Press Save with an empty amount | Text `Enter an amount like 45 or 45.50.` shows, and the URL still ends in `#/add` |
| Other | Pick Other, amount `30`, Save with no name | Text `Enter a service name.` shows |
| Save | `addTurn(page, { amount: '45' })` | The helper finishes, which proves the form closed and returned to Today |
| Last used | Save with Pedicure, open `./#/add` again | Pedicure button has `aria-pressed="true"` |

## Files

Create `src/ui/styles.ts`, `src/ui/MoneyField.tsx`, `src/ui/PercentField.tsx`, `src/features/turns/TurnForm.tsx`, `tests/e2e/add-turn.spec.ts`. Edit `src/app/routes.tsx`, `src/features/today/TodayPage.tsx`, `tests/e2e/helpers.ts`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/add-turn.spec.ts --workers=2` passes.

## Not in this task

Several services, More options, Save & Add Another (T08). Edit and delete (T09). Showing saved turns (T07).
