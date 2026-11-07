# V08: Pay rules, the paycheck statement maths, and the data upgrade

**Branch:** `task/V08-pay-rules-maths`
**Read:** spec sections 5.5, 7.1 to 7.3, 9.1 and 9.2; `src/domain/totals.ts`, `src/domain/payday.ts`,
`src/domain/money.ts`; `src/db/schema.ts`; `src/features/backup/backupFormat.ts`, `migrateBackup.ts`,
`importJson.ts`, `exportJson.ts`.
**Goal:** the maths and storage that Paycheck (V09 to V11) shows. No screen changes in this task.

## 1. `src/domain/payRules.ts` (plain TypeScript)

```ts
export type FeeWhen = 'beforeSplit' | 'afterSplit'
export type SupplyFee =
  | { kind: 'none' }
  | { kind: 'perService'; cents: number; when: FeeWhen }
  | { kind: 'percent'; bp: number; when: FeeWhen }

export interface PayRules {
  id: string
  startDate: IsoDate
  supplyFee: SupplyFee
  cardTipFeeBp: number            // 0 = none
  checkBp: number | null          // null = no check/cash split; 5000 = 50% by check
  cardTipsPaidIn: 'check' | 'cash' | 'split'
  createdAt: number
  updatedAt: number
}
// Release 2.4 adds guarantee and tiers: leave room, add no fields for them now.

export const NO_RULES: Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'> // startDate '2000-01-01', no fees, no split, 'split'

/** The rules in force on `date`: the latest with startDate <= date; before the first, the earliest; none saved, NO_RULES. */
export function rulesOn(rules: readonly PayRules[], date: IsoDate): Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'>
```

## 2. `src/domain/statement.ts`

```ts
export interface StatementService { localWorkDate: IsoDate; priceCents: number; commissionRateBp: number; commissionCents: number }
export interface Statement {
  daysWorked: number; turns: number; services: number
  servicesTotalCents: number
  supplyFeeCents: number; supplyFeeWhen: FeeWhen | null
  shareRateBp: number | null      // the one rate when every service used the same rate, else null
  shareBaseCents: number          // what the rate was applied to (services total minus a before-split fee)
  shareCents: number              // your share after the supply fee
  cardTipsCents: number; cardTipsHeldCents: number; cardTipFeeCents: number
  adjustmentsCents: number        // only those that change pay (adjustmentAffectsPayout)
  guaranteeTopUpCents: number     // always 0 until release 2.4
  salonPaysCents: number; checkCents: number | null; cashCents: number | null
  cashTipsInHandCents: number; earnedTotalCents: number
  byDay: { date: IsoDate; servicesTotalCents: number; shareCents: number; cardTipsCents: number }[]
}
export function buildStatement(input: {
  services: readonly StatementService[]
  turns: readonly TurnFigures[]
  adjustments: readonly AdjustmentFigures[]
  rules: readonly PayRules[]
  periodEnd: IsoDate
}): Statement
```

Follow spec 7.2 exactly, in whole cents, rounding half up with `roundDiv` at each line:
- Each service uses the rules in force on its own work date (7.1). The split and `cardTipsPaidIn` use the rules on
  `periodEnd`.
- Per-service supply fee counts only services priced above zero and never takes a service below zero. Before the split,
  a service's share is `round((price - fee) * rate)`; after the split it is the saved `commissionCents` and the fee
  comes off the share. Percent fees work the same way with `round(price * bp)` as the fee.
- Card-tip fee is `round(card tips * bp)` per turn, by that turn's rules.
- Salon pays = share + top-up + card tips the salon still holds (card tips not marked received) − card-tip fee +
  adjustments that change pay. Cash tips in hand are never owed by the salon.
- Split (7.3): when `checkBp` is set, the part split is the salon-pays amount, minus the held card tips net of their
  fee when `cardTipsPaidIn` is `check` or `cash` (those go wholly to that part). Check part = `round(part * checkBp)`
  plus held card tips when paid in check; cash is the rest, so the two always add up exactly.
- Earned total = salon pays + tips already in hand + adjustments that do not go through the salon.

## 3. `src/domain/paycheckCheck.ts`

```ts
export interface Received { checkCents: number; cashCents: number; otherCents: number }
export interface Stub { servicesCents: number | null; tipsCents: number | null; deductionsCents: number | null }
export type Reason =
  | { kind: 'servicesLess' | 'servicesMore'; differenceCents: number }
  | { kind: 'deductionsMore' | 'deductionsLess'; differenceCents: number }
  | { kind: 'cardTips'; salonCents: number; yoursCents: number }
  | { kind: 'partShort' | 'partOver'; part: 'check' | 'cash'; differenceCents: number; otherPartMatches: boolean }
export interface CheckResult { kind: 'matches' | 'short' | 'over'; differenceCents: number; reasons: Reason[] }
export function checkPaycheck(statement: Statement, received: Received, stub: Stub | null): CheckResult
```

Matches when the received total is within 100 cents of `salonPaysCents`. Part reasons only when a split is set.
Deductions compare the stub with supply fee + card-tip fee. Blank stub fields give no reason.

## 4. Storage and upgrade

- `db.version(2)` adds `payRules: 'id, startDate'` and `paycheckRecords: 'id, payPeriodId'`. Its `upgrade()` adds one
  `PayRules` from `NO_RULES` starting on the earliest turn's work date (or `2000-01-01` with no turns). The populate
  handler adds the same record for a new install. Do not change version 1.
- `PaycheckRecord` (in `schema.ts`): `id`, `payPeriodId`, `stubServicesCents`, `stubTipsCents`, `stubDeductionsCents`
  (each `number | null`), `note?`, `checkedDate: IsoDate | null`, `createdAt`, `updatedAt`.
- Backup format version 2 carries `payRules` and `paycheckRecords`; a `MIGRATIONS[1]` step upgrades a version 1 backup
  by adding the default rules and no records. Import validates the new records like the others. Delete all data clears
  the new tables too.

## Tests (unit, `tests/unit/`)

- The spec 5.5 statement exactly: 45 services worth $2,500 in total at 60%, a $2 per-service fee before the split, $400
  card tips held at a 3% fee, $300 cash tips in hand, 50/50: services $2,500, fee $90, share $1,446, card-tip fee $12,
  salon pays $1,834, check $917, cash $917, earned $2,134.
- The same with the fee after the split: share $1,500 − $90 = $1,410.
- Rules changing on November 4 inside a Nov 1–7 period: services on Nov 1–3 use the old rules.
- Split of $1,834.01 at 50%: check $917.01, cash $917.00. Card tips paid in check land wholly in the check part.
- A zero-priced service pays no per-service fee.
- `checkPaycheck`: check $917 + cash $877 gives short $40 with the cash part $40 short and the check part matching;
  $1,833.50 total gives matches; stub services $2,388 gives servicesLess $112; stub tips $380 gives cardTips 380/400.
- Database: a version 1 database with turns opens as version 2 with one rules record starting on the first turn's
  date (use `fake-indexeddb`, as the existing database tests do).
- Backup: a version 1 backup file restores and gains the default rules; a version 2 backup round-trips.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2` (nothing on screen should change).
