import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Settings } from '../../src/app/settings.ts'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import { addAdjustment } from '../../src/features/adjustments/adjustmentStore.ts'
import { backupFileName, type Backup } from '../../src/features/backup/backupFormat.ts'
import { deleteAllData } from '../../src/features/backup/deleteAllData.ts'
import { exportJson } from '../../src/features/backup/exportJson.ts'
import { ImportError } from '../../src/features/backup/importError.ts'
import { importJson } from '../../src/features/backup/importJson.ts'
import { MIGRATIONS, migrateBackup } from '../../src/features/backup/migrateBackup.ts'
import { addPayment } from '../../src/features/payday/paymentStore.ts'
import { addCustomPeriod } from '../../src/features/payday/periodStore.ts'
import { removePreset } from '../../src/features/presets/presetStore.ts'
import { addTurn, updateTurn, type TurnInput } from '../../src/features/turns/turnStore.ts'

const settings: Settings = {
  locale: 'vi',
  theme: 'dark',
  defaultCommissionRateBp: 6250,
  perServiceRates: true,
  weekStartDay: 1,
  payPeriodType: 'weekly',
  payPeriodAnchorDate: '2026-11-01',
  cashTipHandling: 'fromSalon',
  cardTipHandling: 'inHand',
  lastServicePresetId: 'gel-x',
  tipButtonsTarget: 'cash',
  numberPad: true,
  onboardingDone: true,
  sayHowToSeen: true,
  hoursOn: true,
  minimumWageCents: 1650,
  backupReminderDays: 14,
  lastBackupDate: '2026-11-04',
  dismissedReminders: { 'backup:2026-10-01': '2026-11-04' },
  weeklyGoalCents: 100_000,
  monthlyGoalCents: 400_000,
  taxSetAsideBp: 2000,
  learnedWords: { 'joe x': 'gel-x' },
}

const opened: NailDb[] = []
let counter = 0

function openFresh(): NailDb {
  const database = createDb(`backup-test-${++counter}`)
  opened.push(database)
  return database
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((database) => database.delete()))
})

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)

const PERIOD_ID = 'period-2026-11-01-2026-11-07'

function turnInput(overrides: Partial<TurnInput> = {}): TurnInput {
  return {
    occurredAt: 1_800_000_000_000,
    localWorkDate: '2026-11-04',
    turnCount: 1,
    clientType: 'walkIn',
    cashTipCents: 500,
    cardTipCents: 1000,
    cashTipReceived: true,
    cardTipReceived: false,
    lines: [
      { servicePresetId: 'manicure', name: 'Manicure', priceCents: 10000, rateBp: 6000 },
      { servicePresetId: 'gel-x', name: 'Gel-X', priceCents: 4500, rateBp: 6000 },
    ],
    ...overrides,
  }
}

async function seedFull(fresh: NailDb) {
  await addCustomPeriod(fresh, '2026-11-01', '2026-11-07', 1000)
  const turnId = await addTurn(fresh, turnInput({ note: 'first customer' }), 1000)
  await addAdjustment(
    fresh,
    {
      occurredAt: 1_800_000_100_000,
      localWorkDate: '2026-11-05',
      amountCents: 1250,
      category: 'bonus',
      note: 'busy week',
    },
    1000,
  )
  const paymentId = await addPayment(
    fresh,
    {
      paymentDate: '2026-11-08',
      amountCents: 5000,
      paymentMethod: 'zelle',
      notes: 'partial',
      allocations: [{ payPeriodId: PERIOD_ID, amountCents: 5000 }],
    },
    1000,
  )
  return { turnId, paymentId }
}

async function rowCounts(fresh: NailDb) {
  const [
    salons,
    servicePresets,
    turns,
    turnServices,
    adjustments,
    payPeriods,
    payments,
    paymentAllocations,
    payRules,
    paycheckRecords,
    workDays,
  ] = await Promise.all([
    fresh.salons.count(),
    fresh.servicePresets.count(),
    fresh.turns.count(),
    fresh.turnServices.count(),
    fresh.adjustments.count(),
    fresh.payPeriods.count(),
    fresh.payments.count(),
    fresh.paymentAllocations.count(),
    fresh.payRules.count(),
    fresh.paycheckRecords.count(),
    fresh.workDays.count(),
  ])
  return {
    salons,
    servicePresets,
    turns,
    turnServices,
    adjustments,
    payPeriods,
    payments,
    paymentAllocations,
    payRules,
    paycheckRecords,
    workDays,
  }
}

