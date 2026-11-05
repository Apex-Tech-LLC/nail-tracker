# T14: Pay period logic and store

- **Branch:** `task/T14-pay-periods`
- **Milestone:** M3 Earnings and payday
- **Depends on:** T13
- **Size:** about 45 minutes

## Goal

Pay period maths and storage work and are tested. No screen changes.

## Steps

### 1. Ready-made tests

Copy them. Do not edit them.
```
cp tasks/nail-tracker/reference/unit/payPeriods.test.ts tests/unit/payPeriods.test.ts
cp tasks/nail-tracker/reference/unit/payday.test.ts tests/unit/payday.test.ts
```

### 2. `src/domain/payPeriods.ts`

```ts
import { addDays, diffDays, type IsoDate } from './dates.ts'

export type PayPeriodType = 'weekly' | 'biweekly' | 'custom' | 'none'

export interface DateSpan {
  startDate: IsoDate
  endDate: IsoDate
}
```
Then in `src/app/settings.ts` delete the local `PayPeriodType` line and write:
```ts
import type { PayPeriodType } from '../domain/payPeriods.ts'
export type { PayPeriodType }
```

| Function | Behaviour |
|---|---|
| `periodLengthDays(type: 'weekly' \| 'biweekly'): number` | 7 or 14 |
| `periodId(start, end): string` | `` `period-${start}-${end}` ``. Stable on purpose, so two phones or a restored backup agree |
| `periodContaining(date, anchor, length): DateSpan` | `const index = Math.floor(diffDays(date, anchor) / length)`, then start = `addDays(anchor, index * length)`, end = `addDays(start, length - 1)`. `Math.floor` is what makes dates before the anchor work |
| `missingPeriods(existing: readonly DateSpan[], schedule: { type: PayPeriodType; anchor: IsoDate \| null }, earliest: IsoDate, today: IsoDate): DateSpan[]` | Empty unless type is weekly or biweekly and anchor is set. Walks from the period containing `earliest` to the period containing `today`, oldest first. Leaves out any period that overlaps an existing one even by one day |
| `customPeriodProblem(start, end, existing: readonly (DateSpan & { id: string })[], ignoreId?: string): 'endBeforeStart' \| 'overlap' \| null` | Checks `end < start` first. Then overlap with any period whose id is not `ignoreId`. Sharing one day counts as overlap |

Two date spans overlap when `a.startDate <= b.endDate && b.startDate <= a.endDate`. ISO date text compares correctly with `<=`.

### 3. `src/domain/payday.ts`

```ts
export type PayStateName = 'owed' | 'paid' | 'overpaid' | 'empty'

export interface AllocationLine {
  payPeriodId: string
  amountCents: number
}
```

| Function | Behaviour |
|---|---|
| `payState(expectedCents, paidCents): { outstandingCents: number; state: PayStateName }` | Outstanding is expected minus paid. Above 0 is `owed`. Below 0 is `overpaid`. At 0 it is `empty` if expected is 0, otherwise `paid` |
| `suggestAllocations(amountCents, periods: readonly { payPeriodId: string; outstandingCents: number }[], fallbackPeriodId: string): AllocationLine[]` | `periods` arrive oldest first. Fill each period that owes more than 0, up to what it owes, until the money runs out. Anything left goes to `fallbackPeriodId`: added to its line if it already has one, otherwise as a new line at the end |
| `allocationProblem(amountCents, lines: readonly AllocationLine[]): 'amount' \| 'line' \| 'mismatch' \| null` | Check in this order. `amount` if the payment is 0 or less. `line` if any line is 0 or less. `mismatch` if the lines do not add up to the payment. Otherwise null |

Run `pnpm exec vitest run tests/unit/payPeriods.test.ts tests/unit/payday.test.ts --maxWorkers=2` until it passes.

### 4. `src/features/payday/periodStore.ts`

```ts
export interface PeriodSummary {
  period: PayPeriod
  totals: Totals
  paidCents: number
  outstandingCents: number
  state: PayStateName
}
```

| Function | Behaviour |
|---|---|
| `ensurePayPeriods(db, schedule: { type: PayPeriodType; anchor: IsoDate \| null }, today: IsoDate, now = Date.now()): Promise<void>` | Earliest date = the smallest of `today`, the first turn's date (`db.turns.orderBy('localWorkDate').first()`) and the first adjustment's date. Calls `missingPeriods` with all existing periods. Adds each with `id: periodId(...)`, `status: 'open'`, `createdAt` and `updatedAt` = `now`. Use `bulkPut`, so running twice at once cannot fail |
| `addCustomPeriod(db, start, end, now = Date.now()): Promise<string>` | Throws `new Error(problem)` if `customPeriodProblem` returns one. Otherwise adds it and returns the id |
| `setPeriodStatus(db, id, status: 'open' \| 'closed', now = Date.now())` | Updates `status` and `updatedAt` |
| `deletePeriod(db, id): Promise<boolean>` | Returns `false` and changes nothing if `paymentAllocations` has a row for it. Otherwise deletes and returns `true` |
| `loadPeriodSummaries(db): Promise<PeriodSummary[]>` | Oldest first by `startDate`. Per period: `loadRange(db, startDate, endDate)`, `sumTotals`, `paidCents` = sum of allocation rows for it, then `payState(totals.expectedPayoutCents, paidCents)` |

`loadPeriodSummaries` must read all tables inside one `useLiveQuery` call to stay live. It is fine for it to call `loadRange` in a loop. A user has at most a few hundred periods.

### 5. Store tests

Create `tests/unit/periodStore.test.ts` (database setup as `tests/unit/turnStore.test.ts`):

| Case | Expected |
|---|---|
| `ensurePayPeriods` weekly, anchor `2026-11-01`, today `2026-11-16`, empty database | 3 periods, ids `period-2026-11-01-2026-11-07`, `period-2026-11-08-2026-11-14`, `period-2026-11-15-2026-11-21`, all `open` |
| Run it twice | Still 3 |
| A turn dated `2026-10-28` exists, today `2026-11-02` | Periods start at `2026-10-25` and `2026-11-01` |
| Type `none` | No periods |
| `addCustomPeriod` overlapping | rejects with `overlap` |
| `addCustomPeriod` with end before start | rejects with `endBeforeStart` |
| `setPeriodStatus` | Status is `closed`, `updatedAt` changed |
| `deletePeriod` with an allocation row | Returns `false`, the period is still there |
| `deletePeriod` with none | Returns `true`, it is gone |
| Spec payday example: period Nov 1 to 7. Turn on 11-03: service `200000` at `6000`, card `24000`, cash `18000` received. Allocation `140000`. | Summary: `totals.earnedCents` 162000... see the note below |

Note on that last case: $2,000 at 60% is `120000` commission, so earned is `120000 + 24000 + 18000 = 162000`, expected `144000`, paid `140000`, outstanding `4000`, state `owed`. Add the payment with `db.payments.add` and the allocation with `db.paymentAllocations.add`.

## Files

Create `src/domain/payPeriods.ts`, `src/domain/payday.ts`, `src/features/payday/periodStore.ts`, `tests/unit/payPeriods.test.ts`, `tests/unit/payday.test.ts`, `tests/unit/periodStore.test.ts`. Edit `src/app/settings.ts`.

## Done when

- `pnpm exec vitest run tests/unit/payPeriods.test.ts tests/unit/payday.test.ts tests/unit/periodStore.test.ts --maxWorkers=2` passes.
- `pnpm gate` passes.
- `git grep -n "react\|dexie" -- src/domain` prints nothing.

## Not in this task

Screens (T15). Payment saving (T16).
