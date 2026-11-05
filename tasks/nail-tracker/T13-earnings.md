# T13: Earnings screen

- **Branch:** `task/T13-earnings`
- **Milestone:** M3 Earnings and payday
- **Depends on:** T12
- **Size:** about 45 minutes

## Goal

The Earnings tab shows every required figure for a day, week, month, year or custom range. Charts come later (T24). The CSV button comes in T20.

## Steps

### 1. `src/features/earnings/earningsRange.ts`

```ts
export type PeriodChoice = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export function rangeOf(choice: Exclude<PeriodChoice, 'custom'>, date: IsoDate, weekStart: 0 | 1): { start: IsoDate; end: IsoDate }
export function stepDate(choice: Exclude<PeriodChoice, 'custom'>, date: IsoDate, direction: -1 | 1): IsoDate
```

`rangeOf`: daily is that day, weekly is `weekRange`, monthly is `monthRange`, yearly is `yearRange`.

`stepDate` moves to the neighbouring period and always returns a real date:
| Choice | Rule |
|---|---|
| `daily` | `addDays(date, direction)` |
| `weekly` | `addDays(date, direction * 7)` |
| `monthly` | Take `monthRange(date)`. Back: `addDays(start, -1)`. Forward: `addDays(end, 1)` |
| `yearly` | Take `yearRange(date)`. Back: `addDays(start, -1)`. Forward: `addDays(end, 1)` |

### 2. `src/features/earnings/earningsData.ts`

```ts
export interface EarningsData {
  totals: Totals
  averages: ReturnType<typeof averages>
  paidInRangeCents: number
  outstandingAllTimeCents: number
}

export async function loadEarnings(db: NailDb, start: IsoDate, end: IsoDate): Promise<EarningsData>
```
- `totals`: `sumTotals` on `loadRange(db, start, end)`.
- `paidInRangeCents`: sum of `amountCents` of payments with `paymentDate` between start and end, both included.
- `outstandingAllTimeCents`: `sumTotals(await db.turns.toArray(), await db.adjustments.toArray()).expectedPayoutCents` minus the sum of **all** payments.

### 3. Replace `src/features/earnings/EarningsPage.tsx`

State: `choice` (default `'weekly'`), `date` (default today, from `useToday()`), `customStart`, `customEnd` (both default to today).

Page, top to bottom:

1. `PageHeader` with `earningsTitle`.
2. Five chips with `aria-pressed`: `periodDaily`, `periodWeekly`, `periodMonthly`, `periodYearly`, `periodCustom`.
3. A row (not for Custom): left arrow button (`aria-label` `previousPeriod`), the range text in the middle, right arrow button (`aria-label` `nextPeriod`). Text:
   - daily: `formatDayLong(date, locale)`
   - weekly: `formatRange(start, end, locale)`
   - monthly: `formatMonthYear(date, locale)`
   - yearly: the year, `start.slice(0, 4)`
4. For Custom: two date boxes (`from`, `to`), with `errorRange` if end is before start, and no data loaded in that case.
5. Headline `card` with `bg-brand-50`: `totalEarned` label, `text-3xl font-semibold` amount.
6. `card` with rows (label left, amount right):
   - `totalTurns` (plain number)
   - `customers` (plain number)
   - `workDays` (plain number)
   - `serviceRevenue`
   - `commission`
   - `cashTips`
   - `cardTips`
   - `totalTips`
   - `adjustments`, only if it is not 0
7. `card` with rows:
   - `totalPaid`: `paidInRangeCents`
   - `outstandingBalance` followed by ` (` + `t(locale,'allTime')` + `)`: `outstandingAllTimeCents`. Text colour `text-warning-text` when above 0. When it is negative, show it in `text-positive-text`.
8. `card` with rows: `avgPerTurn`, `avgTipsPerTurn`, `avgPerWorkDay`.

Use one small local component `Row({ label, value, strong }: { label: string; value: string; strong?: boolean })` so markup is not repeated. Export it from `src/ui/Row.tsx`, because Payday uses it too. Use `flex items-baseline justify-between gap-3 py-1`.

Load with `useLiveQuery(() => loadEarnings(db, start, end), [start, end])`, returning `null` while `undefined`.

Numbers must not overflow at 375px: give the value `shrink-0` and the label `min-w-0`.

### 4. Tests

Create `tests/unit/earningsRange.test.ts`:

| Case | Expected |
|---|---|
| `rangeOf('daily', '2026-11-04', 0)` | both `2026-11-04` |
| `rangeOf('weekly', '2026-11-04', 1)` | `2026-11-02` to `2026-11-08` |
| `rangeOf('monthly', '2026-02-10', 0)` | `2026-02-01` to `2026-02-28` |
| `rangeOf('yearly', '2026-11-04', 0)` | `2026-01-01` to `2026-12-31` |
| `stepDate('daily', '2026-11-01', -1)` | `2026-10-31` |
| `stepDate('weekly', '2026-11-04', 1)` | `2026-11-11` |
| `stepDate('monthly', '2026-03-31', -1)` | `2026-02-28` |
| `stepDate('monthly', '2026-01-31', 1)` | `2026-02-01` |
| `stepDate('yearly', '2026-11-04', -1)` | `2025-12-31` |

Create `tests/unit/earningsData.test.ts` (database setup as `tests/unit/turnStore.test.ts`):

| Case | Expected |
|---|---|
| Turn on 2026-11-02: $100 at 60%, cash $10 received, card $15 not received. Payment `db.payments.add` of $40 on 2026-11-03. `loadEarnings(db, '2026-11-01', '2026-11-07')` | `totals.earnedCents` 8500, `paidInRangeCents` 4000, `outstandingAllTimeCents` 3500 (6000 + 1500 − 4000) |
| Same data, range `2026-12-01` to `2026-12-07` | `totals.earnedCents` 0, `paidInRangeCents` 0, `outstandingAllTimeCents` still 3500 |

Create `tests/e2e/earnings.spec.ts`, `seedSettings(page)` and `await page.clock.setFixedTime(new Date('2026-11-04T12:00:00'))` first:

| Test | Steps | Expected |
|---|---|---|
| Figures | `addTurn(page, { amount: '100', cash: '10', card: '15' })`. Open `./#/earnings` | Range reads `Nov 1 – Nov 7`. Page shows `$85.00`, `$100.00`, `$60.00`, `$25.00`. Outstanding `$75.00`: that is commission $60 + card $15 |
| Previous | Press Previous period | `Oct 25 – Oct 31`, and `$0.00` |
| Monthly | Press Monthly | `November 2026` |
| Custom error | Press Custom, From `2026-11-05`, To `2026-11-01` | `The end date must be on or after the start date.` |
| Empty | With no data, open it | Nothing crashes, `$0.00` shows |

## Files

Create `src/features/earnings/earningsRange.ts`, `src/features/earnings/earningsData.ts`, `src/ui/Row.tsx`, `tests/unit/earningsRange.test.ts`, `tests/unit/earningsData.test.ts`, `tests/e2e/earnings.spec.ts`. Replace `src/features/earnings/EarningsPage.tsx`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/earnings.spec.ts --workers=2` passes.

## Not in this task

Charts (T24), CSV export (T20).
