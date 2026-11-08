# V20: Speed with five years of data, and every screen in Vietnamese at 375 pixels

**Branch:** `task/V20-speed-vietnamese`
**Read:** spec sections 9.3, 12 and 13; `src/features/home/`, `src/features/reports/`, `src/features/history/`,
`src/features/paycheck/` and `src/features/payday/periodStore.ts` (their data loaders); `src/db/schema.ts` (the
indexes); `playwright.config.ts`.
**Goal:** a technician with five years of turns opens the app and the numbers are there at once, and no Vietnamese
word is cut off or pushed off the screen on a small phone.

## 1. Speed

- A browser test helper fills the database with 20,000 turns over five years (about 11 a day, one to three services
  each, mixed tips, some adjustments and payments) using Dexie bulk adds inside the page, in one go.
- Each data loader marks its time with `performance.mark` / `performance.measure` named `load:home`,
  `load:reports`, `load:history`, `load:paycheck`, from the start of its database reads to the numbers being set.
- `tests/e2e/speed.spec.ts`: with the 20,000 turns, reload and open Home, Reports (Month and Year), History (one
  month, List and Calendar) and Paycheck, read the measures, print them, and fail when any is over 1,000 ms (desktop
  Chrome on GitHub; the spec's 300 ms phone target is checked by hand from the printed numbers). Mark the file
  `test.describe.configure({ mode: 'serial' })` so its tests never run beside each other.
- Fix what is slow, keeping results identical: read with the `localWorkDate` index and `between`, never `toArray()`
  on a whole table except where V13 says (Records), load related service lines with `anyOf` on the turn ids, and
  avoid working out the same totals twice. If Records with 20,000 turns is the slow part, compute it from a single
  pass over `turns` and `turnServices` without sorting the whole table. Write in the final report the before and
  after numbers.

## 2. Vietnamese at 375 pixels

`tests/e2e/vietnamese-375.spec.ts`: with Vietnamese chosen, a 375 × 812 viewport and seeded data that turns on every
optional part (pay rules with fees, split, guarantee and tiers; a goal; hours; set-aside), visit every screen and
sheet: Home in all three modes, Add turn (with the number pad), History List and Calendar and the filter sheet,
Reports in every mode, Paycheck with a recorded payment and the check result, How I'm paid, Goals, Taxes, Settings,
Services, and onboarding. On each:
- no horizontal scroll (`document.documentElement.scrollWidth <= 375`);
- no text cut off: no element with visible text whose `scrollWidth` is larger than its `clientWidth` while its
  overflow is hidden, and no text with `text-overflow: ellipsis` that is actually truncated, except the named places
  that are meant to truncate (long client notes, long service names in lists: list them in the test);
- a full-page screenshot saved under `test-results/vi-375/` for a person to look at.
Fix every failure in the CSS (wrapping, smaller gaps, two lines), never by shortening the Vietnamese.

Then list every i18n key added in version 2 with its English and Vietnamese words in the final report, so a
Vietnamese speaker can check them in one read.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
