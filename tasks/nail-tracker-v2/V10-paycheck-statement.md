# V10: Paycheck screen, part 1: what you should get

**Branch:** `task/V10-paycheck-statement`
**Read:** spec sections 5.5 (part 1 and the rules that stay), 6; `src/domain/statement.ts` (V08);
`src/features/payday/*` (all of it: this task turns Payday into Paycheck); `src/features/home/HomePage.tsx`;
`docs/design/v2-mockup.html` (card and list styles).
**Goal:** the technician opens Paycheck and sees, like a pay stub, exactly what the salon should pay them for this pay
period, every line traceable to their own turns.

## 1. Paycheck replaces Payday

Rename the tab `Payday` to `Paycheck` (`Lương`), same icon slot, same routes (`/payday`, `/payday/:id`, keep them so old
links work). The list page opens the current period first as a full statement card, then `Past pay periods` below.
Each past period row shows its dates, `Salon should pay` amount and a status chip: `Not checked` for now (V11 adds
`Matches`, `Short $40`, `Over $12`). Payments, the add-period form and reopening closed periods keep working as now.

## 2. The statement card (`src/features/paycheck/StatementCard.tsx`)

Built only from `buildStatement` (V08): load the period's turns, their services, adjustments and all pay rules.
Lines in this order, each shown only when its rule is in use, so a technician with no fees and no split sees four
lines (services, your share, card tips, salon should pay) plus earned total:

```
Pay period: Nov 1 – Nov 7                         6 days worked
Services you did (45 services, 40 turns)              $2,500.00
Supply fee ($2 × 45 services)                          − $90.00
Your share (60% of $2,410.00)                        $1,446.00
Card tips                                              $400.00
Card-tip fee (3%)                                     − $12.00
Adjustments                                              $0.00
────────────────────────────────────────────────────────────────
Salon should pay you                                 $1,834.00
   as check (50%)                                      $917.00
   as cash (50%)                                       $917.00
Cash tips you already have                             $300.00
You earned in total                                  $2,134.00
```

When services used different rates, the share line reads `Your share` with no percent. A guarantee line comes in 2.4:
leave a spot for it in the order, show nothing now. Money right-aligned with tabular figures; the `Salon should pay`
line bold and larger.

`Show by day` (a toggle button with `aria-expanded`) opens a table: date, services total, your share, card tips, one row
per worked day, with a total row equal to the card's lines.

## 3. Home

The Home `Salon owes` stat (V06) uses `salonPaysCents` minus what has been paid for the current period, never below
zero, so Home and Paycheck always agree. When a split is set, a small line under the stats: `Check $917 · Cash $917`.

## Tests

- Browser (`tests/e2e/paycheck.spec.ts`), clock fixed with an offset: set the spec rules (60%, $2 per service before
  the split, 3% card-tip fee, 50/50) through the How I'm paid page or by seeding `payRules` directly; log turns so the
  period has $500 in services over 5 services with $40 card tips held and $20 cash tips; the card shows services
  $500.00, supply fee − $10.00, share $294.00 (60% of $490.00), card tips $40.00, card-tip fee − $1.20, salon should pay
  $332.80, check $166.40, cash $166.40, cash tips $20.00, earned $352.80. `Show by day` totals match.
- With no fees and no split the card shows only the four lines and earned total.
- Existing Payday tests are updated in how they find things (the tab name), never in what they check.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
