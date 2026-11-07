# V09: "How I'm paid" settings page

**Branch:** `task/V09-how-im-paid`
**Read:** spec sections 5.10 (item 2), 6 (words), 7.1 to 7.3; `src/domain/payRules.ts` and `src/domain/statement.ts`
(V08); `src/features/settings/SettingsPage.tsx`, `TipHandlingFields.tsx`; the mockup's form styles.
**Goal:** a technician paid 60/40 with a 50/50 check/cash split, a $2 supply fee and a 3% card-tip fee sets that up in
under two minutes, and every rule shows what it means in plain words.

## 1. The page (`/settings/pay`, `src/features/payRules/PayRulesPage.tsx`)

Settings gets a row `How I'm paid` (`Cách tính lương`) near the top, under Language, with a one-line summary of the
current rules (for example `60% · $2 supply fee · 3% card-tip fee · 50/50 check/cash`). Move the commission rate and the
per-service-rates switch from Settings onto this page (they still live in Settings data; only the controls move), and
keep Settings working for anything that read them there.

Sections on the page, each with one plain example line that updates as the technician types, worked out by the V08
functions on a sample $100 service with a $10 card tip, so the example can never disagree with the statement:

1. **Your commission:** the rate (as now) and the per-service switch.
2. **Supply fee** (`Tiền đồ nghề`): `None` / `Per service` (dollar amount) / `Percent of sales`, then `Taken before the
   split` / `Taken from your share`. Example: `A $100 service: the salon keeps $2, you get 60% of $98 = $58.80.`
3. **Card-tip fee** (`Phí tip thẻ`): percent, 0 for none, with the one-line note from spec 7.2 step 5 about the real
   card fee (about 3%) and California.
4. **Check and cash** (`Check` / `Tiền mặt`): `No split` / `50/50` / `Custom` (percent by check), then card tips paid in
   `Check` / `Cash` / `Split like the rest`. Example: `$1,834 owed: $917 by check, $917 cash.`

Use the app's number pad (V04) for the money and percent boxes where the existing form patterns allow it; otherwise the
decimal keyboard.

## 2. Rules by date

`Save` asks `When did this start?` with `Today` (default), `Start of this pay period`, and `Other day` (a date input).
Saving adds a new `PayRules` record with that start date; it never edits an older record, so past pay periods keep
their numbers (spec 7.1). If a record already starts on that same date, it is replaced. Below the form, `Earlier pay
rules` lists past records with their start date and summary, newest first; tapping one shows it read-only with a
`Delete` button (not for the only record).

The commission rate stays on each saved service as now: changing it here affects new turns only, as today.

## 3. Words

Every new word in English and Vietnamese, using section 6. Run the existing i18n completeness test.

## Tests

- Browser (`tests/e2e/pay-rules.spec.ts`): set 60%, $2 per service before the split, 3% card-tip fee, 50/50; the
  examples read `$58.80` and `$917 by check, $917 cash` at the right places; reload and the values are kept; the
  Settings row summary shows all four rules.
- A rule saved with `Other day` = 2026-11-04 shows in `Earlier pay rules` order correctly after a later change, and
  the database holds two records.
- Existing Settings tests that changed the commission rate keep passing (update how they reach the field only).

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
