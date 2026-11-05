# T16: Payments and how they split across pay periods

- **Branch:** `task/T16-payments`
- **Milestone:** M3 Earnings and payday
- **Depends on:** T15
- **Size:** about 50 minutes

## Goal

A person records what the salon paid. One payment can cover several pay periods, and one pay period can have several payments. Outstanding updates by itself.

## Steps

### 1. `src/features/payday/paymentStore.ts`

```ts
export interface PaymentInput {
  paymentDate: IsoDate
  amountCents: number
  paymentMethod: PaymentMethod
  notes?: string
  allocations: AllocationLine[]
}
```

| Function | Behaviour |
|---|---|
| `addPayment(db, input, now = Date.now()): Promise<string>` | Runs `allocationProblem(input.amountCents, input.allocations)`. If not null, throws `new Error(problem)`. In one transaction over `db.payments` and `db.paymentAllocations`, adds the payment and one `PaymentAllocation` per line (new UUID each). Empty notes are left out. Returns the id |
| `updatePayment(db, id, input, now = Date.now())` | Same check. Throws `new Error('Payment not found')` if missing. Uses `put`, keeps `createdAt`. Deletes old allocation rows and adds the new ones, in one transaction |
| `deletePayment(db, id)` | Deletes the payment and its allocations in one transaction |
| `loadPaymentsForPeriod(db, periodId): Promise<{ payment: Payment; allocatedCents: number }[]>` | Allocation rows for that period, joined to their payments, newest `paymentDate` first |

### 2. `src/features/payday/PaymentForm.tsx`

Export `PaymentForm({ periodId, paymentId, onDone }: { periodId?: string; paymentId?: string; onDone: () => void })`. New payments pass `periodId`. Editing passes `paymentId`.

Load in one `useLiveQuery`:
- `summaries`: `loadPeriodSummaries(db)`
- when `paymentId` is set: the payment and its allocation rows. `null` if missing, then show `entryNotFound`.

Page:
1. Header: X button, `<h1>` `newPayment` or `editPayment`. In edit mode, a trash button opens `ConfirmDialog` with `deletePaymentTitle`, `deletePaymentBody`, `delete`, `cancel`, `danger`.
2. `paymentDate`: `<input type="date">`, default today.
3. `paymentAmount`: `MoneyField`.
4. `paymentMethod`: five chips with `aria-pressed`: `methodCash`, `methodCheck`, `methodDirectDeposit`, `methodZelle`, `methodOther`. Default `directDeposit`.
5. `note`: `textarea`, saved as `notes`.
6. **Allocation section:** `<h2>` `allocationTitle`, hint `allocationHint`.

### 3. Allocation lines

State: `lines: { key: string; payPeriodId: string; amount: string }[]` and `linesTouched: boolean`.

**Filling in automatically.** While `linesTouched` is false, every change to the amount rebuilds the lines:
```ts
const cents = parseCents(amount)
if (cents !== null && cents > 0) {
  setLines(suggestAllocations(cents, owing, fallback).map(toLineState))
}
```
- `owing`: for each summary, oldest first, `{ payPeriodId: s.period.id, outstandingCents: s.outstandingCents + mine }`, where `mine` is what **this** payment already has on that period when editing (0 for a new payment). Without `mine`, editing a payment would count its own money as already paid.
- `fallback`: `periodId`, or when editing, the first allocation's `payPeriodId`.

In edit mode, start with the saved lines and `linesTouched: true`.

**Each line** shows:
- A `<select>` of periods labelled `payPeriod`, `field` class, each option `formatRange(...)`, newest first.
- A `MoneyField` with the same label as the amount: `t(locale,'paymentAmount')`. Use `aria-label` style via the `label` prop.
- A remove button when there is more than one line, `aria-label` `remove`.

Wrap each line in `<div data-testid="allocation-line">`. Any change to a line sets `linesTouched` true.

Below the lines:
- `addAllocation`, `secondaryButton`. Adds a line with the first period not yet used, and an empty amount.
- `tf(locale,'allocationLeft',{ amount: formatUsd(left) })` in `text-sm`, where `left` is the payment minus the sum of readable lines. Show only when it is not 0.

Two lines must not use the same period. If they do, merge them on save by adding their amounts.

### 4. Saving

