# V05: Comparison maths for Home

**Branch:** `task/V05-comparisons`
**Read:** spec sections 5.1 and 7.4; `src/domain/dates.ts`, `src/domain/totals.ts`.
**Goal:** pure functions, fully unit-tested, that Home (V06) uses to say "$162 more than this time last week". No
screen changes in this task.

## `src/domain/comparisons.ts` (plain TypeScript, no React or Dexie)

```ts
export type HomePeriod = 'today' | 'week' | 'month'

export interface Span { start: IsoDate; end: IsoDate }

/** The current period so far: today only; week start to today; month start to today. */
export function currentSpan(period: HomePeriod, today: IsoDate, weekStart: 0 | 1): Span

/**
 * The same stretch of the previous period:
 * - today: the same weekday last week (today - 7).
 * - week: last week's start to the same weekday last week.
 * - month: last month's day 1 to the same day number, capped at last month's last day
 *   (March 31 compares with February 1 to February 28, or 29 in a leap year).
 */
export function previousSpan(period: HomePeriod, today: IsoDate, weekStart: 0 | 1): Span

export interface Comparison {
  kind: 'more' | 'less' | 'same' | 'nothingToCompare'
  differenceCents: number // always zero or positive
}

/** nothingToCompare when the previous span had no turns at all (previousTurns === 0). */
export function compare(currentCents: number, previousCents: number, previousTurns: number): Comparison

export interface WeekDay {
  date: IsoDate
  earnedCents: number
  isFuture: boolean
  isToday: boolean
  lastWeekEarnedCents: number
}

/**
 * Seven days of the week holding `today`, in order from the week start day, each with that day's
 * earned total and the same weekday's total last week. `earnedByDate` holds earned cents per work date
 * and may include dates outside the two weeks.
 */
export function weekDays(today: IsoDate, weekStart: 0 | 1, earnedByDate: ReadonlyMap<IsoDate, number>): WeekDay[]

/** Fill level for the week view, 0 to 100: earned divided by the largest value among this week's and last week's days, rounded. 0 when everything is 0. */
export function fillPercent(earnedCents: number, maxCents: number): number
```

## Unit tests (`tests/unit/comparisons.test.ts`)

At least:
- Wednesday 2026-11-04, week starting Sunday: current `2026-11-01..2026-11-04`, previous `2026-10-25..2026-10-28`.
- Same date, week starting Monday: current `2026-11-02..2026-11-04`, previous `2026-10-26..2026-10-28`.
- Sunday with a Sunday start: current is one day; previous is last Sunday.
- Month on 2026-03-31: previous `2026-02-01..2026-02-28`; on 2028-03-31: `2028-02-01..2028-02-29`.
- Month on 2026-01-15: previous `2025-12-01..2025-12-15` (year change).
- Today on 2026-11-06: previous `2026-10-30..2026-10-30`.
- `compare(64000, 49800, 12)` gives more, 14200; `compare(100, 300, 1)` gives less, 200; `compare(500, 500, 2)` gives
  same, 0; `compare(500, 0, 0)` gives nothingToCompare.
- `weekDays` returns 7 days in order, marks today and future days, and reads last week's same weekday.
- `fillPercent(0, 0)` is 0; `fillPercent(150, 300)` is 50.

## Done when

`pnpm gate` passes. No browser tests are needed for this task: do not run Playwright.
