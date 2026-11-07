# V02: Compact turn rows, copy on every row, swipe, long-press, undo

**Branch:** `task/V02-rows-copy-undo`
**Read:** spec section 4.1 (interaction rules 1 to 4); the History and Home phones in `docs/design/v2-mockup.html`
(CSS classes `.list`, `.turn`, `.sw`, `.t-name`, `.t-sub`, `.t-amt`, `.copy`, `.swipe`, `.actions`, `.toast`,
`.dayhead`).
**Goal:** a technician can copy any turn in one tap from any list, swipe a row to copy or delete it, and undo a delete.
About 10 turns fit on one screen.

## 1. Short money format (`src/domain/money.ts`)

Add `formatUsdShort(cents: number): string`: like `formatUsd`, but whole dollars drop the cents.
`3500 → "$35"`, `3550 → "$35.50"`, `123400 → "$1,234"`, `-500 → "-$5"`, `0 → "$0"`.
Unit tests in `tests/unit/money.test.ts` (add to the existing file) for each of those.

## 2. Time of day (`src/domain/dates.ts`)

Add `formatTime(ms: number, locale: DateLocale): string` using `Intl.DateTimeFormat` with `hour: 'numeric',
minute: '2-digit'`, locale `en-US` or `vi-VN`. English gives `3:40 PM`; Vietnamese gives `15:40`. One unit test that
checks the English result contains `:40` and the Vietnamese one contains `15:40` for a time built with `new Date(2026,
10, 6, 15, 40).getTime()` (local time, so it works in any time zone).

## 3. Service colour (`src/ui/serviceColor.ts`)

`serviceColor(name: string): string` returns one of these 8 colours, chosen by a simple string hash of the lower-cased
name, so the same service always gets the same colour: `#a3164d`, `#d98fb0`, `#6b2c91`, `#2c7a91`, `#c06a2b`,
`#3d8b5f`, `#8a5a44`, `#4a5bb5`. Unit test: same name gives the same colour; result is always in the list.

## 4. Undo bar (`src/ui/Toast.tsx`)

- `ToastProvider` wraps the app in `src/app/App.tsx` (inside the Router). `useToast()` returns
  `show({ message: string; actions?: { label: string; onClick: () => void }[] })`.
- One bar at a time; a new one replaces the old. It disappears after 6 seconds, or at once when an action is tapped.
- Look: the mockup's `.toast`: dark ink background, white text, actions in `#ffb3cd` bold, 14px radius, fixed 16px from
  the sides, sitting just above the bottom bar (`bottom: calc(96px + env(safe-area-inset-bottom))`) on tab screens and
  16px from the bottom elsewhere.
- Accessibility: the bar is inside an element with `role="status"` and `aria-live="polite"`. Actions are real buttons
  of at least 44px height.
- Respect reduced motion (no slide animation then).

## 5. Delete with undo (`src/features/turns/turnStore.ts`)

- `deleteTurn(db, id)` now returns what it removed: `Promise<{ turn: Turn; services: TurnService[] } | null>` (null if
  the id did not exist).
- Add `restoreTurn(db, removed)`, which puts the same turn and service rows back with the same ids, in one transaction.
- Same pair for adjustments in `src/features/adjustments/adjustmentStore.ts`: `deleteAdjustment` returns the removed
  row; add `restoreAdjustment`.
- Unit tests (fake-indexeddb, like the existing store tests): delete then restore gives back identical rows.

On the Edit turn screen and the Edit adjustment screen, the delete button no longer opens a "Are you sure?" dialog. It
deletes at once, closes the screen the way it does today, and shows `Turn deleted` (or `Adjustment deleted`) with an
`Undo` action that restores it. Leave every other `ConfirmDialog` (payments, periods, presets, delete all data) as it is.
Remove the i18n keys that are no longer used.

## 6. The new turn row (`src/features/turns/TurnRow.tsx`)

Layout, left to right, about 60px tall (mockup `.turn`):