function errorCode(run: () => unknown): string | undefined {
  try {
    run()
    return undefined
  } catch (error) {
    return error instanceof ImportError ? error.code : undefined
  }
}

describe('backupFileName', () => {
  it('puts the day in the name so files sort and never overwrite', () => {
    expect(backupFileName('backup', 'json', '2026-11-04')).toBe('nail-tracker-backup-2026-11-04.json')
    expect(backupFileName('turns', 'csv', '2026-11-04')).toBe('nail-tracker-turns-2026-11-04.csv')
  })
})

describe('exportJson and importJson', () => {
  it('round-trips every table into an empty database', async () => {
    const source = openFresh()
    await seedFull(source)
    const text = await exportJson(source, settings, new Date('2026-11-08T12:00:00Z'))
    expect(JSON.parse(text)).toMatchObject({
      app: 'nail-tracker',
      version: 4,
      exportedAt: '2026-11-08T12:00:00.000Z',
    })

    const copy = openFresh()
    const result = await importJson(copy, text)

    expect(result.added).toBe(4)
    expect(result.settings).toEqual(settings)
    expect((await copy.salons.toArray()).sort(byId)).toEqual(
      (await source.salons.toArray()).sort(byId),
    )
    expect((await copy.servicePresets.toArray()).sort(byId)).toEqual(
      (await source.servicePresets.toArray()).sort(byId),
    )
    expect((await copy.turns.toArray()).sort(byId)).toEqual(
      (await source.turns.toArray()).sort(byId),
    )
    expect((await copy.turnServices.toArray()).sort(byId)).toEqual(
      (await source.turnServices.toArray()).sort(byId),
    )
    expect((await copy.adjustments.toArray()).sort(byId)).toEqual(
      (await source.adjustments.toArray()).sort(byId),
    )
    expect((await copy.payPeriods.toArray()).sort(byId)).toEqual(
      (await source.payPeriods.toArray()).sort(byId),
    )
    expect((await copy.payments.toArray()).sort(byId)).toEqual(
      (await source.payments.toArray()).sort(byId),
    )
    expect((await copy.paymentAllocations.toArray()).sort(byId)).toEqual(
      (await source.paymentAllocations.toArray()).sort(byId),
    )
    expect((await copy.payRules.toArray()).sort(byId)).toEqual(
      (await source.payRules.toArray()).sort(byId),
    )
    expect((await copy.paycheckRecords.toArray()).sort(byId)).toEqual(
      (await source.paycheckRecords.toArray()).sort(byId),
    )
    expect(await copy.workDays.toArray()).toEqual(await source.workDays.toArray())
  })

  it('restores an older backup with no theme as the phone choice', async () => {
    const source = openFresh()
    await seedFull(source)
    const old = JSON.parse(await exportJson(source, settings)) as Record<string, unknown>
    delete (old.settings as Record<string, unknown>).theme

    const copy = openFresh()
    const result = await importJson(copy, JSON.stringify(old))

    expect(result.settings).toMatchObject({ locale: 'vi', theme: 'system' })
    expect(await copy.turns.count()).toBe(1)
  })

  it('round-trips work days, including a day off', async () => {
    const source = openFresh()
    await source.workDays.put({
      date: '2026-11-08',
      dayOff: true,
      startTime: null,
      endTime: null,
      createdAt: 700,
      updatedAt: 700,
    })
    const text = await exportJson(source, settings)

    const copy = openFresh()
    await importJson(copy, text)

    expect(await copy.workDays.get('2026-11-08')).toEqual({
      date: '2026-11-08',
      dayOff: true,
      startTime: null,
      endTime: null,
      createdAt: 700,
      updatedAt: 700,
    })
  })

  it('adds nothing when the same file is restored a second time', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const text = await exportJson(fresh, settings)
    const before = await rowCounts(fresh)

    const result = await importJson(fresh, text)

    expect(result).toMatchObject({ added: 0, updated: 0, settings: null })
    expect(await rowCounts(fresh)).toEqual(before)
  })

  it('keeps the copy edited on this phone when the file is older', async () => {
    const fresh = openFresh()
    const turnId = await addTurn(fresh, turnInput(), 1000)
    const text = await exportJson(fresh, settings)
    await updateTurn(
      fresh,
      turnId,
      turnInput({
        lines: [{ servicePresetId: null, name: 'Gel-X', priceCents: 20000, rateBp: 6000 }],
      }),
      2000,
    )

    const result = await importJson(fresh, text)

    expect((await fresh.turns.get(turnId))?.serviceRevenueTotalCents).toBe(20000)
    expect(result.updated).toBe(0)
    expect(result.unchanged).toBeGreaterThan(0)
  })

  it('takes the file copy when it was edited later, with its services only', async () => {
    const fresh = openFresh()
    const turnId = await addTurn(fresh, turnInput(), 1000)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.turns = data.turns.map((turn) =>
      turn.id === turnId ? { ...turn, updatedAt: turn.updatedAt + 1000, cashTipCents: 999 } : turn,
    )
    data.turnServices = data.turnServices.map((service) =>
      service.turnId === turnId ? { ...service, id: `file-${service.id}`, servicePriceCents: 1 } : service,
    )

    const result = await importJson(fresh, JSON.stringify(data))

    expect(result.updated).toBe(1)
    expect((await fresh.turns.get(turnId))?.cashTipCents).toBe(999)
    const saved = await fresh.turnServices.where('turnId').equals(turnId).toArray()
    expect(saved.map((service) => service.id).sort()).toEqual(
      data.turnServices
        .filter((service) => service.turnId === turnId)
        .map((service) => service.id)
        .sort(),
    )
    expect(saved.every((service) => service.id.startsWith('file-'))).toBe(true)
  })

  it('restores a version 2 backup with no work days', async () => {
    const source = openFresh()
    await seedFull(source)
    const old = JSON.parse(await exportJson(source, settings)) as Record<string, unknown>
    old.version = 2
    delete old.workDays

    const copy = openFresh()
    await importJson(copy, JSON.stringify(old))

    expect(copy.verno).toBe(4)
    expect(await copy.workDays.count()).toBe(0)
    expect(await copy.turns.count()).toBe(1)
  })

  it('refuses a work day with an impossible date', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.workDays = [
      {
        date: '2026-02-30',
        dayOff: true,
        startTime: null,
        endTime: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ]

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'invalidRecord',
    })
  })

  it('refuses a work day time that is not HH:MM', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.workDays = [
      {
        date: '2026-11-08',
        dayOff: false,
        startTime: '9am',
        endTime: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ]

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'invalidRecord',
    })
  })

  it('restores a version 1 backup and gives it the default rules', async () => {
    const source = openFresh()
    await seedFull(source)
    const old = JSON.parse(await exportJson(source, settings)) as Record<string, unknown>
    old.version = 1
    delete old.payRules
    delete old.paycheckRecords

    const copy = openFresh()
    await importJson(copy, JSON.stringify(old))

    const rules = await copy.payRules.toArray()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({ id: 'default', startDate: '2026-11-04' })
    expect(await copy.paycheckRecords.count()).toBe(0)
  })

  it('round-trips pay rules and paycheck records', async () => {
    const source = openFresh()
    await seedFull(source)
    await source.payRules.put({
      id: 'november',
      startDate: '2026-11-04',
      supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' },
      cardTipFeeBp: 300,
      checkBp: 5000,
      cardTipsPaidIn: 'split',
      guarantee: { kind: 'perDay', cents: 15_000, minDays: 5 },
      tiers: {
        mode: 'eachPart',
        levels: [
          { fromCents: 0, rateBp: 5000 },
          { fromCents: 50_000, rateBp: 5500 },
          { fromCents: 100_000, rateBp: 6500 },
        ],
      },
      createdAt: 500,
      updatedAt: 500,
    })
    await source.paycheckRecords.put({
      id: 'check-1',
      payPeriodId: PERIOD_ID,
      stubServicesCents: 238_800,
      stubTipsCents: 38_000,
      stubDeductionsCents: 10_200,
      note: 'owner sheet',
      checkedDate: '2026-11-08',
      createdAt: 600,
      updatedAt: 600,
    })
    const text = await exportJson(source, settings)

    const copy = openFresh()
    const result = await importJson(copy, text)

    expect(result.added).toBe(6)
    expect(await copy.payRules.get('november')).toMatchObject({
      startDate: '2026-11-04',
      supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' },
      cardTipFeeBp: 300,
      checkBp: 5000,
      guarantee: { kind: 'perDay', cents: 15_000, minDays: 5 },
      tiers: {
        mode: 'eachPart',
        levels: [
          { fromCents: 0, rateBp: 5000 },
          { fromCents: 50_000, rateBp: 5500 },
          { fromCents: 100_000, rateBp: 6500 },
        ],
      },
    })
    expect(await copy.paycheckRecords.get('check-1')).toMatchObject({
      payPeriodId: PERIOD_ID,
      stubServicesCents: 238_800,
      stubTipsCents: 38_000,
      stubDeductionsCents: 10_200,
      note: 'owner sheet',
      checkedDate: '2026-11-08',
    })
  })
})

