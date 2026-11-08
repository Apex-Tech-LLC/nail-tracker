# V14: History calendar, filters and day off

**Branch:** `task/V14-history-calendar`
**Read:** spec sections 5.3, 9.1 (WorkDay) and 12; `src/features/history/*`; `src/db/schema.ts` (version 2, from
V08: copy its pattern); `src/features/backup/backupFormat.ts`, `migrateBackup.ts`, `importJson.ts`, `exportJson.ts`,
`DeleteAllSection.tsx`; `src/features/home/HomePage.tsx` (the week bottles open `/history?day=`).
**Goal:** a technician sees their month at a glance, finds just their request clients or just card tips, and marks
the days they took off.

## 1. WorkDay record and data upgrade

```ts
export interface WorkDay {
  date: IsoDate           // primary key: one record per work day
  dayOff: boolean
  startTime: string | null // 'HH:MM', V18 (hours) fills these; always null in this task
  endTime: string | null
  createdAt: number
  updatedAt: number
}
```

`db.version(3)` adds `workDays: 'date'` (no upgrade step needed: no record means a normal day). Backup format version
3 carries `workDays`; `MIGRATIONS[2]` adds an empty list. Import validates the records; delete all data clears the
table (the browser delete-all check counts 11 tables). Do not change versions 1 or 2.

## 2. Calendar view

A `List` / `Calendar` switch at the top of History (`Danh sách` / `Lịch`), remembered for the session. Calendar shows
one month (arrows for the month before and after, the month name between them), weeks starting on the week start day.
Each worked day's cell shows its earned total in short dollars (`$310`); the cell's background is darker for bigger
days, in four steps of the brand colour by share of the month's best day (no colour for $0). Today is outlined. A day
off shows a small `Off` (`Nghỉ`) mark. Tapping a day opens the List view on that day (the same as `/history?day=`).
In the List view, each day's heading row shows turns and earned for that day.

## 3. Mark a day off

In the List view on one day, and from a long-press (or a small menu button) on a calendar cell: `Mark as day off` /
`Not a day off`. A day with turns can still be marked off (a sick day after one client); it shows both. Day off is
stored in `workDays` and used later by guarantee pay (V19) and by averages.

## 4. Filters

A `Filter` button (`Lọc`) opens a small sheet with chips; any combination:
- Service: one or more service names from the range's turns.
- Client: `Request`, `Walk-in`.
- Tips: `Cash tip`, `Card tip`, `No tip`.
- `Has a note`.
Active filters show as chips under the search box with an `×` each, and a `Clear` button. The totals line for the
range (and each day's heading) counts only the shown turns; turn numbers keep counting every turn, as the search does
now. Adjustments are hidden while any filter is on, as with search.

## Tests

- Browser (`tests/e2e/history-calendar.spec.ts`, clock fixed with an explicit offset):
  - November 2026 with three worked days: each cell shows its earned total; tapping one opens that day's list.
  - Mark a day off from the list: the calendar shows `Off`; it survives a reload; a backup round-trip keeps it.
  - Filter `Request`: only request turns are listed and the totals are just theirs; `Clear` brings all back.
- Unit: the colour step function; `MIGRATIONS[2]`; a version 2 database opens as version 3 (fake-indexeddb, as the
  existing database tests do).
- Existing History tests change only in how they find things.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