1. `parseCents(amount)` is not null and above 0, else `errorPaymentAmount` under the amount.
2. Each line's `parseCents` is not null, else that line shows `errorAmount`.
3. Merge lines with the same period.
4. `allocationProblem`:

| Result | Show |
|---|---|
| `amount` | `errorPaymentAmount` |
| `line` | `errorAllocationLine` |
| `mismatch` | `errorAllocationMismatch` |

5. `addPayment` or `updatePayment`, then `onDone()`.

### 5. Payments on the period page

In `src/features/payday/PeriodPage.tsx`, replace the empty payments part. `useLiveQuery(() => loadPaymentsForPeriod(db, periodId), [periodId])`. Each row is a `<Link href={paths.payment(payment.id)}>` in a `card`:
- Left: `formatDayShort(paymentDate, locale)` and the method's words.
- Right: `formatUsd(allocatedCents)`. If the payment is larger than `allocatedCents`, add `text-xs text-text-secondary` `formatUsd(payment.amountCents)` below, so a split payment is clear.

Export the method words as `PAYMENT_METHOD_LABEL` from `src/features/payday/payStateLabels.ts`: `{ cash: 'methodCash', check: 'methodCheck', directDeposit: 'methodDirectDeposit', zelle: 'methodZelle', other: 'methodOther' }`.

### 6. Routes

```tsx
<Route path="/payday/:periodId/pay">
  {(params) => <PaymentForm key={params.periodId} periodId={params.periodId} onDone={goBack} />}
</Route>
<Route path="/payment/:id">{(params) => <PaymentForm key={params.id} paymentId={params.id} onDone={goBack} />}</Route>
```

### 7. Tests

Create `tests/unit/paymentStore.test.ts` (database setup as `tests/unit/turnStore.test.ts`):

| Case | Expected |
|---|---|
| Add `90000` split `60000` + `30000` | 1 payment, 2 allocation rows |
| Add with lines that do not add up | rejects with `mismatch`, nothing saved |
| Add with amount `0` | rejects with `amount` |
| Update | Old allocation rows are gone, new ones saved, `createdAt` kept |
| Update a missing id | rejects with `Payment not found` |
| Delete | Payment and allocation rows gone |
| `loadPaymentsForPeriod` | Returns the allocated part, newest first |

Add to `tests/e2e/payday.spec.ts`. Same setup as T15. Seed with `weeklyPay`.

| Test | Steps | Expected |
|---|---|---|
| Spec shortage | `addTurn(page, { amount: '2000', cash: '180', card: '240' })`. Open the period. Record payment. Amount received `1400`. Save | Back on the period: Salon paid `$1,400.00`. Outstanding `$40.00`. `Still owed` shows |
| Paid in full | Same turn. Pay `1440` | `Paid in full`, Outstanding `$0.00` |
| Overpaid | Same turn. Pay `1500` | `Overpaid by $60.00` |
| Two partial payments | Same turn. Pay `1000`, then pay `440` | `Paid in full`. Two rows under Payments |
| Across two periods | Fix the date at `2026-11-04`, add a `100` turn. Move the clock with `page.clock.setFixedTime(new Date('2026-11-10T12:00:00'))`, add a `100` turn. Open the newest period, Record payment, amount `120` | Two `allocation-line` rows filled in: `60.00` on `Nov 1 – Nov 7`, `60.00` on `Nov 8 – Nov 14`. After Save, both periods show `Paid in full` |
| Mismatch | Same as above, change a line's amount to `10`, Save | `The amounts below must add up to the payment.` |
| Delete payment | Pay `1000`. Tap the payment. Delete, confirm | Salon paid `$0.00` |
| Edit payment | Pay `1000`. Tap it. Amount received `1100`. In the line, set `1100`. Save | Salon paid `$1,100.00` |
| Zero | Amount `0`, Save | `Enter an amount above zero.` |

## Files

Create `src/features/payday/paymentStore.ts`, `src/features/payday/PaymentForm.tsx`, `tests/unit/paymentStore.test.ts`. Edit `src/features/payday/PeriodPage.tsx`, `src/features/payday/payStateLabels.ts`, `src/app/routes.tsx`, `tests/e2e/payday.spec.ts`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/payday.spec.ts tests/e2e/earnings.spec.ts --workers=2` passes.

## Not in this task

Settings (T17).
