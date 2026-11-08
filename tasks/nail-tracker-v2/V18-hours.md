# V18: Hours and pay per hour

**Branch:** `task/V18-hours`
**Read:** spec sections 5.1 (item 5), 5.3, 5.4, 5.7, 7.7 and 12; `src/app/settings.ts`;
`src/features/history/workDays.ts` and `HistoryPage.tsx` (V14: `WorkDay` already has `startTime` and `endTime`);
`src/features/home/HomePage.tsx`; `src/features/reports/` (V13); `src/features/settings/SettingsPage.tsx`.
**Goal:** a technician who wants it can tap `Start day` and `End day` and see what they really make an hour. Off by
default; when off, nothing about hours shows anywhere.

## 1. Settings

Add `hoursOn: boolean` (default false) and `minimumWageCents: number | null` (default null) to `Settings`, with safe
defaults in `resolveSettings`. A Settings section `Hours` (`Giờ làm`), after Goals when that exists: a switch `Track
my hours` (`Theo dõi giờ làm`) and, when on, an optional money box `Minimum wage where I work` (`Lương tối thiểu nơi
tôi làm`) with one line: `Type your state or city minimum. The app does not look it up.`

## 2. The maths (`src/domain/hours.ts`, plain TypeScript)

- `workMinutes(start: string, end: string): number`: 'HH:MM' times; an end earlier than the start means the next
  day (9:00 PM to 1:30 AM is 270 minutes).
- `suggestHours(firstTurnAt, lastTurnAt, timeZone)`: first turn minus 20 minutes rounded down to the quarter-hour, last
  turn plus 20 minutes rounded up. 10:05 and 6:40 PM give 9:45 and 7:00 PM.
- `perHourCents(cents, minutes): number | null`: cents per hour rounded half up, null when minutes is 0.
- Pay per hour, from spec 7.7, using the period's numbers as Reports shows them: with tips = earned ÷ hours; salon
  pay without tips = (earned − all tips) ÷ hours. 8 hours, $240 earned with $40 tips: $30.00 and $25.00.
- Minutes are summed over the days that have both times; days without times are left out of both the hours and the
  money for per hour, so a forgotten day does not drag the number down.

## 3. Home

When hours are on, in Today mode: `Start day` (`Bắt đầu`) records now as today's start; then `End day` (`Kết thúc`)
records the end; after that today's hours show (`6 h 15 min`, `6 giờ 15 phút`) with a small `Edit`. The work day is
the same work day turns use (after midnight still counts for the day before, as version 1).

## 4. History

In the List view on one day, when hours are on: a row `Hours 9:45 AM – 7:00 PM · 9 h 15 min` or `Add hours`, opening
a small sheet with two time boxes (`Start`, `End`) and `Save` / `Clear`. When a day has turns and no hours, the sheet
opens with the suggestion filled in and a line `First turn 10:05, last turn 6:40. Use 9:45 to 7:00?`; nothing is
saved until `Save`. Each day's heading row shows hours when there are any. Times are kept in `workDays`
(`setDayOff` must keep them, as it already does).

## 5. Reports

When hours are on: the Summary card adds `Hours` (`Giờ làm`) with its change like the other numbers; a `Per hour`
card (`Mỗi giờ`) shows `With tips $30.00` and `Salon pay, without tips $25.00`, and is hidden when the period has
no hours. In Week mode with a minimum wage set and salon pay per hour below it, the card shows a calm note: `Your
salon pay this week was $9.80 an hour, below the $16.50 you entered. You can ask your state labor office about
this.` Never say the salon broke the law.

## Tests

- Unit (`tests/unit/hours.test.ts`): crossing midnight; the suggestion example; rounding at exact quarter-hours;
  the $30.00 and $25.00 example; zero minutes gives null.
- Browser (`tests/e2e/hours.spec.ts`, clock fixed with an explicit offset): with hours off no hours control shows on
  Home, History, Reports or Settings' summary; turn on, Start day and End day on Home, then Reports shows per hour;
  add hours from History using the suggestion; the minimum wage note shows for a low week; hours survive a reload and
  a backup round-trip.
- Existing tests change only in how they find things.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
