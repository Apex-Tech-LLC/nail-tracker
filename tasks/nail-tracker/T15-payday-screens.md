# T15: Payday list and period detail

- **Branch:** `task/T15-payday-screens`
- **Milestone:** M3 Earnings and payday
- **Depends on:** T14
- **Size:** about 45 minutes

## Goal

The Payday tab lists pay periods. Opening one shows what was earned, what was already received, and what the salon still owes, laid out like the spec's example.

## Steps

### 1. Replace `src/features/payday/PaydayPage.tsx`

```ts
const settings = useSettings()
const today = useToday()
const { payPeriodType: type, payPeriodAnchorDate: anchor } = settings

useEffect(() => {
  void ensurePayPeriods(db, { type, anchor }, today)
}, [type, anchor, today])

const summaries = useLiveQuery(() => loadPeriodSummaries(db))
```

Page:
1. `PageHeader` with `paydayTitle`.
2. If `summaries` is `undefined`, return just the header.
3. **No schedule:** if `type` is `none`, or `type` is weekly or biweekly with `anchor` null, and there are no periods: show `paydayNoSchedule` and a link to `paths.settings` with `primaryButton block text-center`: `paydayOpenSettings`. Stop there.
4. **Custom schedule:** if `type` is `custom`, show the "add period" part below.
5. **The list:** newest period first. Hide a period if its `state` is `empty` and it does not contain today. Each row is a `<Link href={paths.period(summary.period.id)}>` in a `card`:
   - Top line: `formatRange(startDate, endDate, locale)`. If it contains today, add a small `currentPeriod` tag (`rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-900`).
   - Left below: state words. `{ owed: 'statusOwed', paid: 'statusPaid', overpaid: 'statusOverpaid', empty: 'statusEmpty' }`. Export this as `PAY_STATE_LABEL` from `src/features/payday/payStateLabels.ts`. Colour: owed `text-warning-text`, paid `text-positive-text`, overpaid `text-danger-text`, empty `text-text-secondary`.
   - Right below: `formatUsd(Math.abs(outstandingCents))`, unless state is `empty` or `paid`, then show `formatUsd(totals.expectedPayoutCents)`.
6. If nothing is left to show, `paydayNoPeriods`.

### 2. Add a custom period

Create `src/features/payday/AddPeriodForm.tsx`, shown on the Payday page when `type === 'custom'`.

A `secondaryButton` `addCustomPeriod` opens two date inputs (`from`, `to`) and `save`, `cancel`, with `newPeriod` as an `<h2>`. On save, call `customPeriodProblem` with the existing periods:

| Result | Show |
|---|---|
| `endBeforeStart` | `errorPeriodOrder` |
| `overlap` | `errorPeriodOverlap` |
| `null` | `await addCustomPeriod(db, start, end)`, then close |

Dates must pass `isIsoDate`, else `errorDate`.

### 3. `src/features/payday/PeriodPage.tsx`

Export `PeriodPage({ periodId, onDone }: { periodId: string; onDone: () => void })`.

Load:
```ts
const summary = useLiveQuery(async () => {
  const all = await loadPeriodSummaries(db)
  return all.find((s) => s.period.id === periodId) ?? null
}, [periodId])
```
`undefined` means return `null`. `null` means show `entryNotFound` and a link to `paths.payday`.

Page, top to bottom:

1. Header: X button, `<h1>` `formatRange(...)`, then a status tag: `statusOpen` or `statusClosed`.
2. `card`, `<h2>` `earnedSection`, using `Row` from T13:
   - `serviceCommission`: `commissionCents`
   - `cardTips`: `cardTipsCents`
   - `cashTips`: `cashTipsCents`
   - `adjustments`: `adjustmentsCents`, only if not 0
   - `totalEarned`: `earnedCents`, `strong`
3. `card`, `<h2>` `receivedSection`:
   - `tipsAlreadyReceived`: `tipsInHandCents`
   - `salonPaid`: `paidCents`
