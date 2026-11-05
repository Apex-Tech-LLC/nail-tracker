# T05: Database tables, seed data and the turn store

- **Branch:** `task/T05-database`
- **Milestone:** M1 Foundation
- **Depends on:** T04
- **Size:** about 45 minutes

## Goal

The database exists with all eight tables and the default services. Saving, changing and deleting a turn works from code and is tested. No screen changes.

## Steps

### 1. Create `src/db/schema.ts`

```ts
import Dexie, { type EntityTable } from 'dexie'
import type { IsoDate } from '../domain/dates.ts'
import type { AdjustmentCategory } from '../domain/totals.ts'
import { DEFAULT_PRESETS, DEFAULT_SALON } from './seed.ts'

export interface Salon {
  id: string
  name: string
  defaultCommissionRateBp: number | null // null: use the rate in Settings
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface ServicePreset {
  id: string
  salonId: string | null
  nameEn: string
  nameVi: string
  defaultPriceCents: number | null
  defaultCommissionRateBp: number | null
  isCustom: boolean
  sortOrder: number
  isActive: boolean // false: removed by the user, kept so old links still resolve
  createdAt: number
  updatedAt: number
}

export type ClientType = 'unspecified' | 'walkIn' | 'request'

export interface Turn {
  id: string // crypto.randomUUID()
  salonId: string | null
  occurredAt: number // UTC milliseconds
  localWorkDate: IsoDate // the work day this belongs to, even past midnight
  turnCount: number
  clientType: ClientType
  note?: string
  cashTipCents: number
  cardTipCents: number
  // Saved on each turn, so changing a setting later never rewrites history.
  cashTipReceived: boolean
  cardTipReceived: boolean
  serviceRevenueTotalCents: number
  commissionTotalCents: number
  earnedTotalCents: number
  createdAt: number
  updatedAt: number
}

export interface TurnService {
  id: string
  turnId: string
  servicePresetId: string | null
  serviceNameSnapshot: string
  servicePriceCents: number
  commissionRateSnapshotBp: number
  commissionCents: number
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface Adjustment {
  id: string
  occurredAt: number
  localWorkDate: IsoDate
  amountCents: number // signed
  category: AdjustmentCategory
  note?: string
  createdAt: number
  updatedAt: number
}

export type PaymentMethod = 'cash' | 'check' | 'directDeposit' | 'zelle' | 'other'

export interface Payment {
  id: string
  paymentDate: IsoDate
  amountCents: number
  paymentMethod: PaymentMethod
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface PaymentAllocation {
  id: string
  paymentId: string
  payPeriodId: string
  amountCents: number
}

export interface PayPeriod {
  id: string
  startDate: IsoDate
  endDate: IsoDate
  status: 'open' | 'closed'
  createdAt: number
  updatedAt: number
}

export type NailDb = Dexie & {
  salons: EntityTable<Salon, 'id'>
  servicePresets: EntityTable<ServicePreset, 'id'>
  turns: EntityTable<Turn, 'id'>
  turnServices: EntityTable<TurnService, 'id'>
  adjustments: EntityTable<Adjustment, 'id'>
  payments: EntityTable<Payment, 'id'>
  paymentAllocations: EntityTable<PaymentAllocation, 'id'>
  payPeriods: EntityTable<PayPeriod, 'id'>
}

/**
 * Opens the database. Each schema change gets a new version() with an
 * upgrade() that converts old data; never edit a released version.
 */
export function createDb(name = 'nail-tracker'): NailDb {
  const db = new Dexie(name) as NailDb

  db.version(1).stores({
    salons: 'id',
    servicePresets: 'id, sortOrder',
    turns: 'id, localWorkDate, occurredAt, updatedAt',
    turnServices: 'id, turnId, serviceNameSnapshot',
    adjustments: 'id, localWorkDate',
    payments: 'id, paymentDate',
    paymentAllocations: 'id, paymentId, payPeriodId',
    payPeriods: 'id, startDate, endDate',
  })

  // Runs once, when the database is first created.
  db.on('populate', (tx) => {
    tx.table('salons').add(DEFAULT_SALON)
    tx.table('servicePresets').bulkAdd(DEFAULT_PRESETS)
  })

  return db
}

export const db = createDb()
```

### 2. Create `src/db/seed.ts`

```ts
import type { Salon, ServicePreset } from './schema.ts'

export const DEFAULT_SALON: Salon = {
  id: 'default',
  name: 'My salon',
  defaultCommissionRateBp: null,
  isActive: true,
  createdAt: 0,
  updatedAt: 0,
}

// Readable, stable ids instead of UUIDs, so a backup from one phone matches
// the presets on another. "Other" is not here: the form always adds that chip.
const NAMES: [id: string, nameEn: string, nameVi: string][] = [
  ['manicure', 'Manicure', 'Làm móng tay'],
  ['pedicure', 'Pedicure', 'Làm móng chân'],
  ['gel-manicure', 'Gel Manicure', 'Sơn gel tay'],
  ['gel-pedicure', 'Gel Pedicure', 'Sơn gel chân'],
  ['gel-x', 'Gel-X', 'Gel-X'],
  ['acrylic-full-set', 'Acrylic Full Set', 'Full set bột'],
  ['acrylic-fill', 'Acrylic Fill', 'Dặm bột'],
  ['dip-powder', 'Dip Powder', 'Bột nhúng (Dip)'],
  ['nail-art', 'Nail Art / Design', 'Vẽ móng / Design'],
  ['removal', 'Removal', 'Tháo móng'],
]

export const DEFAULT_PRESETS: ServicePreset[] = NAMES.map(([id, nameEn, nameVi], index) => ({
  id,
  salonId: null,
  nameEn,
  nameVi,
  defaultPriceCents: null,
  defaultCommissionRateBp: null,
  isCustom: false,
  sortOrder: index + 1,
  isActive: true,
  createdAt: 0,
  updatedAt: 0,
}))
```

