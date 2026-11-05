# T17: The full Settings screen

- **Branch:** `task/T17-settings`
- **Milestone:** M3 Earnings and payday
- **Depends on:** T16
- **Size:** about 40 minutes

## Goal

Every setting from the spec can be seen and changed. Each change saves at once; there is no Save button.

## Steps

Edit `src/features/settings/SettingsPage.tsx`. It already has language tiles, a link to service presets, storage status and the version line.

Page order, top to bottom. Use `TileGroup` for choices, and add the words below as `legend`. `TileGroup` needs a `glyph` for each option. Change `glyph` to optional in `TileOption`, and render that `<span>` only when it is set.

| # | Section | Control | Writes |
|---|---|---|---|
| 1 | `language` | Existing tiles | `locale` |
| 2 | `defaultCommission` | Tiles `60%`, `50%`, `customRate` | `defaultCommissionRateBp` |
| 3 | `perServiceRates` | Checkbox with hint `perServiceRatesHint` | `perServiceRates` |
| 4 | `commissionBasis` | Read-only row showing `commissionBasisValue` | nothing |
| 5 | `weekStart` | Tiles `sunday`, `monday` | `weekStartDay` |
| 6 | `paydaySchedule` | Tiles `scheduleWeekly`, `scheduleBiweekly`, `scheduleCustom`, `scheduleNone` | `payPeriodType` |
| 7 | `anchorDate` | Date input with hint `anchorDateHint`, only for weekly and biweekly | `payPeriodAnchorDate` |
| 8 | `cashTipHandling` | Tiles `tipInHand`, `tipFromSalon` | `cashTipHandling` |
| 9 | `cardTipHandling` | Tiles `tipInHand`, `tipFromSalon`, then hint `tipHandlingHint` | `cardTipHandling` |
| 10 | `manageServices` | Existing link | |
| 11 | `currency` | Read-only row showing `currencyUsd` | nothing |
| 12 | `theme` | Read-only row showing `themeLight` | nothing |
| 13 | Storage status | Existing | |
| 14 | Version line | Existing, stays last | |

Rules:

- **Commission tiles.** The tile values are `'6000'`, `'5000'` and `'custom'`. The chosen tile is `'6000'` or `'5000'` when the saved rate matches and the person has not picked Custom. Keep `const [customOpen, setCustomOpen] = useState(rate !== 6000 && rate !== 5000)`.
  - Picking 60 or 50 closes Custom and calls `updateSettings`.
  - Picking Custom opens a `PercentField` labelled `customRateLabel`, starting with `rateToInput(rate)`. On each change, if `parseRateBp` gives a number, save it. If not, show `errorRate` and keep the old saved value.
- **Changing the default never touches saved turns.** No code here writes to the database.
- **Payday schedule.** Choosing weekly or biweekly when `payPeriodAnchorDate` is null sets it to the first day of the current week: `weekRange(todayIso(), weekStartDay).start`.
- **Anchor date.** Save only when `isIsoDate(value)` is true.
- **Changing the schedule** leaves old periods in place. `missingPeriods` already skips overlaps. Do not delete any.
- Read-only rows use `Row` from `src/ui/Row.tsx`, inside a `card`.
- Keep `PageHeader` with `languageButton={false}`.

Write the checkbox as in T08. To keep this file readable, move `TileGroup` to `src/ui/TileGroup.tsx` and import it. T18 uses it too.

### Tests

Create `tests/e2e/settings.spec.ts`, `seedSettings(page)` first:

| Test | Steps | Expected |
|---|---|---|
| Language | Open `./#/settings`. Choose Tiếng Việt. `page.reload()` | Heading `Cài đặt`. The tab `Hôm nay` shows |
| 50% | Choose `50%`. Open `./#/add` | `Commission %` box holds `50` |
| Custom | Choose Custom. Fill `Custom commission %` with `62.5`. Open `./#/add` | Box holds `62.5` |
| Custom bad | Choose Custom. Fill with `abc` | `Enter a percent from 0 to 100, like 60 or 62.5.` shows |
| Old turns stay | `addTurn(page, { amount: '100' })`. Open `./#/settings`, choose `50%`. Open `./` | Shows `$60.00` |
| Week start | With the clock fixed at `2026-11-04T12:00:00`, choose Monday. Open `./#/earnings` | Range reads `Nov 2 – Nov 8` |
| Payday schedule | With the same clock, choose Weekly. Open `./#/payday` | No `Set your payday schedule` text. A period shows |
| Anchor | Choose Weekly. Fill `First day of a pay period` with `2026-11-03`. Open `./#/payday` | `Nov 3 – Nov 9` shows |
| Tip handling | Choose under Cash tips `The salon pays them on payday`. Open `./#/add`, open More options | `Cash tip already in my hand` is not checked |
| Per service | Tick `Different commission for each service`. Open `./#/add` | The rate box is inside the `service-line` block |

Two tile groups share the words `tipInHand` and `tipFromSalon`. In tests, scope with `page.getByRole('group', { name: 'Cash tips' })`, which works because `TileGroup` is a `fieldset` with a `legend`.

Keep the `name` prop of each `TileGroup` unique (`commission`, `week-start`, `pay-schedule`, `cash-tips`, `card-tips`), or the browser treats them as one radio group.

## Files

Edit `src/features/settings/SettingsPage.tsx`. Create `src/ui/TileGroup.tsx`, `tests/e2e/settings.spec.ts`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/settings.spec.ts tests/e2e/smoke.spec.ts --workers=2` passes.

## Not in this task

Backup, restore, export and delete-all sections (T20).
