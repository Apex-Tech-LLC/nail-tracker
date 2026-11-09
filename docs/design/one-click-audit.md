# Nail Tracker One-Click Audit

Audit of all 19 routes in `src/app/routes.tsx`, ranked by how often a nail technician hits each flow during a workday.

## Top 5 Worth Doing First

### 1. [DO FIRST #1] Work Date Picker on `/add`, `/edit/:id`, `/copy/:id`, `/say`, `/adjustment/new`, `/adjustment/:id`
- **Screen:** `TurnForm.tsx`, `SayPage.tsx`, `AdjustmentForm.tsx` (`src/ui/WorkDateField.tsx`).
- **Today (2 to 3 taps + layout shift):** In `TurnForm`, the user taps `Today ▾` to reveal `Yesterday` and `Other day`, then taps `Other day` to reveal `<input type="date">`, then taps the date input. On `/say` and `/adjustment/new`, tapping `Other day` reveals a second row.
- **One-tap version:** Always show the chosen date as a tappable date pill (`Mon 11/9` in English, `T2 9/11` in Vietnamese) beside one-tap `Today` and `Yesterday` chips. Tapping `Yesterday` updates the date pill in place; tapping the date pill opens the native date picker in one tap.
- **Risk:** Native `<input type="date">` triggers vary across iOS Safari and Android Chrome; keep the native input overlaid (`opacity: 0`) or triggered via `showPicker()` on the styled date pill.

### 2. [DO FIRST #2] Tip Target and Client Type on `/add`, `/edit/:id`, `/copy/:id`
- **Screen:** `src/features/turns/TurnForm.tsx`.
- **Today (2 to 3 taps + scroll):** Quick tip buttons (`$5 $10 $15 $20 18%`) only fill whichever tip box matches `tipButtonsTarget` in Settings. Switching a single turn's quick tip from cash to card requires tapping the other tip box and typing on the number pad. Marking a client as `Request` or `Walk-in` is hidden inside the `More options` accordion.
- **One-tap version:** Place a `Cash | Card` pill right beside the quick tip buttons so one tap routes quick-tip taps to either field, and move the `Walk-in / Request` chips out of `More options` onto the main form. Keep `Turn count` and `Note` inside `More options`.
- **Risk:** Adding one chip row above the number pad adds ~36px of height; tighten vertical padding so the form still fits on a 375x740 phone without scrolling.

### 3. [DO FIRST #3] Copy Turn on `/` and `/history` (`TurnRow` to `/copy/:id`)
- **Screen:** `src/features/home/HomePage.tsx`, `src/features/history/HistoryPage.tsx`, `src/features/turns/TurnRow.tsx`.
- **Today (2 taps + route change):** Tapping `Copy` on a turn row navigates to `/copy/:id` and opens the full `TurnForm`, forcing a second tap on `Save` even when the repeat customer had the exact same service and tip.
- **One-tap version:** Save the copied turn immediately on tap (stamped to today and current time) and show the existing bottom toast (`Saved · you earn $40 · Undo · Edit`) so the technician only opens the form when a number changed.
- **Risk:** Copying an old turn from `/history` must always stamp `today` and today's active commission rate rather than copying the historical date.

### 4. [DO FIRST #4] Period Switcher and Chart Box on `/` (Home)
- **Screen:** `src/features/home/HomePage.tsx`.
- **Today (broken view switch + layout shift):** Tapping `Today`, `This week`, or `This month` only changes the top dollar total while the chart stays stuck on weekly polish bottles (`week-bottle`). The `GoalBar` disappears on `Today`, and the Vietnamese comparison pill wraps to two lines, shifting the chart and turn list up and down.
- **One-tap version:** Lock a single 290px chart box in place and reserve both the 2-line comparison slot and the goal bar slot in all three views. Show today's turns as bars in order on `Today` (up to 8, then `+n`), 7 polish bottles with stacked day and date (`Mon` / `11/9`) on `This week`, and a 6-row month calendar grid with whole dollars (`$212`) on `This month` where tapping any day opens that day in `/history`.
- **Risk:** Six-row months at 375px wide leave ~38px per cell row; round cell labels to whole dollars so 3-digit numbers never clip.

### 5. [DO FIRST #5] Voice and ChatGPT Input on `/say`
- **Screen:** `src/features/voice/SayPage.tsx`.
- **Today (scroll + 2 text boxes + 2 buttons):** `mt-auto` pushes the action bar down leaving white space, while a separate `Paste ChatGPT's answer` textarea and `Check the answer` button sit below the fold and force scrolling on a 375x740 phone. If clipboard copy fails, a huge prompt block expands inline on the page.
- **One-tap version:** Remove `mt-auto`, the second textarea, and `Check the answer`. Use one textarea (filling free space, 5+ rows) for both keyboard dictation and pasted ChatGPT answers, auto-detecting JSON/fenced replies (showing a small `ChatGPT answer found` tag) when tapping `Make turns`. Keep a small `Use ChatGPT` link and show the manual copy prompt in a bottom sheet only if clipboard access is refused.
- **Risk:** Auto-detection must check for a JSON object/array with `"turns"` or `"services"` so normal dictated text is never mistaken for a ChatGPT payload.

---

## Remaining Screens Ranked by Daily Frequency

### 6. Fixing a Flagged Voice Turn on `/say/check` and `/say/edit/:key`
- **Screen:** `src/features/voice/CheckPage.tsx`, `src/features/voice/DraftEditPage.tsx`.
- **Today (3 taps):** Fixing a turn flagged with `Check this` (for example, a missing price or tip) opens a full-screen `DraftEditPage`, then requires tapping the field and tapping `Save`.
- **One-tap version:** Render inline preset price and `$5 $10 $15` tip chips directly on flagged cards in `CheckPage` so common fixes take one tap without leaving the review list.
- **Risk:** Only show inline quick-chips on cards with `needsCheck` so normal cards stay compact.

