# V03: Fast Add turn, part 1: repeat chips, usual prices, tip buttons, saved bar

**Branch:** `task/V03-fast-add-picks`
**Read:** spec section 5.2 (item 0 and the tip buttons); the Add turn phone in `docs/design/v2-mockup.html` (CSS
classes `.again`, `.chips`, `.chip em`, `.tipq`); `src/features/turns/TurnForm.tsx` and `turnStore.ts`;
`src/ui/Toast.tsx` (made in V02).
**Goal:** a regular turn takes two or three taps: tap a repeat chip (or a service chip that already shows its price),
tap a tip button, Save.

## 1. Quick picks maths (`src/domain/quickPicks.ts`, plain TypeScript)

Input: the turns and their service lines from the last 30 days (work dates `today - 29` to `today`), as
`{ turn: { id, occurredAt }, lines: { key: string; name: string; priceCents: number }[] }[]`, where `key` is the
service preset id, or `name:<lower-cased name>` for lines with no preset.

Export:

- `serviceUse(entries)`: `Map<key, number>`, how many turns used each service key.
- `lastPrice(entries)`: `Map<key, number>`, the price on the most recent turn (by `occurredAt`) that used the key.
- `topCombos(entries, limit = 4)`: the most common whole-turn combinations. Two turns are the same combination when
  they have the same set of `(key, priceCents)` pairs, in any order. Sort by count (high first), then by the most
  recent use. Only combinations used at least twice. Each result: `{ lines: { key, name, priceCents }[]; count }`,
  lines in the order they were entered on the most recent turn.

Unit tests in `tests/unit/quickPicks.test.ts`: counts; last price follows the newest turn even when an older turn is
later in the array; `Gel + Art` and `Art + Gel` at the same prices are one combination; a combination used once is
left out; ties go to the more recent; the limit is respected.

## 2. Loading (`src/features/turns/turnStore.ts`)

`loadQuickPickEntries(db, today)` reads the last 30 days with the existing `loadRange` and returns the entries above.

## 3. Add turn changes (`TurnForm.tsx`)

Only on a new turn (`/add`), not on edit or copy:

1. **Repeat chips** at the top of the form, in one row that scrolls sideways (no wrapping), mockup `.again`:
   - first, `↻ Same as last: Gel Manicure $35` (the latest turn's first service name, ` +1` when it had more, and its
     service total in `formatUsdShort`). Tapping it replaces the screen with the copy screen of that turn
     (`navigate(paths.copy(id), { replace: true })`). Shown only when a turn exists.
   - then one chip per `topCombos` result: `↻ Gel Manicure + Nail Art $45` (names joined by ` + `, then the total).
     Tapping it replaces the form's service lines with those services and prices (using the same commission rate
     rules as tapping the chips by hand) and leaves tips, date and the rest alone.
   - Chips are `rounded-control bg-brand-50 text-brand-800 font-semibold text-[13px]`, at least 44px tall.
2. **Service chips sorted by use:** most used in the last 30 days first (`serviceUse`), then the preset's own order.
   `Other` stays last.
3. **Price on each chip:** after the name, in a lighter weight (mockup `.chip em`), the price the chip will fill in:
   the preset's usual price if it has one, otherwise the `lastPrice` for that preset, otherwise nothing. Tapping a chip
   with no usual price but a last price fills in the last price.
4. **Tip buttons**, one row under the two tip boxes: a small `Cash | Card` switch, then `$5`, `$10`, `$15`, `$20`,
   `18%`. Each is at least 44px tall. The switch says which box the buttons fill; it starts on Cash and remembers the
   last choice in settings (`tipButtonsTarget: 'cash' | 'card'`, default `'cash'`). Tapping `$10` sets that box to
   `10.00` (it replaces, it does not add). `18%` sets it to 18% of the services total, rounded half up to the cent
   with `roundDiv` from `money.ts` (services $60.00 gives 10.80). The tapped amount shows as selected (green, mockup
   `.tipq .on`) while the box holds exactly that amount.

On every screen (add, edit, copy):

5. **Saved bar:** after `Save` on a new or copied turn, the app goes where it goes today and shows the V02 toast:
   `Saved · you earn $27` (`formatUsdShort` of the turn's earned total) with two actions: `Undo` (deletes the new turn)
   and `Copy again` (opens the copy screen of the new turn). Editing an existing turn shows only `Saved`. `Save & add
   another` keeps its current inline message and shows no bar.

Every new word goes in `src/lib/i18n.ts` with Vietnamese: `Same as last` = `Giống lần trước`, `Saved` = `Đã lưu`,
`you earn` = `bạn được`, `Copy again` = `Sao chép lại`, `Undo` = `Hoàn tác`.

## 4. Browser tests (`tests/e2e/quick-picks.spec.ts`)

1. With two saved turns of `Gel Manicure $35 + Nail Art / Design $10`, the Add screen shows a repeat chip
   `Gel Manicure + Nail Art / Design $45`; tapping it fills both lines with those prices.
2. `Same as last` opens the copy screen of the latest turn.
3. A service used most in the last 30 days is the first chip.
4. A preset with no usual price, last logged at $35, shows `$35` on its chip and fills `35.00` when tapped.
5. Tip buttons: `$10` on Cash fills Cash tip with 10.00; switching to Card and tapping `18%` with services $60 fills
   Card tip with 10.80; the switch choice is still Card after reloading.
6. Saving shows `Saved · you earn`; `Undo` removes the turn from Today; `Copy again` opens a filled copy form.

Update existing tests only where they read chip text exactly (a chip's accessible name now includes its price). Prefer
giving the chip an `aria-label` of just the service name and the price as a separate `aria-describedby` text, so the
existing `getByRole('button', { name: 'Manicure', exact: true })` lookups keep working.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
