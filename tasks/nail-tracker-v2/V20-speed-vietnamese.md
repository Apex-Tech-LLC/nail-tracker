# V20: Speed with five years of data, and every screen in Vietnamese at 375 pixels

**Branch:** `task/V20-speed-vietnamese`
**Read:** `docs/product-spec-v2.md` sections 9.3, 12 and 13; the loaders: `src/features/turns/turnStore.ts`
(`loadRange`), `src/features/home/HomePage.tsx`, `src/features/reports/reportsData.ts` and `src/domain/reports.ts`
(Records), `src/features/history/HistoryPage.tsx` and `historyRange.ts`, `src/features/payday/PaydayPage.tsx` and
`periodStore.ts` (`loadPeriodSummaries`); `src/db/schema.ts` (the indexes); `src/app/settings.ts`,
`src/app/navigation.ts` (`paths`, the routes); `src/domain/payRules.ts`; `tests/e2e/helpers.ts` and
`tests/e2e/paycheck-check.spec.ts` (how tests write to the database); `playwright.config.ts`.
**Goal:** a technician with five years of turns opens the app and the numbers are there at once, and no Vietnamese
word is cut off or pushed off the screen on a small phone.

## 1. Speed

- **Seed** (a helper in `tests/e2e/`): open the app once so it creates the database, then write straight to
  IndexedDB the way `paycheck-check.spec.ts` does, in one transaction per table: 20,000 turns over five years (about
  11 a day, one to three service lines each, mixed cash and card tips), some adjustments, a payment most weeks, and
  settings with a weekly pay schedule whose anchor date is five years back, so about 260 pay periods exist and
  Paycheck really loads them. Give the speed tests a raised timeout (`test.setTimeout`), since seeding takes seconds.
- **Measures:** each screen marks the time from the start of its database reads to its numbers being set, with
  `performance.mark` / `performance.measure` named `load:home`, `load:reports`, `load:history`, `load:paycheck`. Put
  the marks at the screen's own call, not inside shared loaders: `loadPeriodSummaries` is also called by Home and the
  period page, so `load:paycheck` goes in `PaydayPage.tsx` only. A screen can load twice (pay periods are created on
  first open), so the test waits for the measure and reads the **last** entry of each name.
- **`tests/e2e/speed.spec.ts`:** with the seed, reload and open Home, Reports (Month and Year), History (Calendar for
  one month, and List with Custom dates for that month: List has no month option) and Paycheck; print the measures;
  fail when any is over 1,000 ms (desktop Chrome on GitHub; the spec's 300 ms phone target is checked by hand from
  the printed numbers). So nothing runs beside it, put it in its own Playwright project that depends on the main one
  (`dependencies`), with `retries: 0`, and leave the main project's test list unchanged otherwise.
- **Fix what is slow, keeping results identical.** Read with the date indexes and `between` (as `loadRange` does),
  load service lines with `anyOf` on turn ids, and do not work out the same totals twice. Known suspects:
  `loadPeriodSummaries` loads the turns of every pay period (about 260): load only what the screen shows, or one
  range read split in memory; the all-time balance in `reportsData.ts` reads whole tables, which only Records may
  do (V13). Records reads turns and adjustments only; keep it to one pass. Write the before and after numbers in the
  final report.

## 2. Vietnamese at 375 pixels

`tests/e2e/vietnamese-375.spec.ts`, Vietnamese chosen, a 375 × 812 viewport (set with `test.use`, as `a11y.spec.ts`
does). Seed so that every optional part shows:
- settings (saved in the browser, see `settings.ts`): a weekly and a monthly goal, `hoursOn` with a minimum wage, a
  tax set-aside percent, a weekly pay schedule;
- database: pay rules in the shape of `payRules.ts` with a supply fee, a split, a per-day guarantee and tiers (2 to
  5 levels, the first starting at 0); turns and a day off; work days with start and end times; a payment assigned to
  the current pay period so the check result shows.

Visit, by tapping or by the routes in `navigation.ts`: Home in Today, Week and Month (with Start day showing);
Add turn with the number pad open; History List and Calendar, the filter sheet, a day's sheet (day off, hours) and
the hours sheet; Reports in every mode (`/earnings`); Paycheck (`/payday`) with the check result, a past period's
page, Record what you got, a payment form, the adjustment form; How I'm paid (`/settings/pay`); Goals
(`/settings/goals`); Taxes (`/taxes/<year>`); Settings; Services (`/settings/services`); onboarding
(`/onboarding`, on a fresh app). On each:
- no horizontal scroll (`document.documentElement.scrollWidth <= 375`);
- no text cut off: no visible element with text whose `scrollWidth` is larger than its `clientWidth` while its
  overflow is hidden, and no truncated `text-overflow: ellipsis`. Skip screen-reader-only text (`.sr-only`). The only
  places allowed to truncate are what the technician typed: client notes, service names in lists and adjustment
  notes; list them in the test. Page titles are not allowed to truncate: `PeriodPage`, `PaymentForm`,
  `RecordWhatYouGotForm`, `PayRulesPage` and `GoalsPage` truncate theirs today; make them wrap;
- a full-page screenshot saved under `test-results/vi-375/` for a person to look at.
Fix every failure in the CSS (wrapping, smaller gaps, two lines), never by shortening the Vietnamese.

Then list every i18n key added in version 2 with its English and Vietnamese words in the final report, so a
Vietnamese speaker can check them in one read.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
