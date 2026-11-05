# T10: History

- **Branch:** `task/T10-history`
- **Milestone:** M2 Core tracking
- **Depends on:** T09
- **Size:** about 45 minutes

## Goal

The History tab lists saved turns by day, newest day first, with each day's total. It can filter by date and search by service.

## Steps

### 1. Range helper: `src/features/history/historyRange.ts`

```ts
import { addDays, weekRange, type IsoDate } from '../../domain/dates.ts'

export type RangeChoice = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom'

export function rangeFor(
  choice: Exclude<RangeChoice, 'custom'>,
  today: IsoDate,
  weekStart: 0 | 1,
): { start: IsoDate; end: IsoDate } {
```
| Choice | Range |
|---|---|
| `today` | today to today |
| `yesterday` | day before to day before |
| `thisWeek` | `weekRange(today, weekStart)` |
| `lastWeek` | `weekRange(addDays(today, -7), weekStart)` |

Add `groupByDay` in the same file:
```ts
export interface DayGroup {
  date: IsoDate
  turns: Turn[]
  adjustments: Adjustment[]
  earnedCents: number
}
export function groupByDay(turns: readonly Turn[], adjustments: readonly Adjustment[]): DayGroup[]
```
Newest day first. Inside a day, turns are newest first by `occurredAt`. `earnedCents` is `sumTotals(dayTurns, dayAdjustments).earnedCents`.

Add `matchesSearch(services: readonly TurnService[], text: string): boolean`: true when `text.trim()` is empty, or when any `serviceNameSnapshot` contains it, ignoring case and Vietnamese accents:
```ts
const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
```

### 2. Replace `src/features/history/HistoryPage.tsx`

State: `choice` (default `'thisWeek'`), `customStart` and `customEnd` (both default to today), `search` (default empty).

Page, top to bottom:

1. `PageHeader` with `t(locale,'historyTitle')`.
2. Chips in `flex flex-wrap gap-2`, using `aria-pressed`: `rangeToday`, `rangeYesterday`, `rangeThisWeek`, `rangeLastWeek`, `rangeCustom`.
3. When Custom is chosen: two `<input type="date">` side by side labelled `from` and `to`. If end is before start, show `errorRange` and do not load.
4. Search box: `<input type="search">` labelled `searchServices`, with placeholder `searchPlaceholder`, `field` class.
5. `<Link href={paths.adjustmentNew}>` styled `secondaryButton block text-center`: `t(locale,'addAdjustment')`. The route arrives in T12. Until then it shows "not found".
6. The list.

Data: `useLiveQuery(() => loadRange(db, start, end), [start, end])`, returning `null` from the render while `undefined`.

**Turn numbers must be correct for each day even if a filter hides some turns.** So work out numbers from all the turns in the range, day by day:
```ts
const numbers = new Map<string, number | null>()
for (const group of groupByDay(data.turns, data.adjustments)) {
  for (const [id, number] of numberTurns(group.turns)) numbers.set(id, number)
}
```

When `search` has text, keep only turns where `matchesSearch` is true, and hide adjustments. Then `groupByDay` again for what is shown, but the day total still shows only the visible entries.

For each day:
- `<h2>`: `formatDayLong(date, locale)`, and on the right `t(locale,'dayTotal')` and `formatUsd(group.earnedCents)`.
- A `TurnRow` per turn (from T07).
- An `AdjustmentRow` per adjustment. Create `src/features/adjustments/AdjustmentRow.tsx`: a `<Link href={paths.adjustment(a.id)}>` in a `card`, showing the category's words, the note if any, and `formatUsd(a.amountCents)`. Category words: `{ bonus: 'adjBonus', commissionCorrection: 'adjCommissionCorrection', tipCorrection: 'adjTipCorrection', bookkeepingDeduction: 'adjBookkeepingDeduction' }`. Export that map as `ADJUSTMENT_LABEL` from `src/features/adjustments/adjustmentLabels.ts`. T12 uses it too.

Empty: `noEntries`, or `noMatches` when there is search text.

### 3. Tests

Create `tests/unit/historyRange.test.ts`:

| Case | Expected |
|---|---|
| `rangeFor('today', '2026-11-04', 0)` | both `2026-11-04` |
| `rangeFor('yesterday', '2026-11-01', 0)` | both `2026-10-31` |
| `rangeFor('thisWeek', '2026-11-04', 0)` | `2026-11-01` to `2026-11-07` |
| `rangeFor('thisWeek', '2026-11-04', 1)` | `2026-11-02` to `2026-11-08` |
| `rangeFor('lastWeek', '2026-11-04', 0)` | `2026-10-25` to `2026-10-31` |
| `groupByDay` with turns on two days and an adjustment | newest day first, totals include the adjustment |
| `matchesSearch` | `[{ serviceNameSnapshot: 'Làm móng chân' }]` matches `'mong'`. `[{ serviceNameSnapshot: 'Gel-X' }]` matches `'gel'` and not `'pedi'`. Empty search matches everything |

In the test, build `Turn` and `TurnService` objects with a helper that fills the other fields, and cast with `as TurnService` where only one field matters.

Create `tests/e2e/history.spec.ts`, with `seedSettings(page)` and `await page.clock.setFixedTime(new Date('2026-11-04T12:00:00'))` before the first `goto`:

| Test | Steps | Expected |
|---|---|---|
| Shows this week | Add `100` and `50` with Pedicure. Open History | `Wednesday, November 4`, `Turn #1`, `Turn #2` and day total `$90.00` show |
| Search | Same data. Type `pedi` in Search services | `Turn #2` shows. `Turn #1` does not |
| No match | Type `zzz` | `No turns match this search.` |
| Filter | Same data. Press Yesterday | `Nothing recorded for these dates.` |
| Custom | Press Custom. Set From `2026-11-05`, To `2026-11-01` | `The end date must be on or after the start date.` |
| Delete updates | Add one. Open History, tap it, delete it | History shows `Nothing recorded for these dates.` |

## Files

Create `src/features/history/historyRange.ts`, `src/features/adjustments/AdjustmentRow.tsx`, `src/features/adjustments/adjustmentLabels.ts`, `tests/unit/historyRange.test.ts`, `tests/e2e/history.spec.ts`. Replace `src/features/history/HistoryPage.tsx`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/history.spec.ts --workers=2` passes.

## Not in this task

Creating adjustments (T12).
