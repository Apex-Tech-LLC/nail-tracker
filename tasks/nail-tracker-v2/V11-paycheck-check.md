# V11: Paycheck, parts 2 and 3: record what you got, and the check

**Branch:** `task/V11-paycheck-check`
**Read:** spec sections 5.5 (parts 2 and 3), 6, 8; `src/domain/paycheckCheck.ts` (V08); `src/features/paycheck/`
and `src/features/payday/PaymentForm.tsx`, `paymentStore.ts`; `src/domain/reminders.ts` (V07).
**Goal:** after payday the technician types in their check and cash and sees at once `Matches`, or `Short $40` with the
likely reason in plain words.

## 1. Record what you got

On the period's statement, `Record what you got` (`Ghi số tiền đã nhận`) opens a form with:
- `Check amount`, `Cash amount`, and `Other payment` (amount + method: Zelle, direct deposit, other) with a date
  (default today). Saving creates ordinary `Payment` records (method `check`, `cash`, ...) allocated to this period, so
  the existing payment list, allocation across periods and the payment edit screen keep working.
- An optional section `What the salon's stub says` (closed by default): services total, tips total, deductions. Stored
  in the period's `PaycheckRecord` (V08), created on first save.
- Money boxes use the number pad (V04).

## 2. The check

After saving, and whenever the period has payments, the statement shows a result banner from `checkPaycheck`, comparing
the payments allocated to this period (check, cash, other by method) with the statement:
- `Matches` (`Đúng`): green.
- `Short $40` (`Thiếu $40`): amber, with each reason below it in a plain sentence:
  - `The salon counted $112 less in services than you logged.`
  - `The salon took $50 more in deductions than your pay rules say.`
  - `Card tips: the salon counted $380; you logged $400.`
  - `The cash part is $40 short; the check part matches.`
- `Over $12` (`Dư $12`): neutral, with `The salon paid $12 more than your records. Check if a turn is missing.`

Then `Mark as checked` sets `checkedDate`; a checked period shows `Checked Nov 8` and can be unchecked. The past periods
list (V10) now shows `Matches`, `Short $40`, `Over $12` or `Not checked`.

## 3. Reminder

Add the `paycheck` reminder to `dueReminder` (V07), ranked above backup: a pay period that ended before today, has turns,
and is not checked: `Your Nov 1 – Nov 7 pay period ended. Check your paycheck.` with a `Check now` button opening it.

## Tests

- Unit: the `paycheck` reminder order and dismissal.
- Browser (`tests/e2e/paycheck-check.spec.ts`), with the V10 example period (salon should pay $332.80, 50/50):
  - check $166.40 + cash $166.40 shows `Matches`;
  - check $166.40 + cash $146.40 shows `Short $20.00` and `The cash part is $20.00 short; the check part matches.`;
  - stub services $480 adds `The salon counted $20.00 less in services than you logged.`;
  - `Mark as checked`, then the past list shows the status; after the period ends Home shows the paycheck reminder
    only until it is checked.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
