# V04: Fast Add turn, part 2: built-in number pad and compact top line

**Branch:** `task/V04-number-pad`
**Read:** spec section 5.2 item 0; the Add turn phone in `docs/design/v2-mockup.html` (CSS `.pad`, `.sheet-top`,
`.when`, `.lines`, `.ln.active`, `.earn`); `src/features/turns/TurnForm.tsx`, `ServiceLineFields.tsx`,
`src/ui/MoneyField.tsx`.
**Goal:** typing prices and tips never opens the phone's keyboard, so the screen does not jump; Save sits under the
thumb.

## 1. Number pad (`src/ui/NumberPad.tsx`)

- A panel fixed to the bottom of the screen (above the safe area), mockup `.pad`: a 4-column grid, keys `1`–`9`, `.`,
  `0`, `⌫` in three columns, and a fourth column holding `Next` (ink background, white text, two rows tall) and
  `Save` (lacquer background, white text, two rows tall). Keys at least 52px tall, 22px semibold digits, white keys on
  `#e7e1ea`.
- It types into the money box that is active: digits and `.` append, `⌫` removes the last character. It refuses a
  second `.` and a third digit after the `.`. It respects the existing 99,999,999-cent limit by refusing the key.
- `Next` moves to the next money box in screen order (service prices, then cash tip, then card tip); on the last one it
  hides the pad. `Save` does exactly what the Save button does.
- Each key is a `<button type="button">` with an `aria-label` (`1`, `Decimal point`, `Delete last digit`, `Next`,
  `Save`, with Vietnamese). Keys use `onPointerDown` with `preventDefault()` so tapping a key does not move focus away
  from the money box.

## 2. Money boxes use it

- `MoneyField` gets an optional `usePad` prop. When true, the input has `inputMode="none"` (no phone keyboard) and stays
  a real, focusable `<input>`, so typing with a hardware keyboard and Playwright's `fill()` still work. The active box
  gets the lacquer underline from the mockup `.ln.active .v`.
- In `TurnForm` every money box (service prices, cash tip, card tip) passes `usePad` when the setting is on. The pad
  shows while one of them is focused and hides when focus moves to anything that is not the pad or a money box.
- While the pad shows, the page gets enough bottom padding that the focused box is never hidden behind it
  (`scrollIntoView({ block: 'nearest' })` on focus).

## 3. Setting

`Settings` gets `numberPad: boolean`, default `true`, with a switch in the Settings screen: `Use the app's number pad`
/ `Dùng bàn phím số của ứng dụng`, and a hint `Turn off to use your phone's keyboard` / `Tắt để dùng bàn phím của
điện thoại`.

## 4. Compact top line

- The `Date` chips (`Today`, `Yesterday`, `Other day`) become one pill at the top right of the title row, mockup
  `.when`: `Today ▾` (or `Yesterday ▾`, or the short date). Tapping it shows the existing three choices (and the date
  field for Other day) in place, below the title; choosing one closes them.
- The shared `Commission %` box becomes a pill `60% ▾` next to it. Tapping it shows the existing percent field;
  changing it works exactly as today. When per-service rates are on, nothing changes for the per-line rate boxes.
- The pills have `aria-expanded` and an `aria-label` that includes the word Date or Commission.

## 5. Tests

- Update `tests/e2e/helpers.ts` `addTurn` and any test that fills `Commission %` or taps the date chips, to open the pill
  first. Do not remove any check.
- New `tests/e2e/number-pad.spec.ts`:
  1. Focusing Service amount shows the pad; tapping `3`, `5` types `35`; `⌫` leaves `3`.
  2. `.` then `5`, `0`, `0` gives `3.50` (the third decimal digit is refused).
  3. `Next` moves to Cash tip; `Save` saves and shows the turn on Today.
  4. The service amount input has `inputmode="none"` while the setting is on, and `decimal` when it is off.
  5. The date pill reads `Today ▾`; choosing Yesterday saves the turn on yesterday's date.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
