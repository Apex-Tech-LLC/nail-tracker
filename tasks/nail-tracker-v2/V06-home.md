# V06: Home screen

**Branch:** `task/V06-home`
**Read:** spec sections 5.1 and 4.1; the Home phone in `docs/design/v2-mockup.html` (CSS `.hero`, `.delta`, `.seg`,
`.week`, `.bottle`, `.legend`, `.stats`, `.fab`); `src/features/today/TodayPage.tsx`; `src/domain/comparisons.ts`
(V05).
**Goal:** after logging turns, the technician opens the app and sees how they are doing today, this week and this
month, compared with last time, in one look.

## Screen (replaces `TodayPage`; keep the route `/`)

Rename the tab label `Today` to `Home` (`Trang chính`). Top to bottom:

1. **Top row:** today's long date on the left (15px, secondary), offline badge and language button on the right.
2. **Period switch** (mockup `.seg`): `Today`, `This week`, `This month` (`Hôm nay`, `Tuần này`, `Tháng này`).
   Starts on `Today`; the choice is kept in `sessionStorage` until the date changes. Real buttons with `aria-pressed`.
3. **Hero** (mockup `.hero`): the label `You earned today` / `You earned this week` / `You earned this month`, then the
   earned total for `currentSpan` as a 52px, 800-weight number, with the cents in 28px muted (`$1,284` + `.50`). Under
   it, the comparison pill from `compare` with `previousSpan`:
   - more: green pill `▲ $162 more than last Friday` (today), `than this time last week` (week),
     `than this time last month` (month);
   - less: neutral pill (surface-subtle background, secondary text) `▼ $60 less than ...`, never red: a slow day is
     not a failure;
   - same: `Same as ...`; nothingToCompare: `Nothing to compare yet`.
   Write the Vietnamese for each, with the weekday name for today.
4. **Week view** (mockup `.week`, the memorable piece): seven polish bottles for the current week, from `weekDays`.
   Each bottle: a 14px dark cap, a 30 × 100px rounded glass with a lacquer fill rising to `fillPercent`, a white
   highlight stripe, the amount above it in `formatUsdShort` (nothing for future days), the short weekday under it.
   Future days show last week's amount as a nude fill (`#ecd9d1`) with no highlight, so the week can be compared at a
   glance. Today's bottle has a lacquer outline and its weekday in lacquer. A legend under it: `This week` (lacquer) and
   `Last week` (nude). Tapping a bottle opens History on that day (for example `/history?day=2026-11-04`; make the
   History page read it).
   - Accessibility: the week is a list; each bottle is a link with an `aria-label` like `Wednesday, $301 earned`.
   - One 400ms rise of the fills on first render, skipped with reduced motion. No other animation.
5. **Stats strip** (mockup `.stats`, three cells): `Turns`, `Tips` and `Salon owes` for the chosen period. Salon owes
   uses the same number the Payday tab shows as still owed for the current pay period (reuse its code); when no pay
   period is set up, show the chosen period's `expectedPayoutCents`.
6. **Today's turns** heading with `9 turns · $333` on the right, then the V02 row list (latest first, up to 10), then
   `See all` linking to History. Empty state: one line, `Your turns today will show here.`
7. **Add turn** button floating above the bottom bar (mockup `.fab`), full width minus 18px margins, always visible;
   the list gets bottom padding so the last row is never hidden behind it. Remove `Repeat last turn` from Home: the Add
   turn screen shows `Same as last` (V03).

The date picker that let Today look at another day is removed; History does that job.

## Tests

- Rename `tests/e2e/today.spec.ts` to `home.spec.ts` and update it and any test that clicked the `Today` tab or relied
  on the removed date picker or Repeat button, without dropping what they check.
- New checks in `home.spec.ts`, with turns saved at fixed dates (use Playwright's clock:
  `page.clock.setFixedTime(new Date('2026-11-04T15:00:00-06:00'))` before the first `goto`):
  1. A $45 pedicure with a $10 cash tip at 60% moves today's hero from $0 to $37.
  2. This week with $640 so far against $498 last week up to the same weekday shows `▲ $142 more than this time last
     week`.
  3. No turns last week shows `Nothing to compare yet`.
  4. Seven bottles; Wednesday's reads `Wednesday, $... earned`; tapping it opens History on that day.
  5. The Add turn button is visible without scrolling at 390 × 844 and at 375 × 667.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
