# V12: Reports maths

**Branch:** `task/V12-reports-maths`
**Read:** spec sections 5.4, 7.4 and 12; `src/domain/dates.ts`, `src/domain/totals.ts`, `src/domain/comparisons.ts`;
`src/features/earnings/chartData.ts`, `earningsRange.ts`; `TurnService` and `ClientType` in `src/db/schema.ts`.
**Goal:** pure functions, fully unit-tested, that the Reports screen (V13) shows. No screen changes in this task.

## `src/domain/reports.ts` (plain TypeScript, no React or Dexie)

Reuse `sumTotals`, `Span`, `weekRange`, `monthRange`, `yearRange`, `addDays` and `roundDiv`; do not copy them.
Money is whole cents; percents are whole numbers rounded half up with `roundDiv`.

```ts
export type ReportKind = 'week' | 'month' | 'year' | 'custom'

/** The whole period before: week -7 days; the previous calendar month; the previous year;
 *  custom: the same number of days ending the day before `span.start`. */
export function previousReportSpan(kind: ReportKind, span: Span): Span

/** The same dates one year earlier; February 29 becomes February 28. */
export function lastYearSpan(span: Span): Span

export interface Change { differenceCents: number; percent: number | null } // difference may be negative
/** percent = round(difference / earlier * 100), only when earlier > 0; otherwise null (spec 7.4). */
export function change(currentCents: number, earlierCents: number): Change

/** Trend buckets: week, the 12 weeks ending with the span's week; month, the 12 months ending with the span's
 *  month; year, the 12 months of that year; custom, one bucket per day of the span (at most 62, else per week). */
export function trendSpans(kind: ReportKind, span: Span, weekStart: 0 | 1): Span[]

export interface ServiceLine { name: string; count: number; priceCents: number; shareCents: number; averageCents: number }
/** Grouped by service name (the saved snapshot), each service line counted once; sorted by share, then name. */
export function byService(services: readonly { serviceNameSnapshot: string; servicePriceCents: number;
  commissionCents: number }[]): ServiceLine[]

export interface WeekdayLine { weekday: number; days: number; averageEarnedCents: number; averageTurns: number;
  best: boolean; slowest: boolean }
/** Seven lines from the week start day. Averages over the days worked on that weekday (days with turns).
 *  Best and slowest by average earned among weekdays worked; none marked with fewer than 2 weekdays worked;
 *  a tie goes to the earlier weekday. averageTurns has one decimal: tenths as a whole number (25 = 2.5). */
export function byWeekday(turns: readonly TurnFigures[], adjustments: readonly DatedAdjustment[],
  weekStart: 0 | 1): WeekdayLine[]

export interface ClientLine { kind: 'request' | 'walkIn' | 'unspecified'; clients: number; percent: number;
  averageTipCents: number }
/** Clients are turns with turnCount >= 1 (as sumTotals counts customers). Lines with no clients are left out. */
export function clients(turns: readonly (TurnFigures & { clientType: ClientType })[]): ClientLine[]

export interface TipsSummary { cashCents: number; cardCents: number; averagePerClientCents: number;
  percentOfPrice: number | null; cardHeldCents: number }
export function tipsSummary(turns: readonly TurnFigures[]): TipsSummary

export interface Records { bestDay: { date: IsoDate; cents: number }; bestWeek: { start: IsoDate; cents: number };
  bestMonth: { start: IsoDate; cents: number }; mostTurns: { date: IsoDate; turns: number } }
/** All-time records by earned (turns plus dated adjustments). null until the first turn is at least 28 days
 *  before `today`. Ties go to the earlier date. */
export function records(turns: readonly TurnFigures[], adjustments: readonly DatedAdjustment[],
  weekStart: 0 | 1, today: IsoDate): Records | null
```

`DatedAdjustment` is `AdjustmentFigures & { localWorkDate: IsoDate }`, as `chartData.ts` already uses: export it from
`totals.ts` and use it in `chartData.ts` too. Shared and zero-turn entries count in money, never in turns or clients
(as version 1). Hours (`Per hour`) wait for V18: add nothing for them.

## Unit tests (`tests/unit/reports.test.ts`)

At least:
- `previousReportSpan`: week 2026-11-01..07 gives 2026-10-25..31; month October 2026 gives September 1..30; year 2026
  gives 2025; custom 2026-11-10..14 gives 2026-11-05..09.
- `lastYearSpan` of 2028-02-01..2028-02-29 gives 2027-02-01..2027-02-28.
- `change(421000, 390000)` gives 31000 and 8; `change(50000, 0)` gives 50000 and null; `change(0, 1000)` gives -1000
  and -100.
- `trendSpans` week mode: 12 spans, the last is the span's week, each seven days; month mode across a year change;
  year mode January to December.
- `byService`: a turn with three services counts three lines, `Gel-X` 14 × $70 at 60% gives 14 · $980 · $588 · $70.
- `byWeekday`: two Saturdays at $300 and $320 and one Tuesday at $95 give Saturday 31000 best, Tuesday slowest.
- `clients`: 38 requests and 62 walk-ins give 38% and 62%; a zero-turn entry is not a client.
- `tipsSummary`: tips as a percent of price; null when the price total is 0; held card tips are those not received.
- `records`: null with 27 days of data; best day, week (week start Monday and Sunday) and month; ties to the earlier.

## Done when

`pnpm gate` passes. No browser tests are needed for this task: do not run Playwright.
