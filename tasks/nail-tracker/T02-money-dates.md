# T02: Money and date helpers

- **Branch:** `task/T02-money-dates`
- **Milestone:** M1 Foundation
- **Depends on:** T01
- **Size:** about 45 minutes

## Goal

Create `src/domain/money.ts` and `src/domain/dates.ts`. Both are plain TypeScript with no React and no database. Ready-made tests already say exactly how they must behave.

## Steps

1. Copy the ready-made tests into place:
   ```
   cp tasks/nail-tracker/reference/unit/money.test.ts tests/unit/money.test.ts
   cp tasks/nail-tracker/reference/unit/dates.test.ts tests/unit/dates.test.ts
   ```
   This overwrites the old `tests/unit/money.test.ts` on purpose. The old `src/lib/money.ts` stays for now (T04 deletes it). Do not edit these tests.

2. Create `src/domain/money.ts` exporting:

   | Name | What it does |
   |---|---|
   | `MAX_CENTS` | `99_999_999` |
   | `parseCents(input: string): number \| null` | Text to cents. Allows spaces around, one leading `$`, commas, up to 2 decimals, a leading or trailing dot. Null for anything else, for negatives, and above `MAX_CENTS` |
   | `parseSignedCents(input: string): number \| null` | Same, and allows one leading `-` or `−` before the `$` |
   | `formatUsd(cents: number): string` | `$1,234.56`, negative as `-$5.00`. Same in both languages |
   | `centsToInput(cents: number): string` | `45.50`, `-25.50`. No `$`, no commas. For filling an input |
   | `roundDiv(n: number, d: number): number` | Whole-number divide, halves away from zero. `d` is always above 0 |
   | `parseRateBp(input: string): number \| null` | Percent text to basis points. Allows a trailing `%` with optional space, up to 2 decimals. Null above 100 or for negatives |
   | `formatRate(bp: number): string` | `62.5%` |
   | `rateToInput(bp: number): string` | `62.5` |

   Rules that matter:
   - **Never use `parseFloat`, `Number('19.99') * 100`, or `toFixed`.** Those lose cents. Split the text on the dot and work with the two whole-number parts: `Number(whole) * 100 + Number(fraction.padEnd(2, '0'))`.
   - Check the text with a regular expression first: `/^\d*\.?\d{0,2}$/` and it must hold at least one digit. Remove commas and spaces before that check.
   - `roundDiv`:
     ```ts
     export function roundDiv(n: number, d: number): number {
       const rounded = Math.floor((Math.abs(n) * 2 + d) / (2 * d))
       return n < 0 ? -rounded : rounded
     }
     ```
   - For `formatUsd`, use `new Intl.NumberFormat('en-US').format(wholeDollars)` for the commas, and build the cents part with `String(abs % 100).padStart(2, '0')`.
   - `parseRateBp` can reuse the same digit logic as `parseCents`: "62.5" as cents is 6250, which is also the basis points.

3. Create `src/domain/dates.ts` exporting:

   | Name | What it does |
   |---|---|
   | `type IsoDate = string` | `'2026-11-04'` |
   | `type DateLocale = 'en' \| 'vi'` | Declared here so this file imports nothing from the app |
   | `parseIsoDate(iso): { year, month, day }` | Throws `Error` for bad format or a date that does not exist |
   | `isIsoDate(value: unknown): value is IsoDate` | True or false, never throws |
   | `todayIso(now: Date = new Date()): IsoDate` | Local calendar day, using `getFullYear`, `getMonth`, `getDate` |
   | `addDays(iso, days): IsoDate` | |
   | `diffDays(a, b): number` | `a` minus `b` in whole days |
   | `dayOfWeek(iso): number` | 0 is Sunday |
   | `weekRange(iso, weekStart: 0 \| 1): { start, end }` | |
   | `monthRange(iso): { start, end }` | |
   | `yearRange(iso): { start, end }` | |
   | `formatDayLong(iso, locale)` | `Wednesday, November 4` / `Thứ Tư, 4 tháng 11` |
   | `formatDayShort(iso, locale)` | `Nov 4` / `4 thg 11` |
   | `formatMonthYear(iso, locale)` | `November 2026` / `tháng 11 năm 2026` |
   | `formatRange(start, end, locale)` | `Nov 1 – Nov 7` with an en dash and spaces. One day alone if `start === end` |
   | `localDateTimeToMs(iso, 'HH:mm'): number` | Local time to a timestamp, using `new Date(year, month - 1, day, h, m).getTime()` |
   | `timeOf(ms): string` | Local `HH:mm`, zero padded |

   Rules that matter:
   - **All day maths uses `Date.UTC`,** so clock changes cannot shift a date:
     ```ts
     const d = new Date(Date.UTC(year, month - 1, day + days))
     ```
     then read it back with `getUTCFullYear`, `getUTCMonth`, `getUTCDate`.
   - `diffDays` must use `Math.round((utcA - utcB) / 86400000)`.
   - Last day of a month: `new Date(Date.UTC(year, month, 0)).getUTCDate()`.
   - Formatters use `new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { ...options, timeZone: 'UTC' }).format(new Date(utcMs))`. The `timeZone: 'UTC'` matters: without it the day can slip by one.
     - long: `{ weekday: 'long', month: 'long', day: 'numeric' }`
     - short: `{ month: 'short', day: 'numeric' }`
     - month and year: `{ month: 'long', year: 'numeric' }`
   - `parseIsoDate` can be copied from `src/lib/jalali.ts`. Read that file to see it.

4. Run `pnpm exec vitest run tests/unit/money.test.ts tests/unit/dates.test.ts --maxWorkers=2`. Fix your code until both files pass.

## Files

Create `src/domain/money.ts`, `src/domain/dates.ts`. Replace `tests/unit/money.test.ts`. Create `tests/unit/dates.test.ts`.

## Done when

- `pnpm exec vitest run tests/unit/money.test.ts tests/unit/dates.test.ts --maxWorkers=2` passes with no skipped tests.
- `pnpm gate` passes.
- `git grep -n "react\|dexie" -- src/domain` prints nothing.

## Not in this task

Using these helpers on any screen. Deleting `src/lib/money.ts` or `src/lib/jalali.ts`.
