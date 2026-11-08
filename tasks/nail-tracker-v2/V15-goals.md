# V15: Goals

**Branch:** `task/V15-goals`
**Read:** spec sections 5.1, 5.6 and 8; `src/app/settings.ts`; `src/features/home/HomePage.tsx`;
`src/features/reports/` (V13: the trend chart's goal prop); `src/features/settings/SettingsPage.tsx`.
**Goal:** a technician sets "$1,000 a week" once and sees, every time they open the app, how close they are, with no
pressure: no streaks, no badges, no red.

## 1. Settings

Add to `Settings` (safe defaults in `resolveSettings`, kept by backup and restore as settings already are):
`weeklyGoalCents: number | null` and `monthlyGoalCents: number | null`, both default null. Goals live in settings, not
in a new table: one current goal of each kind is all the screens need (this replaces the spec 9.1 Goal record).

## 2. Setting a goal

A `Goals` sheet (`Mục tiêu`) with two money boxes, `Weekly goal` and `Monthly goal` (`Mục tiêu tuần`, `Mục tiêu
tháng`), each optional (empty = no goal), using the number pad (V04) like other money boxes, and `Save`. It opens from:
- Settings: a `Goals` row under `How I'm paid`, with the summary `$1,000 a week · $4,000 a month` or `Not set`.
- Home: tapping the goal bar, or `Set a goal` (a quiet text link) in Week or Month mode when that goal is not set.

## 3. Home progress

In Week mode with a weekly goal, and in Month mode with a monthly goal, a slim progress bar under the hero number:
`$640 of $1,000 · $360 to go` (`$640 / $1.000 · còn $360`), filled to the share earned (capped at 100%). Today mode
shows no bar. When earned reaches the goal: the bar is full, the line reads `$1,120 of $1,000`, and once per week (or
month) a message under it: `You hit your goal for this week.` / `... this month.` (`Bạn đã đạt mục tiêu tuần này.`)
with an `×`. The message's key (`goal:week:2026-11-01`, `goal:month:2026-11-01`: kind plus the period start) is
stored in `dismissedReminders` the first time it is shown, so it does not come back that week after Home is left.
This message is part of the goal bar, not the reminder card, so it never competes with backup or paycheck reminders.

## 4. Reports goal line

Pass the goal to the trend chart: Week mode draws the weekly goal, Month mode the monthly goal, as a thin dashed line
across the bars with a small `Goal $1,000` label; other modes draw none. A bar over the goal looks the same as others.

## Tests

- Unit: the progress maths (`goalProgress(earnedCents, goalCents)` in `src/domain/goals.ts` gives the to-go amount,
  never below 0, and the fill percent capped at 100).
- Browser (`tests/e2e/goals.spec.ts`, clock fixed with an explicit offset):
  - A weekly goal of $1,000 and $640 earned this week: Home shows `$640 of $1,000 · $360 to go`.
  - Logging a turn that passes the goal shows the message; leaving Home and coming back, it is gone; the bar stays full.
  - Reports in Week mode shows the goal line label; the goal survives a reload and a backup round-trip.
- Existing Home tests change only in how they find things.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