4. `card`, `<h2>` `owedSection`:
   - `expectedPayout`: `expectedPayoutCents`
   - `salonPaid`: `paidCents`
   - Last row, `strong`:
     - When `outstandingCents` is 0 or more: `outstanding`, with `formatUsd(outstandingCents)`, in `text-warning-text` when above 0.
     - When below 0: `tf(locale,'overpaidBy',{ amount: formatUsd(-outstandingCents) })`, on its own line, `text-danger-text`.
   - Below, the state words from `PAY_STATE_LABEL`.
5. `<Link href={paths.pay(periodId)}>`, `primaryButton block text-center`: `recordPayment`.
6. Payments section, `<h2>` `payments`, and text `noPayments`. T16 fills this in.
7. Period actions, `secondaryButton`: `closePeriod` if open, `reopenPeriod` if closed, calling `setPeriodStatus`.
8. `dangerButton` `deletePeriod`, only when `settings.payPeriodType === 'custom'`. Opens `ConfirmDialog` with `deletePeriodTitle`, `deletePeriodBody`, `delete`, `cancel`, `danger`. On confirm, `await deletePeriod(db, periodId)`. If it returns `false`, show `deletePeriodBlocked` under the button (`errorText`) and stay. If `true`, call `onDone()`.

**Closing a period only changes its label.** Nothing is locked and totals do not change. Turns in a closed period can still be edited.

### 4. Routes

In `src/app/routes.tsx`:
```tsx
<Route path="/payday/:periodId">
  {(params) => <PeriodPage key={params.periodId} periodId={params.periodId} onDone={goBack} />}
</Route>
```
`paths.payday` must stay above it.

### 5. Tests

Add a helper to `tests/e2e/helpers.ts`:
```ts
/** Pay period settings used by the payday tests: weekly, November 1 to 7 contains the fixed test date. */
export const weeklyPay = { payPeriodType: 'weekly', payPeriodAnchorDate: '2026-11-01' }
```

Create `tests/e2e/payday.spec.ts`. Before each test: `await page.clock.setFixedTime(new Date('2026-11-04T12:00:00'))`.

| Test | Setup | Steps | Expected |
|---|---|---|---|
| No schedule | `seedSettings(page)` | Open `./#/payday` | Shows `Set your payday schedule to see what the salon owes you.` and link `Open Settings` |
| Current period | `seedSettings(page, weeklyPay)` | Open `./#/payday` | Shows `Nov 1 – Nov 7`, `Current period`, `Nothing yet` |
| Figures | Same | `addTurn(page, { amount: '2000', cash: '180', card: '240' })`. Open `./#/payday`, click the period | Shows `$1,200.00`, `$240.00`, `$180.00`, `$1,620.00`, `$1,440.00`. Outstanding `$1,440.00` |
| Tip held by salon | Same | Open `./#/add`, amount `100`, cash `10`. Open More options, untick `Cash tip already in my hand`. Save. Open the period | Expected salon payout `$70.00` |
| Card tip in hand | Same, plus `cardTipHandling: 'inHand'` | `addTurn(page, { amount: '100', card: '15' })`. Open the period | Expected salon payout `$60.00` |
| Bookkeeping | Same | `addTurn(page, { amount: '100' })`. Add an adjustment of `-10`, type Bookkeeping deduction. Open the period | Total earned `$50.00`, expected salon payout `$60.00` |
| Close | Same | Open the period, press Close period | `Closed` shows. Press Reopen period and `Open` shows |
| Custom add | `seedSettings(page, { payPeriodType: 'custom' })` | Open `./#/payday`. Add pay period, From `2026-11-01`, To `2026-11-10`, Save | `Nov 1 – Nov 10` shows |
| Custom overlap | Same, one period made | Add pay period, From `2026-11-05`, To `2026-11-12`, Save | `These dates overlap another pay period.` |

Note for "Custom add": an empty period that holds today stays visible, and November 4 falls inside it, so it will show.

## Files

Create `src/features/payday/PeriodPage.tsx`, `src/features/payday/AddPeriodForm.tsx`, `src/features/payday/payStateLabels.ts`, `tests/e2e/payday.spec.ts`. Replace `src/features/payday/PaydayPage.tsx`. Edit `src/app/routes.tsx`, `tests/e2e/helpers.ts`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/payday.spec.ts --workers=2` passes.

## Not in this task

Recording payments (T16).
