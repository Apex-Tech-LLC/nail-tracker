# V07: Home reminders and one-tap backup

**Branch:** `task/V07-reminders-backup`
**Read:** spec sections 5.10 (item 10), 8 and 9.5; `src/features/home/HomePage.tsx`;
`src/features/backup/BackupSection.tsx`, `backupFormat.ts`; `src/app/settings.ts`.
**Goal:** a technician never forgets to back up, and saving a backup puts it somewhere safe in one tap (Google Drive,
iCloud, email, a text to themselves) instead of a file lost in Downloads.

## 1. Settings

Add to `Settings` (with safe defaults in `resolveSettings`, and kept by backup and restore as settings already are):
- `backupReminderDays: 7 | 14 | 30 | 0` (0 = off), default 14.
- `lastBackupDate: IsoDate | null`, default null.
- `dismissedReminders: Record<string, IsoDate>`: reminder id to the date it was dismissed, default `{}`.

## 2. Backup by share sheet

In `BackupSection`, `Save backup` builds the same JSON file as now, then:
- when `navigator.canShare?.({ files: [file] })` is true, calls `navigator.share({ files: [file], title })`;
- otherwise downloads it as now.
A share the user cancels (`AbortError`) is not an error and does not set the date. A finished share or download sets
`lastBackupDate` to today. Put the share-or-download choice in one small function in `backupFormat.ts`
(`shareOrDownload(file)`), returning `'shared' | 'downloaded' | 'cancelled'`, so the CSV buttons can use it too.

Under the buttons: `Last backup: Nov 4` (`Sao lưu lần cuối: 4 thg 11`) or `No backup yet` (`Chưa sao lưu`), and a
select `Remind me to back up`: `Every 7 days`, `Every 14 days`, `Every 30 days`, `Off`.

Nothing is uploaded by the app: the phone's own share sheet does it, as spec 9.5 says.

## 3. Reminders on Home

A new pure function in `src/domain/reminders.ts`:

```ts
export type ReminderId = 'backup' // later tasks add 'paycheck', 'goal', 'tax'
export interface Reminder { id: ReminderId; key: string } // key: the occurrence, e.g. 'backup:2026-11-04'
/** The most urgent reminder that is due and not dismissed for this occurrence, or null. */
export function dueReminder(input: {
  today: IsoDate
  hasTurns: boolean
  backupReminderDays: number
  lastBackupDate: IsoDate | null
  firstTurnDate: IsoDate | null
  dismissed: Record<string, IsoDate>
}): Reminder | null
```

Backup is due when reminders are on, there is at least one turn, and the days since `lastBackupDate` (or since the
first turn when there was never a backup) are at least `backupReminderDays`. Its key is `backup:` plus the date the
count started from, so dismissing it hides it until the next backup is overdue again. Write it so later reminders are
one more entry in a priority list, not a rewrite.

On Home, under the top row and above the period switch, show the due reminder as one calm card (surface background,
border, no red): `It's been 16 days since your last backup.` with a `Back up now` button that runs the same share or
download as Settings, and an `×` button (`aria-label` `Dismiss`) that stores the key in `dismissedReminders`. With no
backup ever: `You have no backup yet. Save one in case you lose your phone.`

## Tests

- Unit tests for `dueReminder`: off; no turns; 13 versus 14 days; never backed up counts from the first turn; a
  dismissed key stays hidden; a new occurrence shows again.
- Browser (`tests/e2e/reminders.spec.ts`, clock fixed with an explicit offset): with a turn saved 15 days ago and no
  backup, Home shows the backup card; `Back up now` downloads a file (Playwright has no share sheet, so the download
  path runs), the card goes away and Settings shows today as the last backup. Dismissing the card keeps it gone after
  a reload.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