1. A 10 × 34px rounded colour mark: `serviceColor` of the first service's name.
2. Main text, taking the free space, which is a link to the edit screen covering the mark and the text:
   - line 1, 15px semibold, one line with ellipsis: all service names joined with ` + `
     (`Gel Manicure + Nail Art / Design`).
   - line 2, 13px muted: time (`formatTime`), then `#4` (the turn number; `#–` when it has none), then the client type
     when it is not unspecified (`Walk-in` / `Request` words already in i18n), joined with ` · `.
3. Amounts, right-aligned: earned in 16px bold with `formatUsdShort`; under it, only when there is a tip,
   `+$10 tip` in 12px semibold `text-positive-text`.
4. A copy button: a separate link to `paths.copy(turn.id)`, 44 × 44px, icon `IconCopy` from `@tabler/icons-react`,
   `aria-label` "Copy turn #4" (English) and the Vietnamese equivalent with the number. It must not be inside the edit
   link (no link inside a link).

Rows no longer have their own card. The list that holds them uses `list` from `src/ui/styles.ts` (one white card with
dividers). Do the same for `AdjustmentRow` (same height and padding, no copy button, amount in `formatUsdShort`).

### Swipe

- Swiping a row left more than 60px opens it to show two 76px action buttons behind it, right-aligned: `Copy` (ink
  background, link to copy) and `Delete` (danger background). Less than 60px springs back.
- Use pointer events on the row only, no library: start on `pointerdown`; treat it as a swipe only when the finger has
  moved more than 10px sideways and more sideways than up/down; then `setPointerCapture` and move the row with
  `transform: translateX()`, clamped between `-152px` and `0`. The row has `touch-action: pan-y` so the page still
  scrolls up and down.
- A swipe must not also open the edit screen: swallow the click that follows a swipe.
- Only one row open at a time. Tapping anywhere else, or scrolling, closes it.
- Delete here behaves like delete on the edit screen (deletes at once, `Turn deleted · Undo`).
- While closed, the action buttons are `aria-hidden` and `tabIndex={-1}` (keyboard and screen reader users have the
  copy button and the edit screen).

### Long-press

Holding a row for 500ms without moving more than 10px opens a small sheet at the bottom of the screen with three
buttons, `Copy`, `Edit`, `Delete`, and `Cancel`. It closes on Cancel, Escape, or a tap outside it. Block the browser's
own long-press menu on the row (`onContextMenu` preventDefault). Use a `<dialog>`-free fixed panel with
`role="dialog"` and `aria-modal="true"`, focus moved to its first button.

## 7. Lists

- **Today** (`TodayPage.tsx`) and **History** (`HistoryPage.tsx`): render rows inside one `list` container per day
  instead of a gap between cards.
- **History day header** (mockup `.dayhead`): day name on the left in 14px bold; on the right, muted, `9 turns · $333`
  (turns that day and earned that day in `formatUsdShort`). A day with one turn says `1 turn`. Add i18n keys with
  Vietnamese (`{n} turn`; Vietnamese has no plural, so `9 turn` and `1 turn`).

## 8. Tests

- Browser tests that looked for the old row text (`Turn #4`, `Tip $6.00`, `Day total`) or clicked through the delete
  dialog must be updated to the new UI. Keep what each test checks; only change how it finds things. Do not delete a
  test.
- New file `tests/e2e/rows.spec.ts`:
  1. The copy button on a Today row opens a filled copy form; saving makes a second turn with the same services and
     prices.
  2. Swiping a History row left (use `page.mouse` down, move 120px left in steps, up) shows Copy and Delete; tapping
     Delete removes the row and shows `Turn deleted`; tapping `Undo` brings it back with the same amount.
  3. A short swipe of 30px does not open the row and does not open the edit screen.
  4. Long-press (mouse down, wait 600ms, up) shows Copy / Edit / Delete; Escape closes it.
  5. Delete on the Edit turn screen shows `Turn deleted`, and Undo restores the turn.
  6. A row's height is at most 72px (read `boundingBox()`).
- The accessibility test (`a11y.spec.ts`) must still pass.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