describe('importJson refuses a bad file', () => {
  it('refuses text that is not JSON and writes nothing', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const before = await rowCounts(fresh)

    await expect(importJson(fresh, '{')).rejects.toMatchObject({ code: 'notJson' })

    expect(await rowCounts(fresh)).toEqual(before)
  })

  it('refuses JSON that is not a Nail Tracker backup', async () => {
    const fresh = openFresh()
    await expect(importJson(fresh, '{"app":"other-app","version":1}')).rejects.toMatchObject({
      code: 'notBackup',
    })
  })

  it('refuses a file missing a table', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Partial<Backup>
    delete data.turns
    const before = await rowCounts(fresh)

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'notBackup',
    })
    expect(await rowCounts(fresh)).toEqual(before)
  })

  it('refuses a file from a newer app version', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.version = 5

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'unsupportedVersion',
    })
  })

  it('refuses money that is not whole cents and writes nothing', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.turns = data.turns.map((turn) => ({ ...turn, cashTipCents: 1.5 }))
    const before = await rowCounts(fresh)

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'invalidRecord',
    })
    expect(await rowCounts(fresh)).toEqual(before)
  })

  it('refuses an impossible work date', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.turns = data.turns.map((turn) => ({ ...turn, localWorkDate: '2026-02-30' }))

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'invalidRecord',
    })
  })

  it('refuses two records with the same id', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.turns = [...data.turns, ...data.turns]

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'invalidRecord',
    })
  })

  it('refuses a service whose turn is not in the file', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.turnServices = data.turnServices.map((service) => ({ ...service, turnId: 'missing' }))

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'invalidRecord',
    })
  })

  it('refuses a tier table that does not start at zero', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.payRules = data.payRules.map((rule) => ({
      ...rule,
      tiers: {
        mode: 'eachPart',
        levels: [
          { fromCents: 100, rateBp: 5000 },
          { fromCents: 50_000, rateBp: 6500 },
        ],
      },
    }))

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'invalidRecord',
    })
  })

  it('refuses tier levels that do not rise', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.payRules = data.payRules.map((rule) => ({
      ...rule,
      tiers: {
        mode: 'wholeAtTop',
        levels: [
          { fromCents: 0, rateBp: 5000 },
          { fromCents: 0, rateBp: 6500 },
        ],
      },
    }))

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'invalidRecord',
    })
  })

  it('refuses a guarantee amount that is not whole cents', async () => {
    const fresh = openFresh()
    await seedFull(fresh)
    const data = JSON.parse(await exportJson(fresh, settings)) as Backup
    data.payRules = data.payRules.map((rule) => ({
      ...rule,
      guarantee: { kind: 'perDay', cents: 15_000.5, minDays: null },
    }))

    await expect(importJson(fresh, JSON.stringify(data))).rejects.toMatchObject({
      code: 'invalidRecord',
    })
  })
})

