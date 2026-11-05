# T03: Commission and totals maths

- **Branch:** `task/T03-commission-totals`
- **Milestone:** M1 Foundation
- **Depends on:** T02
- **Size:** about 40 minutes

## Goal

Create the maths that every screen depends on: `src/domain/commission.ts` and `src/domain/totals.ts`. Plain TypeScript, no React, no database.

## Steps

1. Copy the ready-made tests. Do not edit them.
   ```
   cp tasks/nail-tracker/reference/unit/commission.test.ts tests/unit/commission.test.ts
   cp tasks/nail-tracker/reference/unit/totals.test.ts tests/unit/totals.test.ts
   ```

2. Create `src/domain/commission.ts`:
   ```ts
   import { roundDiv } from './money.ts'

   export interface PricedLine {
     priceCents: number
     rateBp: number
   }

   export interface TurnMoney {
     lineCommissionCents: number[]
     serviceRevenueTotalCents: number
     commissionTotalCents: number
     earnedTotalCents: number
   }

   /** Price times rate, rounded half up to the cent. Rates are basis points: 6000 is 60%. */
   export function commissionCents(priceCents: number, rateBp: number): number {
     return roundDiv(priceCents * rateBp, 10_000)
   }
   ```
   Add `turnTotals(lines: readonly PricedLine[], cashTipCents: number, cardTipCents: number): TurnMoney`:
   - `lineCommissionCents`: `commissionCents` of each line, in order.
   - `serviceRevenueTotalCents`: sum of prices.
   - `commissionTotalCents`: sum of the **already rounded** line commissions.
   - `earnedTotalCents`: commission total + cash tip + card tip.

3. Create `src/domain/totals.ts`. Export these exactly:
   ```ts
   export type AdjustmentCategory = 'bonus' | 'commissionCorrection' | 'tipCorrection' | 'bookkeepingDeduction'

   export interface TurnFigures {
     localWorkDate: string
     turnCount: number
     serviceRevenueTotalCents: number
     commissionTotalCents: number
     cashTipCents: number
     cardTipCents: number
     cashTipReceived: boolean
     cardTipReceived: boolean
   }

   export interface AdjustmentFigures {
     amountCents: number
     category: AdjustmentCategory
   }

   export interface Totals {
     turns: number
     customers: number
     workDays: number
     serviceRevenueCents: number
     commissionCents: number
     cashTipsCents: number
     cardTipsCents: number
     tipsCents: number
     adjustmentsCents: number
     earnedCents: number
     tipsInHandCents: number
     expectedPayoutCents: number
   }
   ```

   `sumTotals(turns: readonly TurnFigures[], adjustments: readonly AdjustmentFigures[]): Totals`:

   | Field | Rule |
   |---|---|
   | `turns` | Sum of `turnCount` |
   | `customers` | How many entries have `turnCount >= 1` |
   | `workDays` | How many different `localWorkDate` values the turns have. Adjustments do not count |
   | `serviceRevenueCents`, `commissionCents`, `cashTipsCents`, `cardTipsCents` | Plain sums |
   | `tipsCents` | Cash + card |
   | `adjustmentsCents` | Sum of **all** adjustments, including bookkeeping deductions |
   | `earnedCents` | Commission + tips + `adjustmentsCents` |
   | `tipsInHandCents` | Cash tips where `cashTipReceived` is true + card tips where `cardTipReceived` is true |
   | `expectedPayoutCents` | Commission + tips − `tipsInHandCents` + adjustments where `adjustmentAffectsPayout` is true |

   `adjustmentAffectsPayout(category: AdjustmentCategory): boolean`: false only for `'bookkeepingDeduction'`.

   `averages(totals: Totals): { earnedPerTurnCents, tipsPerTurnCents, earnedPerWorkDayCents }`: each uses `roundDiv` from `money.ts`, and is 0 when the number it divides by is 0. "Per turn" divides by `totals.turns`. "Per working day" divides by `totals.workDays`.

   `numberTurns(turns: readonly { id: string; turnCount: number; occurredAt: number; createdAt: number }[]): Map<string, number | null>`:
   - Copy the list, sort by `occurredAt`, then by `createdAt` for ties. Never sort the caller's array.
   - Keep a running total of `turnCount`.
   - An entry's number is the running total after adding it, so turn counts 1, 1, 2, 0, 1 give 1, 2, 4, null, 5.
   - An entry with `turnCount` 0 gets `null`.

4. Run `pnpm exec vitest run tests/unit/commission.test.ts tests/unit/totals.test.ts --maxWorkers=2` and fix your code until it passes.

## Files

Create `src/domain/commission.ts`, `src/domain/totals.ts`, `tests/unit/commission.test.ts`, `tests/unit/totals.test.ts`.

## Done when

- The vitest command above passes.
- `pnpm gate` passes.

## Not in this task

Anything on screen. Pay periods (T14).