### 7. Quick Filters and Day Off Toggle on `/history`
- **Screen:** `src/features/history/HistoryPage.tsx`, `FilterSheet.tsx`, `CalendarView.tsx`, `DayOffSheet.tsx`, `HoursSheet.tsx`.
- **Today (2 to 3 taps / long-press):** Filtering by `Request`, `Cash tip`, or a top service requires tapping `Filter`, picking chips in `FilterSheet`, and tapping `Show results`. Marking a day off in the month calendar requires a 500ms long-press and a second tap in `DayOffSheet`.
- **One-tap version:** Put a horizontal strip of one-tap filter pills (`Request`, `Cash tip`, `Card tip`, top 2 services) next to `Filter`, and add a one-tap `Day off` toggle pill in the selected day's header.
- **Risk:** Keep the horizontal chip strip single-line with overflow scroll so it does not push the turn list down.

### 8. Bonus vs Deduction Sign on `/adjustment/new` and `/adjustment/:id`
- **Screen:** `src/features/adjustments/AdjustmentForm.tsx`.
- **Today (2 to 3 taps):** Entering a deduction requires switching the phone keyboard to symbols to type `-` before the dollar amount, and picking another date takes 2 taps via `Other day`.
- **One-tap version:** Add a one-tap `+ Bonus | - Deduction` segmented chip above the amount field and use the one-tap date row.
- **Risk:** Editing an existing negative adjustment must initialize the segmented chip to `- Deduction` and display the positive number in the input.

### 9. Pay Breakdown Details on `/earnings` (Reports)
- **Screen:** `src/features/reports/ReportsPage.tsx`.
- **Today (2 taps + scroll):** Commission, cash tips, card tips, and averages are hidden behind a `Details` button inside the summary card, and services beyond the top 5 hide behind `See all`.
- **One-tap version:** Show `Service revenue`, `Commission`, `Cash tips`, and `Card tips` open by default in the summary card without a `Details` toggle.
- **Risk:** Showing the 4 core rows inline adds ~84px to the summary card; keep per-turn averages collapsible if needed.

### 10. Statement Math and Exact Payout on `/payday`, `/payday/:periodId`, `/payday/:periodId/record`, `/payday/:periodId/pay`, `/payment/:id`
- **Screen:** `PaydayPage.tsx`, `PeriodPage.tsx`, `StatementCard.tsx`, `RecordWhatYouGotForm.tsx`, `PaymentForm.tsx`.
- **Today (3 to 5 taps):** `StatementCard` hides supply-fee and card-tip-fee lines behind `Show math`. Tapping `Record what you got` opens a separate route where the technician must type the expected Check and Cash numbers by hand even when the salon paid the exact statement total. `PaymentForm` uses a plain date input with no `Today` / `Yesterday` chips.
- **One-tap version:** Show the statement math lines open by default, add a one-tap `Matches statement ($X check + $Y cash)` button on `PaydayPage` and `RecordWhatYouGotForm` that fills and marks the period checked in one tap, and use the one-tap `WorkDateField` on `PaymentForm`.
- **Risk:** One-tap `Matches statement` should show an `Undo` toast so an accidental tap is reversible in one tap.

### 11. Editing Preset Prices and Order on `/services`
- **Screen:** `src/features/presets/PresetsPage.tsx`, `PresetEditor.tsx`.
- **Today (2 to 4 taps):** Changing a preset's default price opens a full-screen `PresetEditor` replacement view, and moving a preset up 3 rows requires 3 taps on small arrow buttons.
- **One-tap version:** Let tapping a preset's price pill on `PresetsPage` open the number pad inline to update the price in place.
- **Risk:** Keep the row's main tap area distinct from the price pill so scrolling does not trigger edits.

### 12. Effective Start Date on `/pay-rules`
- **Screen:** `src/features/settings/PayRulesPage.tsx`.
- **Today (2 to 3 taps + scroll):** Tapping `Save` at the bottom of the long form reveals a second `When did this start?` card (`Today`, `Start of this pay period`, `Other day`) and a second `Save rules` button.
- **One-tap version:** Show the `Starts:` chip row (`Start of period` selected by default, `Today`, and tappable date pill) inline right above a single `Save rules` button.
- **Risk:** When no active pay period exists, default the inline chip to `Today`.

### 13. Goals, Tax Set-Aside, and First-Run Setup on `/settings`, `/goals`, `/taxes/:year`, `/welcome`
- **Screen:** `SettingsPage.tsx`, `GoalsPage.tsx`, `TaxesPage.tsx`, `OnboardingPage.tsx`.
- **Today (2 to 4 taps across routes):** `/goals` has only two inputs (`Weekly goal`, `Monthly goal`) yet lives on a separate route from `/settings`. Setting a tax set-aside percentage requires navigating to `/taxes/:year` and typing a number. `/welcome` (`OnboardingPage`) splits 4 simple choices across 4 separate wizard screens (`Next` x 4).
- **One-tap version:** Put weekly/monthly goal inputs and one-tap tax set-aside chips (`Off`, `15%`, `20%`, `25%`) inline in `/settings`, and combine `/welcome` into a single no-scroll card with `60%`, `Cash tips now / Card on payday`, and `Start tracking` ready in one tap.
- **Risk:** Keep the full quarterly tax table and CSV/Print actions on `/taxes/:year` via a link under the inline tax chips.
