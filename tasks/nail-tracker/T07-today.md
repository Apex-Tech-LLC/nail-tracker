# T07: Today dashboard

- **Branch:** `task/T07-today`
- **Milestone:** M2 Core tracking
- **Depends on:** T06
- **Size:** about 45 minutes

## Goal

The first screen shows today's numbers and recent turns, updates the moment a turn is saved, rolls over at midnight, and can look at another day.

## Steps

### 1. `src/app/useToday.ts`

```ts
import { useEffect, useState } from 'react'
import { addDays, localDateTimeToMs, todayIso, type IsoDate } from '../domain/dates.ts'

/** Today's date. Changes at local midnight and when the app comes back from the background. */
export function useToday(): IsoDate {
  const [today, setToday] = useState(() => todayIso())

  useEffect(() => {
    const refresh = () => setToday(todayIso())
    const timer = setTimeout(refresh, localDateTimeToMs(addDays(today, 1), '00:00') - Date.now() + 1000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [today])

  return today
}
```

### 2. Replace `src/features/today/TodayPage.tsx`

State: `const today = useToday()` and `const [picked, setPicked] = useState<IsoDate | null>(null)`. The day shown is `picked ?? today`.

Load with `useLiveQuery(() => loadRange(db, day, day), [day])`. While it is `undefined`, return `null`. This is what makes the screen update instantly: `useLiveQuery` re-runs when the tables change.

Work out `const totals = sumTotals(data.turns, data.adjustments)`.

Page, top to bottom:

1. `PageHeader` with title `t(locale,'appName')`.
2. **Date line:** a `<p>`: if the day is today, `t(locale,'todayLabel')` + ` — ` + `formatDayLong(day, locale)`. Otherwise just `formatDayLong(day, locale)`. Example: `TODAY — Wednesday, November 4`.
3. **Other day control**, one row:
   - `<input type="date">` with `aria-label={t(locale,'viewAnotherDay')}`, `max={today}`, value is `day`, `field` class. On change, if `isIsoDate(value)` then `setPicked(value === today ? null : value)`.
   - When `picked` is set, a button `t(locale,'backToTodayShort')` that does `setPicked(null)`.
4. **Headline card** (`card`, `bg-brand-50`):
   - `<p className="text-sm text-text-secondary">`: `t(locale,'turns')`, then below it `<p className="text-3xl font-semibold">`: `{totals.turns}`. The label sits above the number so there is no "1 Turns" problem.
   - `<p className="text-xl">`: `formatUsd(totals.serviceRevenueCents)` then `t(locale,'serviceRevenue')`.
5. **Figures card** (`card`): rows, label on the left and amount on the right (`flex justify-between`):
   - `customers`, shown as a plain number
   - `commission`, `cashTips`, `cardTips`
   - `adjustments`, only if it is not 0
   - last row in bold, `text-xl`, `text-positive-text`: `totalEarned`, `formatUsd(totals.earnedCents)`
6. **Add button:** `<Link href={paths.add}>` with `primaryButton block text-center` and a plus icon: `t(locale,'addTurn')`. If there are no turns on the day, the words are `t(locale,'addFirstTurn')` and an empty state sits above it: `noTurnsTitle` in `font-medium`, `noTurnsHint` in `text-sm text-text-secondary`.

   **Careful:** `tests/e2e/helpers.ts` waits for a link named `Add Turn`. Change that helper's last line to:
   ```ts
   await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
   ```
7. **Recent turns** (only when there are any): `<h2>` `t(locale,'recentTurns')`, then a list of the newest 10 by `occurredAt`, biggest first.

### 3. `src/features/turns/TurnRow.tsx`

Shared with History in T10. Export `TurnRow({ turn, services, number }: { turn: Turn; services: TurnService[]; number: number | null })`.

Renders as `<Link href={paths.edit(turn.id)}>` holding, in a `card`:
- Left: `tf(locale,'turnNumber',{ n: number })`, or `t(locale,'noTurnNumber')` if `number` is null.
- Then the first service name, and `tf(locale,'moreServices',{ n: services.length - 1 })` if there is more than one.
- Then `formatUsd(turn.serviceRevenueTotalCents)`.
- If tips are above 0: `tf(locale,'tipShort',{ amount: formatUsd(turn.cashTipCents + turn.cardTipCents) })`.
- Right: `formatUsd(turn.earnedTotalCents)` in `font-medium`.

Turn numbers come from `const numbers = numberTurns(data.turns)`, worked out on the **whole day**, not just the 10 shown. Pass `numbers.get(turn.id) ?? null` as `number`. Get each turn's services from `servicesByTurn(data.services)`, passing `grouped.get(turn.id) ?? []`.

The `/edit/:id` route does not exist until T09, so a tap shows "not found" for now. That is fine.

### 4. Tests

Create `tests/e2e/today.spec.ts`, `seedSettings(page)` first:

| Test | Steps | Expected |
|---|---|---|
| Empty | Open `./` | Shows `No turns yet` and link `Add your first turn`. Shows `$0.00` |
| Spec example | `addTurn(page, { amount: '100', cash: '10', card: '15' })` | `page.getByText('$100.00').first()`, and the same for `$60.00`, `$10.00`, `$15.00`, `$85.00`, are all visible. `Turn #1` is visible |
| Two turns | Add `40`, then `50` with service Pedicure | Shows `Turn #2`, and total `$54.00` (24 + 30) |
| Survives reload | Add one, `page.reload()` | `Turn #1` still shows |
| Another day | Add one. Then fill the date input (`getByLabel('View another day')`) with yesterday | Shows `No turns yet` and a `Go to today` button. Press it and `Turn #1` is back |
| Midnight | Before `goto`: `await page.clock.install({ time: new Date('2026-11-04T23:59:30') })`. Open `./`, add a turn. `await page.clock.runFor('01:00')` then wait | Date line shows `Thursday, November 5` and `$0.00` |

For "yesterday" in the test, build it with: `const d = new Date(); d.setDate(d.getDate() - 1); const iso = d.toLocaleDateString('en-CA')`. `en-CA` gives `YYYY-MM-DD`. The browser's timezone is America/Chicago, so to be safe set a fixed time with `page.clock.setFixedTime(new Date('2026-11-04T12:00:00'))` before `goto` and use the literal `'2026-11-03'`.

If `page.clock` makes the midnight test hang because of the database, use `setFixedTime` for adding the turn, and instead test `useToday` by firing `document.dispatchEvent(new Event('visibilitychange'))` after moving the fixed time forward. Say which you used in your report.

## Files

Create `src/app/useToday.ts`, `src/features/turns/TurnRow.tsx`, `tests/e2e/today.spec.ts`. Replace `src/features/today/TodayPage.tsx`. Edit `tests/e2e/helpers.ts`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/today.spec.ts tests/e2e/add-turn.spec.ts --workers=2` passes.

## Not in this task

Editing (T09), History (T10).
