# T22: End-to-end acceptance and edge cases

- **Branch:** `task/T22-acceptance`
- **Milestone:** M5 Testing and polish
- **Depends on:** T21
- **Size:** about 45 minutes

## Goal

One test file that walks through the product document's acceptance list and edge cases. If a test finds a real bug, fix the bug in the app.

## Steps

Create `tests/e2e/acceptance.spec.ts`. Before each test:
```ts
await page.clock.setFixedTime(new Date('2026-11-04T12:00:00'))
await seedSettings(page, weeklyPay)
```

Some rows are already covered by another test. Do not repeat those: the last table lists them, and you only need to confirm those files still pass.

### Tests to write

| # | Name | Steps | Expected |
|---|---|---|---|
| 1 | Full day | Add `40` Gel Manicure with cash `5`. Add `50` Pedicure with card `10`. Add `30` Manicure | Today: `3` turns, service revenue `$120.00`, commission `$72.00`, cash `$5.00`, card `$10.00`, total `$87.00`, `Turn #3` |
| 2 | Combined ticket | Open form. Amount `80`. More options, Turn count `2`. Save. Then add `30` | Today: `Turn #2`, `Turn #3`, and turns `3`, customers `2` |
| 3 | No tip | Add `25` | Total earned `$15.00` |
| 4 | Tip with no commission | Amount `50`, cash `5`, Commission % `0` | Commission `$0.00`, total `$5.00` |
| 5 | Zero dollar service | Amount `0`, cash `5` | Saves. Total `$5.00` |
| 6 | Old date | Open form. Other day, date `2026-10-20`. Amount `100`, Save. Open History, press Custom, From `2026-10-20`, To `2026-10-20` | `Tuesday, October 20` shows. Today still shows `No turns yet`. Payday list holds `Oct 18 – Oct 24` |
| 7 | Shift past midnight | Clock at `2026-11-05T00:30:00`. Open form, press Yesterday, amount `100`, Save. Open `./` | Today (Nov 5) shows `No turns yet`. History, Yesterday shows `Turn #1` under `Wednesday, November 4` |
| 8 | Edit an old turn | Save `100` on `2026-10-20`. Open its period on Payday and note `$60.00`. In History, Custom range, tap it, amount `200`, Save. Open the period again | Expected salon payout `$120.00` |
| 9 | Delete a turn in a report | Add `100` and `50`. Earnings shows `$90.00`. Delete the second | Earnings shows `$60.00` |
| 10 | Odd price, odd rate | Amount `19.99`, Commission % `62.5` | Commission `$12.49` |
| 11 | Language changes nothing | Add `100`. Note Earnings `$60.00`. Switch to Vietnamese. Open Earnings | `$60.00` and `Tiền chia` show |
| 12 | Daylight saving | Clock at `2026-11-01T12:00:00` (the US clock change day). Add `100`. Move the clock to `2026-11-02T12:00:00`. Open History, press Yesterday | Shows `Sunday, November 1` and `Turn #1` |
| 13 | No account | Open `./`, Settings, Payday | The words `sign in`, `log in`, `password`, `email` appear nowhere: `expect(page.getByText(/sign in\|log in\|password\|email/i)).toHaveCount(0)` |

### Already covered: confirm these still pass

| Requirement | Test file |
|---|---|
| Several services on one turn | `add-turn.spec.ts` |
| Save & Add Another | `add-turn.spec.ts` |
| Default rate change keeps old turns | `edit-turn.spec.ts`, `settings.spec.ts` |
| Partial payment, shortage, overpaid, one payment over two periods | `payday.spec.ts` |
| Bad backup files | `backup.spec.ts`, `tests/unit/backup.test.ts` |
| Offline | `offline.spec.ts` |
| Language kept after reload | `settings.spec.ts` |

### Fixing bugs

If an acceptance test fails:
1. Decide if the test or the app is wrong. The numbers in the table above are correct. Work them out by hand to be sure.
2. Fix the app.
3. List each bug fixed in your final report under `Notes`.

A change of more than about 30 lines to fix one bug: stop and report `BLOCKED` with what you found. The manager will plan it as its own task.

## Files

Create `tests/e2e/acceptance.spec.ts`. Change app files only to fix bugs.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test --workers=2` passes in full.

## Not in this task

Accessibility (T23), charts (T24).
