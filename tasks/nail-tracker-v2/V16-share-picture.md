# V16: Share as a picture

**Branch:** `task/V16-share-picture`
**Read:** spec sections 5.5 (part 3), 5.9, 9.5; `src/features/backup/backupFormat.ts` (`shareOrDownload`) and
`saveBackup.ts`; `src/features/paycheck/` (V10 and V11: the statement and what was received);
`src/features/reports/` (V13); `src/features/taxes/` (V17); `src/lib/i18n.ts`.
**Goal:** the technician taps `Share statement` and gets a picture they can text to the owner, readable in Vietnamese
and English, made on the phone with nothing sent anywhere.

## 1. Drawing (`src/features/share/`)

No new packages. Draw on a canvas with the 2D API (system fonts, which have the Vietnamese letters), at 1080 pixels
wide and as tall as the content, in the app's light colours, then `canvas.toBlob('image/png')` and hand a `File` to
`shareOrDownload`. Keep the layout in one small helper that takes a title, a list of lines (label in both languages,
amount right-aligned) and optional sections, so the three pictures below share it. Money uses the app's money
formatting; nothing is rounded differently from the screen.

## 2. Three pictures

- **Paycheck statement** (Paycheck, button `Share statement` / `Chia sẻ bảng lương`): the pay period and days
  worked, every statement line shown on screen, each with the Vietnamese label on top and the English one under it,
  then what was received (check, cash, other) and the result (`Matches` / `Short $40` / `Over $12`) when recorded.
  At the bottom, small: `Made with Nail Tracker on my phone`.
- **Report summary** (Reports, `Share summary` / `Chia sẻ tóm tắt`, next to Export CSV): the period, the Summary
  numbers with their changes, the trend bars (drawn simply, current bar in the brand colour) and the top 8 services.
  The technician's own language only.
- **Year summary** (Taxes page, `Share` next to Print): the year totals and tips, in English with the Vietnamese term
  beside each, as the CSV.

File names follow `backupFileName`'s pattern: `nail-tracker-statement-2026-11-07.png`, `...-report-...`,
`...-year-2026.png`. A cancelled share does nothing; a failed share falls back to download as backups do.

## Tests

- Unit: the line layout helper (heights grow with lines; long labels wrap rather than run under the amount).
- Browser (`tests/e2e/share.spec.ts`, clock fixed with an explicit offset): replace `navigator.share` and
  `navigator.canShare` with stubs that keep the files; tap each share button and check a PNG `File` with the right
  name was handed over and is larger than a few kilobytes; record every request with `page.on('request')` and check
  none leaves the app's own origin (blob and data addresses are fine); without `navigator.share`, a download happens.
- Existing tests change only in how they find things.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
