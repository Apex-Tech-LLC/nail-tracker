# V19: Guarantee and tiers

**Branch:** `task/V19-guarantee-tiers`
**Read:** spec sections 5.5 (part 1), 7.2, 7.5, 7.6, 9.2 and 12; `src/domain/payRules.ts`, `src/domain/statement.ts`
and `tests/unit/statement.test.ts`; `src/features/payRules/*`; `src/features/paycheck/StatementCard.tsx`;
`src/features/paycheck/` and `src/features/payday/periodStore.ts` (where the statement is built);
`src/features/history/workDays.ts` (V14: days off); `src/db/schema.ts`; `src/features/backup/backupFormat.ts`,
`migrateBackup.ts`, `importJson.ts`.
**Goal:** a technician with a guaranteed $150 a day, or a rate that rises with weekly sales, sees exactly what the
salon owes them on the Paycheck statement.

## 1. Pay rules gain two fields

```ts
export type Guarantee =
  | { kind: 'none' }
  | { kind: 'perDay'; cents: number; minDays: number | null }    // per day worked
  | { kind: 'perPeriod'; cents: number; minDays: number | null } // per pay period
export interface Tiers {
  mode: 'eachPart' | 'wholeAtTop'
  levels: { fromCents: number; rateBp: number }[] // ascending; the first is fromCents 0; 2 to 5 levels
}
// PayRules gains: guarantee: Guarantee (default { kind: 'none' }), tiers: Tiers | null (default null)
```

`NO_RULES`, `defaultPayRules` and `rulesOn` carry them. Tiers and guarantee are weekly in most salons; here they
apply to the whole pay period, which is a week for weekly pay. The rules in force on the period's last day decide
them, as the check/cash split already does.

Data: `db.version(4)` with an upgrade step that gives every saved pay rule `guarantee: { kind: 'none' }` and
`tiers: null`. Backup format version 4; `MIGRATIONS[3]` does the same to backups; import validates both fields
(levels ascending, first at 0, rates 0 to 100%, amounts whole cents ≥ 0). Do not change versions 1 to 3.

## 2. The maths (`src/domain/statement.ts`, `src/domain/payRules.ts`)

Add `tierShare(baseCents, tiers)` to `payRules.ts`:
- `eachPart`: each level's part of the base at its own rate, each part rounded half up, then added. $1,200 with 50%
  to $500, 55% to $1,000, 65% above: $250 + $275 + $130 = $655.
- `wholeAtTop`: the whole base at the rate of the highest level whose `fromCents` is below the base. $1,200: $780.
- A base exactly on a level boundary stays in the lower level: $500.00 is all at 50% in both modes.

`buildStatement` gains an input `daysOff: ReadonlySet<IsoDate>` and:
- **Tiers on:** your share = `tierShare(services total − before-split supply fees)` − after-split supply fees (never
  below 0). Per-service rates are not used. `byDay` share: each day's base × (share ÷ base), rounded, with the last
  day taking what is left so the days add up to the share exactly. Add `tierRates: number[] | null` to `Statement`
  for the statement line.
- **Guarantee:** days worked for it = days with at least one turn (a zero-priced turn counts) that are not marked
  off. `perDay`: amount × those days; `perPeriod`: the amount. When `minDays` is set and fewer days were worked,
  the guarantee is 0. `guaranteeTopUpCents` = guarantee − your share when positive, else 0. Add `guaranteeCents`
  and `guaranteeDays` to `Statement` so the line can show its sum.
- Everything after step 7 of section 7.2 is unchanged: the top-up is already part of `salonPaysCents`.

Pass the days off (from `workDays`) wherever the statement is built today.

## 3. How I'm paid page

Two new sections, each with an on/off switch and a one-line example in plain words, as the other rules have:
- **Guarantee** (`Bao lương`): `Per day worked` / `Per pay period` (`Mỗi ngày làm` / `Mỗi kỳ lương`), the amount,
  and an optional `Only if I work at least _ days` (`Chỉ khi làm ít nhất _ ngày`). Example: `$150 a day, 6 days =
  $900. If your share is less, the salon adds the rest.`
- **Tiers** (`Chia theo bậc`): rows of `From $_` and `rate _%` (add and remove rows, 2 to 5), and the mode: `Each part
  at its own rate` / `The whole amount at the highest rate reached` (`Mỗi phần theo bậc của nó` / `Cả tuần theo bậc
  cao nhất`). Example worked out from the rows entered, like `$1,200 in sales: $655`. When on, the commission rate
  section says `Tiers are on: the rate per service is not used.`
The rule summary on Settings mentions them when on.

## 4. Statement lines

- Tiers on: `Your share (tiers 50% / 55% / 65% of $1,200.00)` in place of the one-rate line.
- Guarantee on: `Guarantee ($150 × 6 days = $900): not needed` with $0.00, or `Guarantee top-up ($150 × 6 days =
  $900)` with the top-up amount. Per pay period: `Guarantee ($900)`. Below the minimum days: `Guarantee: needs 5
  days, you worked 4`. Off: no line, as now.

## Tests

- Unit (`tests/unit/statement.test.ts`, `tests/unit/payRules.test.ts`): both tier examples; $500.00 exactly at the
  lower rate; the guarantee examples from spec 7.6 ($1,446 share: not needed; $760 share: top-up $140); a day off
  and a day with only a zero-priced turn; minimum days not reached; the spec 5.5 statement is still exact with both
  off; `MIGRATIONS[3]`; a version 3 database opens as version 4 with the new fields filled.
- Browser (`tests/e2e/guarantee-tiers.spec.ts`, clock fixed with an explicit offset): set a $150 per day guarantee,
  log a slow week, and the Paycheck statement shows the top-up and the right `Salon should pay`; set tiers and see the
  tier line; both survive a reload and a backup round-trip.
- Existing tests change only in how they find things.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
