# T24: Charts on Earnings

- **Branch:** `task/T24-charts`
- **Milestone:** M5 Testing and polish
- **Depends on:** T23
- **Size:** about 45 minutes

## Goal

Earnings shows two small charts, drawn by hand in SVG. **No chart library.** Pattern to read: `git show daftar-base:src/features/summary/SummaryPage.tsx`, which draws bars by hand.

## Steps

### 1. Chart data: `src/features/earnings/chartData.ts`

```ts
export interface ChartBar {
  key: string // a date, a week start, or a month start
  label: string
  earnedCents: number
  revenueCents: number
}

export function buildBars(
  turns: readonly TurnFigures[],
  adjustments: readonly (AdjustmentFigures & { localWorkDate: string })[],
  start: IsoDate,
  end: IsoDate,
  weekStart: 0 | 1,
  locale: DateLocale,
): ChartBar[]
```

The bucket size follows the length of the range: `const days = diffDays(end, start) + 1`.

| Days in range | One bar per | Label |
|---|---|---|
| 1 to 31 | Day. **Every** day in the range gets a bar, even with no data | Day of the month: `String(parseIsoDate(date).day)` |
| 32 to 120 | Week, starting on `weekRange(date, weekStart).start` | `formatDayShort(weekStart, locale)` |
| 121 or more | Month, starting on `monthRange(date).start` | First three letters of the month in English, or `T1` to `T12` in Vietnamese: `locale === 'vi' ? 'T' + month : new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(...)` |

Bars are in date order. For a bar, `earnedCents` is the sum of `sumTotals(turnsInBucket, adjustmentsInBucket).earnedCents`, and `revenueCents` is its `serviceRevenueCents`.

Weeks and months at the edges of the range are included, using only the data inside the range.

Also export:
```ts
/** The largest value, so bars can be scaled. At least 1, so nothing divides by zero. */
export function chartMax(bars: readonly ChartBar[]): number
```
It looks at both `earnedCents` and `revenueCents`.

### 2. `src/features/earnings/BarChart.tsx`

```tsx
interface Props {
  title: string
  summary: string
  bars: ChartBar[]
  series: ('earned' | 'revenue')[]
}
```

Rules:
- `<figure>` with `<figcaption className="text-sm font-medium">` holding `title`.
- `<svg viewBox="0 0 320 140" role="img" aria-label={summary} className="w-full">`. The `viewBox` keeps it the same shape at any width, so it cannot cause sideways scroll.
- Plot area: x from 4 to 316, bars from y 8 down to y 118. Labels at y 134 in `fontSize="10"`, `textAnchor="middle"`, `fill="currentColor"`.
- Bar height: `value / max * 110`. A value above zero gets at least 2 high, so it can be seen. Negative values draw as 0.
- Slot width: `312 / bars.length`. Each bar is 70% of its slot. With two series, each is 35%, side by side.
- Colours through CSS, so they follow the theme: earned `fill="var(--brand-600)"`, revenue `fill="var(--brand-200)"`.
- With more than 12 bars, label only every `Math.ceil(bars.length / 12)`th bar.
- With two series, show a legend under the chart in HTML, in `flex gap-3 text-xs`: a small square and the words `chartEarnedLegend`, `chartRevenueLegend`. Words are required, because colour alone is not enough.
- The numbers themselves are in the cards above, so no tooltip is needed.

### 3. Add to `EarningsPage.tsx`

Below the averages card, above the CSV button, inside a `card`:

- `chartDaily`: series `['earned']`.
- `chartRevenueVsEarned`: series `['revenue', 'earned']`.

For the Daily choice (one day), skip both charts. If no bar has a value above 0, show `chartNoData` instead of the charts.

`summary` is `tf(locale,'chartSummary',{ days: bars.length, amount: formatUsd(highest) })`, where `highest` is the largest `earnedCents`.

`loadEarnings` already loads the turns. Extend it to also return `bars`, taking `weekStart` and `locale` as new arguments. Update its test calls to pass `0` and `'en'`.

`loadRange` returns turns with all the fields `TurnFigures` needs, and adjustments with `localWorkDate`, so no conversion is needed.

### 4. Tests

Create `tests/unit/chartData.test.ts`. Use small helper objects like those at the top of `tests/unit/totals.test.ts`.

| Case | Expected |
|---|---|
| A week, Nov 1 to 7, a turn on Nov 3 with $60 commission and $100 revenue | 7 bars, labels `1` to `7`, the third has `earnedCents` 6000 and `revenueCents` 10000, the others 0 |
| An adjustment of `-500` on Nov 3, same turn | Third bar `earnedCents` 5500 |
| A month of 30 days | 30 bars |
| Range of 60 days from `2026-09-01`, `weekStart` 0 | First bar's `key` is `2026-08-30`. Number of bars is 9 |
| A year, `2026-01-01` to `2026-12-31`, English | 12 bars, first label `Jan`, last label `Dec` |
| A year, Vietnamese | First label `T1`, last label `T12` |
| `chartMax` on bars of 100 and 200 | 200 |
| `chartMax` on `[]` | 1 |

Add to `tests/e2e/earnings.spec.ts`, with the clock fixed at `2026-11-04T12:00:00`:

| Test | Steps | Expected |
|---|---|---|
| Shows | `addTurn(page, { amount: '100' })`. Open Earnings | `Earned each day` shows. `page.getByRole('img', { name: /Highest day \$60\.00/ })` is visible |
| No data | Open Earnings with nothing saved | `Not enough data for a chart yet.` |
| One day | Add a turn. Open Earnings. Press Daily | No `img` role named like `Highest day` |

The Earnings screen test in `tests/e2e/a11y.spec.ts` already has data from T23, so it audits the charts with no change. Run it to confirm.

## Files

Create `src/features/earnings/chartData.ts`, `src/features/earnings/BarChart.tsx`, `tests/unit/chartData.test.ts`. Edit `src/features/earnings/earningsData.ts`, `src/features/earnings/EarningsPage.tsx`, `tests/unit/earningsData.test.ts`, `tests/e2e/earnings.spec.ts`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/earnings.spec.ts tests/e2e/a11y.spec.ts --workers=2` passes.
- `git diff main --stat -- package.json` prints nothing, which proves no chart package was added.

## Not in this task

Anything else on the page.
