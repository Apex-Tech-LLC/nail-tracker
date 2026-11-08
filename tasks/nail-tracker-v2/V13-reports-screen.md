# V13: Reports screen (replaces Earnings)

**Branch:** `task/V13-reports-screen`
**Read:** spec sections 5.4, 6 and 7.4; `src/domain/reports.ts` (V12); `src/features/earnings/*` (all of it: this task
turns Earnings into Reports); `tests/e2e/earnings.spec.ts`; `docs/design/v2-mockup.html` (card and chart styles).
**Goal:** a technician opens Reports and sees at a glance how this month compares with last month and last year,
where the money comes from, and their best days, using only V12's maths.

## 1. Reports replaces Earnings

Rename the tab `Earnings` to `Reports` (`Báo cáo`), same icon slot, same route (`/earnings`, kept so old links work).
Period picker: `Day`, `Week`, `Month`, `Year`, `Custom`, with the back and forward arrows as now (Day stays because
people use it to read one day). Day compares with the same weekday last week (V12 `previousReportSpan('week', ...)`
works for one day). Custom keeps its date boxes and its error for an end before the start.

## 2. Cards, in this order (`src/features/reports/`)

Move the page's files from `src/features/earnings/` to `src/features/reports/` and keep one data loader
(`loadReport`) that reads the range, the previous span, the same span last year, and the trend spans with indexed
date queries (the `localWorkDate` index), never the whole table, except Records, which reads all turns once.

1. **Summary.** Earned (large), then turns, clients, tips. Under earned: `▲ $310 (8%) on last month` and, when the
   same span last year has turns, `▲ $560 (15%) on Oct 2025`. The first line names the span: `on last week`,
   `on last month`, `on last year`, `on the same day last week`, `on the days before` (custom). Down is `▼`, no percent when the earlier amount is 0
   (V12 `change`). The version 1 rows (service revenue, commission, cash tips, card tips, adjustments, paid, outstanding,
   the three averages) stay in this card under a `Details` toggle (`aria-expanded`, closed by default).
2. **Trend.** Bars for earned over V12 `trendSpans` (Day mode: the 14 days ending on that day). The current bucket is
   the brand colour, the others lighter. Tapping a bar shows its dates and earned below the chart and a `Open` link
   that moves the picker to that bucket. The goal line comes in V15: leave a prop for it, draw nothing now.
3. **By service.** `Gel-X 14 · $980 · $588 · avg $70`, top 8, then `Show all`.
4. **By weekday.** Seven rows from the week start day: weekday, average earned, average turns; `Best` and `Slowest`
   tags. Shown only for Month, Year and Custom ranges of 14 days or more.
5. **Clients.** Request versus walk-in (and `Not set` when present): count, percent, average tip.
6. **Tips.** Cash, card, average per client, percent of price, `Card tips the salon still holds`.
7. **Records.** Best day, best week, best month, most turns in a day, each with its date; hidden while V12 `records`
   returns null.
8. **Export CSV** as now. `Share summary` comes in V16.

Each card hides itself when it has nothing to show (no services, no clients), except Summary. Money right-aligned
with tabular figures. New words in English and Vietnamese, from spec section 6 where it has them.

## Tests

- Browser (`tests/e2e/reports.spec.ts`, clock fixed with an explicit offset, turns seeded or logged):
  - Month, October 2026 with September data: earned and `▲ $310 (8%)` from spec 5.4's example amounts.
  - Previous month at $0: the change shows dollars only, no percent and no `Infinity` or `NaN` anywhere on the page.
  - A turn with three services: By service shows three lines, the turns count is 1.
  - Tapping a trend bar shows its numbers; `Open` moves the picker.
  - Records hidden with 3 weeks of data, shown with 5.
- `tests/e2e/earnings.spec.ts` becomes part of `reports.spec.ts` or stays, changed only in how it finds things (the
  tab name, the `Details` toggle), never in what it checks. The Earnings checks restored in V06 must still run.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