describe('deleteAllData', () => {
  it('empties every record and puts the first-launch salon and presets back', async () => {
    const fresh = openFresh()
    await addTurn(fresh, turnInput(), 1000)
    await removePreset(fresh, 'manicure')
    await fresh.workDays.put({
      date: '2026-11-08',
      dayOff: true,
      startTime: null,
      endTime: null,
      createdAt: 1,
      updatedAt: 1,
    })
    await fresh.paycheckRecords.put({
      id: 'check-1',
      payPeriodId: PERIOD_ID,
      stubServicesCents: null,
      stubTipsCents: null,
      stubDeductionsCents: null,
      checkedDate: null,
      createdAt: 1,
      updatedAt: 1,
    })

    await deleteAllData(fresh)

    expect(await fresh.turns.count()).toBe(0)
    expect(await fresh.turnServices.count()).toBe(0)
    expect(await fresh.salons.count()).toBe(1)
    expect(await fresh.paycheckRecords.count()).toBe(0)
    expect(await fresh.workDays.count()).toBe(0)
    expect(await fresh.payRules.count()).toBe(1)
    const presets = await fresh.servicePresets.toArray()
    expect(presets).toHaveLength(10)
    expect(presets.every((preset) => preset.isActive)).toBe(true)
  })
})

describe('migrateBackup', () => {
  it('runs each step in order and sets the version', () => {
    expect(
      migrateBackup({ version: 1, a: 1 }, 3, {
        1: (data) => ({ ...data, b: 2 }),
        2: (data) => ({ ...data, c: 3 }),
      }),
    ).toEqual({ version: 3, a: 1, b: 2, c: 3 })
  })

  it('refuses a gap in the upgrade chain', () => {
    expect(
      errorCode(() => migrateBackup({ version: 1, a: 1 }, 3, { 1: (data) => ({ ...data, b: 2 }) })),
    ).toBe('unsupportedVersion')
  })

  it.each([0, -1, 1.5, '1', undefined, null])('refuses version %j', (version) => {
    expect(errorCode(() => migrateBackup({ version }, 1, {}))).toBe('notBackup')
  })

  it('refuses a version newer than the app knows', () => {
    expect(errorCode(() => migrateBackup({ version: 5 }))).toBe('unsupportedVersion')
  })

  it('adds an empty work day list when upgrading a version 2 backup', () => {
    expect(MIGRATIONS[2]({ version: 2 })).toEqual({ version: 2, workDays: [] })
    expect(migrateBackup({ version: 2, turns: [] })).toEqual({
      version: 4,
      turns: [],
      workDays: [],
      payRules: [],
    })
  })

  it('turns guarantee and tiers off when upgrading a version 3 backup', () => {
    const rule = {
      id: 'rules',
      startDate: '2026-11-01',
      supplyFee: { kind: 'none' },
      cardTipFeeBp: 0,
      checkBp: null,
      cardTipsPaidIn: 'split',
      createdAt: 1,
      updatedAt: 1,
    }

    expect(MIGRATIONS[3]({ version: 3, payRules: [rule] })).toEqual({
      version: 3,
      payRules: [{ ...rule, guarantee: { kind: 'none' }, tiers: null }],
    })
    expect(migrateBackup({ version: 3, payRules: [rule] })).toEqual({
      version: 4,
      payRules: [{ ...rule, guarantee: { kind: 'none' }, tiers: null }],
    })
  })

  it('never changes the object it is given', () => {
    const input: Record<string, unknown> = { version: 1, a: 1 }

    migrateBackup(input, 2, { 1: (data) => ({ ...data, b: 2 }) })

    expect(input).toEqual({ version: 1, a: 1 })
  })
})
