# V16: Share as a picture

**Branch:** `task/V16-share-picture`
**Read:** `docs/product-spec-v2.md` sections 5.5 (part 3), 5.9, 9.5; `src/features/backup/backupFormat.ts`
(`download`, `shareOrDownload`, `backupFileName`) and `saveBackup.ts`; `src/features/paycheck/StatementCard.tsx`,
`CheckPanel.tsx`, `paycheckStatus.ts` (`checkStatusLabel`); `src/features/payday/periodStore.ts` (`summary.received`,
`summary.check`), `PaydayPage.tsx`, `PeriodPage.tsx`; `src/features/reports/ReportsPage.tsx`, `TrendChart.tsx`;
`src/features/taxes/TaxesPage.tsx`, `taxCsv.ts` (V17); `src/lib/i18n.ts`; `src/index.css` (font and colours);
`vite.config.ts` (unit tests run in Node) and `playwright.config.ts`.
**Goal:** the technician taps `Share statement` and gets a picture they can text to the owner, readable in Vietnamese
and English, made on the phone with nothing sent anywhere.

## 0. Fix first

Today `shareOrDownload` falls back with `download(await file.text(), ...)`, which turns a PNG into broken text. Let
`download` take a `Blob` as well as a string and pass the file itself, so backups and CSVs work exactly as now (their
tests must still pass) and a picture downloads as a real PNG.

## 1. Drawing (`src/features/share/`)

No new packages. Draw on a canvas with the 2D API at 1080 pixels wide and as tall as the content, then
`canvas.toBlob('image/png')` and hand a `File` to `shareOrDownload`.
- Font: the app already ships Be Vietnam Pro with the Vietnamese letters (`index.css`). Before drawing, `await
  document.fonts.load(...)` for each weight used, then draw with `"Be Vietnam Pro", sans-serif`.
- Colours: the app's light colours. They exist only as CSS variables in `index.css`; read them with
  `getComputedStyle(document.documentElement)` (the current trend bar is `--brand-600`, as in `TrendChart.tsx`).
- Layout: one small pure helper that takes a title, a list of lines (labels, amount right-aligned) and optional
  sections, and a text-measuring function passed in (`(text, font) => width`), so it runs in a Node unit test with a
  fake measurer. It returns positions and the total height; a separate function paints them on the canvas. The three
  pictures share it.
- Money uses `formatUsd`; nothing is rounded differently from the screen.

## 2. Three pictures

- **Paycheck statement**: a `Share statement` / `Chia sẻ bảng lương` button in `CheckPanel` next to `Mark as
  checked`, so it shows on both the Paycheck page and a past period's page. It shows: the pay period and days worked,
  every statement line shown on screen, each with the Vietnamese label on top and the English one under it, then what
  was received (from `summary.received` in `periodStore.ts`: check, cash, other, using the existing `methodCheck`,
  `methodCash`, `methodOther`, `receivedSection` words) and the result from `checkStatusLabel` (`Short $40.00` etc.)
  when recorded. At the bottom, small: `Made with Nail Tracker on my phone` / `Làm bằng Nail Tracker trên điện thoại`.
  The statement labels are built inline in `StatementCard.tsx` from one language today: move that into one exported
  function that takes a locale and returns the lines, used by both the card and the picture (the card must look the
  same; its tests must still pass). Do not copy the labels.
- **Report summary** (Reports, `Share summary` / `Chia sẻ tóm tắt`, next to the export button): the period, the
  Summary numbers with their changes, the trend bars (drawn simply, current bar in the brand colour) and the top 8
  services. The technician's own language only. `rangeLabel`, `previousLabel`, `changeText` and `turnsAverage` in
  `ReportsPage.tsx` are private: export them (or move them to a small module) and reuse; do not copy.
- **Year summary** (Taxes page, `Share` / `Chia sẻ` next to Print): the year totals and tips, in English with the
  Vietnamese term beside each, exactly as the CSV. Export the `bilingual` helper and the row list from `taxCsv.ts`
  and reuse them.

File names: widen `backupFileName` so it covers `nail-tracker-statement-2026-11-07.png`,
`nail-tracker-report-2026-11-07.png`, and add one year-name helper beside it for `nail-tracker-year-2026.png`; move
the Taxes CSV name (`nail-tracker-taxes-2026.csv`, hand-built in `TaxesPage.tsx`) onto that helper too, keeping the
same name. No hand-built names. A cancelled share does nothing; a failed share falls back to download as backups do.
Add the new words to `i18n.ts` in both languages.

## Tests

- Unit (`tests/unit/shareLayout.test.ts`, fake measurer): heights grow with lines; a long label wraps rather than run
  under the amount; the statement-lines function gives the same lines the card shows, in both languages.
- Browser (`tests/e2e/share.spec.ts`, clock fixed with an explicit offset): with `page.addInitScript`, replace
  `navigator.share` and `navigator.canShare` with stubs that push each file's name, type and size onto a `window`
  array (a `File` cannot come back through `page.evaluate`); tap each of the three share buttons and check a
  `image/png` file with the right name and more than a few kilobytes was handed over. Record every request with
  `page.on('request')` and check none leaves the app's own origin (blob and data addresses are fine). For the
  download fallback, delete `navigator.share` in an init script (desktop Chromium may have it) and check a download
  with the PNG name happens.
- Existing tests change only in how they find things.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
