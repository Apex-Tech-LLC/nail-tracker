# V17: Taxes and year summary

**Branch:** `task/V17-taxes`
**Read:** spec sections 5.8, 5.10, 6 and 8; `src/domain/totals.ts`, `src/domain/reports.ts`, `src/domain/dates.ts`,
`src/domain/reminders.ts` and its tests; `Payment` in `src/db/schema.ts`; `src/features/reports/` (V13);
`src/features/backup/exportCsv.ts`, `backupFormat.ts` (`shareOrDownload`); `src/app/settings.ts`, `navigation.ts`;
`src/features/home/HomePage.tsx` (where reminders are shown); `src/domain/money.ts` (`parseRateBp`, `formatRate`,
`roundDiv`).
**Goal:** once a year (and each quarter for those paid on a 1099 form) the technician sees the year's totals and
tips, knows how much to have put aside, and hands their tax preparer one clear summary. Not tax advice.

## 1. Settings

Add `taxSetAsideBp: number | null` (default null: no default percent, as the spec says) with a safe default in
`resolveSettings`. The percent box uses `parseRateBp` and `formatRate` from `money.ts`, as the commission box does. A Settings row `Taxes` (`Thuế`) opening the page, with the summary `Set aside 20%` or `Not set`.

## 2. The page (`src/features/taxes/`, route `/taxes?year=2026`, `paths.taxes`)

Reached from Settings and from Reports in Year mode (a `Taxes and year summary` link under Summary). A year picker
with arrows. One line at the top: `This is a record to help with your taxes, not tax advice.`

1. **Year totals:** salon pay by check, by cash, by other payments (from `Payment` records dated in the year, by
   method; Zelle and direct deposit are "other"), tips in cash and by card, adjustments, and total earned (the same
   number Reports shows for that year).
2. **Tips for the year:** the total, large, with the note: `The federal tip deduction (2025 to 2028) counts tips on
   a tax form or reported by you. A daily record like this one helps.`
3. **Set aside for taxes:** a percent box (empty = off). When set: `Set aside so far this year: $8,000` (earned so
   far this year × percent) and the four estimated-tax quarters, each with its due date and that quarter's amount:
   Jan–Mar due Apr 15; Apr–May due Jun 15; Jun–Aug due Sep 15; Sep–Dec due Jan 15 of the next year (the US
   estimated-tax periods, which are not equal). A quarter not yet started shows `—`.
4. **Export for the tax preparer:** `Save CSV` and `Print` buttons. The CSV is in English with the Vietnamese term
   beside each English one, built from the app's existing English and Vietnamese words (`Card tips (Tip thẻ)`), one
   row per total, then one row per month with the columns month, earned, cash tips, card tips, check, cash, other
   payments, adjustments. Export and reuse `csvCell` and the byte-order mark from `exportCsv.ts` (Excel needs it to
   show Vietnamese); do not write new ones. `Print` calls
   `window.print()` with print styles that show only the summary (no tabs or buttons).

## 3. The maths (`src/domain/taxes.ts`, plain TypeScript)

`taxQuarters(year)` gives the four spans and due dates; `setAsideCents(earnedCents, bp)` rounds half up with
`roundDiv`; a year summary function takes the year's turn figures, dated adjustments and payments. Reuse `sumTotals` and `yearRange`;
do not copy them.

## 4. Reminder

Add the tax reminder from spec section 8 to `src/domain/reminders.ts`: when set-aside is on and a due date is 14 days
away or less (and not past), Home shows `Estimated tax is due Apr 15: about $2,100 for Jan–Mar.` with key
`tax:2027-04-15`. It comes after the backup and paycheck reminders in urgency.

- `DueReminderInput` gains what the rule needs: the set-aside percent and the earned cents of the quarter whose
  date is next (Home loads that quarter's span with the indexed date query; on January 1 to 15 that is September to
  December of the year before). The `Reminder` result gains optional `dueDate`, `quarter` (the span) and
  `amountCents` so Home can build the sentence.
- Home today picks the message by reminder id and falls through to the backup wording: add a tax branch with its
  own words and a `Taxes` button that opens the page.

## Tests

- Unit (`tests/unit/taxes.test.ts`, `tests/unit/reminders.test.ts`): $9,600 card and $7,200 cash tips give $16,800;
  20% of $40,000 is $8,000; the quarter spans and due dates (the fourth due in January of the next year); the
  reminder at 15, 14 and 0 days and after the date; on January 5 it names the January 15 date and last year's
  September to December amount.
- Browser (`tests/e2e/taxes.spec.ts`, clock fixed with an explicit offset): open from Reports Year mode; tips and
  totals match seeded data; set 20% and see the amounts; the CSV download has the English and Vietnamese terms; the
  percent survives a reload and a backup round-trip (a restore applies saved settings only into an empty app, so
  delete all data before restoring); the tax reminder shows on Home with its own words.
- Existing tests change only in how they find things.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