### 3. Create `src/features/turns/turnStore.ts`

```ts
import { turnTotals } from '../../domain/commission.ts'
import type { IsoDate } from '../../domain/dates.ts'
import type { Adjustment, ClientType, NailDb, Turn, TurnService } from '../../db/schema.ts'

export interface TurnLineInput {
  servicePresetId: string | null
  name: string
  priceCents: number
  rateBp: number
}

export interface TurnInput {
  occurredAt: number
  localWorkDate: IsoDate
  turnCount: number
  clientType: ClientType
  note?: string
  cashTipCents: number
  cardTipCents: number
  cashTipReceived: boolean
  cardTipReceived: boolean
  lines: TurnLineInput[]
}
```

Add these functions. Every write runs in one transaction:
`db.transaction('rw', db.turns, db.turnServices, async () => { ... })`.

| Function | Behaviour |
|---|---|
| `addTurn(db: NailDb, input: TurnInput, now: number = Date.now()): Promise<string>` | Throws `new Error('A turn needs at least one service')` if `lines` is empty. Works out money with `turnTotals(input.lines.map((l) => ({ priceCents: l.priceCents, rateBp: l.rateBp })), input.cashTipCents, input.cardTipCents)`. Adds one `Turn` with a new `crypto.randomUUID()`, `salonId: 'default'`, `createdAt` and `updatedAt` = `now`. Adds one `TurnService` per line, keeping order in `sortOrder` (0, 1, 2), with `serviceNameSnapshot: line.name.trim()`, `commissionCents` from `lineCommissionCents[i]`. Leaves `note` out if it is empty after trimming. Returns the turn id |
| `updateTurn(db, id: string, input: TurnInput, now = Date.now()): Promise<void>` | Throws the same error on empty lines. Throws `new Error('Turn not found')` if missing. Replaces the turn with new values, keeping `id`, `salonId` and the original `createdAt`, and sets `updatedAt` to `now`. Deletes its old `TurnService` rows (`db.turnServices.where('turnId').equals(id).delete()`) and adds new ones. Use `db.turns.put(...)`, so a removed note really goes away |
| `deleteTurn(db, id: string): Promise<void>` | Deletes the turn and its service rows |
| `loadRange(db, start: IsoDate, end: IsoDate): Promise<{ turns: Turn[]; services: TurnService[]; adjustments: Adjustment[] }>` | Turns with `localWorkDate` between start and end, both included: `db.turns.where('localWorkDate').between(start, end, true, true).toArray()`. Adjustments the same way. Services: `db.turnServices.where('turnId').anyOf(turnIds).toArray()`. Read-only, no transaction needed |
| `servicesByTurn(services: readonly TurnService[]): Map<string, TurnService[]>` | Groups by `turnId`, each list sorted by `sortOrder` |

### 4. Tests

Create `tests/unit/db.test.ts`. Start it like this, then add cases:
```ts
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'

let db: NailDb
let counter = 0

function openFresh() {
  db = createDb(`test-${++counter}`)
  return db
}

afterEach(async () => {
  await db.delete()
})
```
Cases: a new database has 1 salon (id `default`) and 10 presets; `orderBy('sortOrder')` starts with `manicure` and ends with `removal`.

Create `tests/unit/turnStore.test.ts` with the same setup. Build a `TurnInput` with a helper. Cases, with exact values:

| Case | Input | Expected |
|---|---|---|
| Saves money correctly | one line $100 (`10000`) at `6000`, cash `1000`, card `1500` | Turn: revenue `10000`, commission `6000`, earned `8500`. One TurnService with `commissionCents` `6000` and `commissionRateSnapshotBp` `6000` |
| Several services | lines `4000`, `5000`, `1500` at `6000`, card `1500` | commission `6300`, earned `7800`, 3 service rows, `sortOrder` 0, 1, 2 |
| Rejects no services | `lines: []` | `addTurn` rejects, and `db.turns.count()` is 0 |
| Update keeps createdAt | add at `now` 100, update at `now` 200 with a new price | `createdAt` 100, `updatedAt` 200, totals are the new ones, and the old service rows are gone |
| Update removes a note | add with note `'x'`, update with no note | `note` is `undefined` |
| Update of a missing id | | rejects with `Turn not found` |
| Delete | add, then delete | no turn and no service rows left |
| Old turn keeps its rate | add at `6000`, then add another at `5000` | the first turn's `commissionTotalCents` is unchanged |
| loadRange | turns on 2026-11-01, 11-02, 11-03, one adjustment on 11-02 (`db.adjustments.add`) | `loadRange(db, '2026-11-02', '2026-11-03')` gives 2 turns, their services, and the 1 adjustment |

## Files

Create `src/db/schema.ts`, `src/db/seed.ts`, `src/features/turns/turnStore.ts`, `tests/unit/db.test.ts`, `tests/unit/turnStore.test.ts`.

## Done when

- `pnpm exec vitest run tests/unit/db.test.ts tests/unit/turnStore.test.ts --maxWorkers=2` passes.
- `pnpm gate` passes.

## Not in this task

Any screen.
