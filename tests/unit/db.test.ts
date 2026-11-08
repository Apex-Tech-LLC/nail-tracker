import 'fake-indexeddb/auto'
import Dexie from 'dexie'
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

describe('seeded database', () => {
  it('starts with the default salon and ten service presets', async () => {
    const fresh = openFresh()

    expect(await fresh.salons.get('default')).toMatchObject({
      id: 'default',
      isActive: true,
      defaultCommissionRateBp: null,
    })
    expect(await fresh.servicePresets.count()).toBe(10)
  })

  it('starts with one default pay rules record', async () => {
    const fresh = openFresh()

    const rules = await fresh.payRules.toArray()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({
      id: 'default',
      startDate: '2000-01-01',
      supplyFee: { kind: 'none' },
      cardTipFeeBp: 0,
      checkBp: null,
      cardTipsPaidIn: 'split',
    })
  })

  it('orders presets from manicure to removal', async () => {
    const fresh = openFresh()
    const presets = await fresh.servicePresets.orderBy('sortOrder').toArray()

    expect(presets[0].id).toBe('manicure')
    expect(presets.at(-1)?.id).toBe('removal')
    expect(presets.map((preset) => preset.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('version 3 upgrade', () => {
  it('opens a version 2 database as version 3 and keeps its data', async () => {
    const name = `upgrade-v3-${++counter}`
    const old = new Dexie(name)
    old.version(1).stores({
      salons: 'id',
      servicePresets: 'id, sortOrder',
      turns: 'id, localWorkDate, occurredAt, updatedAt',
      turnServices: 'id, turnId, serviceNameSnapshot',
      adjustments: 'id, localWorkDate',
      payments: 'id, paymentDate',
      paymentAllocations: 'id, paymentId, payPeriodId',
      payPeriods: 'id, startDate, endDate',
    })
    old.version(2).stores({
      payRules: 'id, startDate',
      paycheckRecords: 'id, payPeriodId',
    })
    await old.open()
    await old.table('turns').add({ id: 'kept', localWorkDate: '2026-11-04' })
    await old.table('payRules').add({ id: 'rules', startDate: '2026-11-01' })
    old.close()

    const fresh = createDb(name)
    db = fresh

    expect(fresh.verno).toBe(3)
    expect(await fresh.turns.count()).toBe(1)
    expect(await fresh.payRules.count()).toBe(1)
    expect(await fresh.workDays.count()).toBe(0)

    await fresh.workDays.put({
      date: '2026-11-08',
      dayOff: true,
      startTime: null,
      endTime: null,
      createdAt: 1,
      updatedAt: 1,
    })
    expect(await fresh.workDays.get('2026-11-08')).toMatchObject({ dayOff: true })
  })
})

describe('version 2 upgrade', () => {
  it('adds one rules record starting on the first turn work date', async () => {
    const name = `upgrade-test-${++counter}`
    const old = new Dexie(name)
    old.version(1).stores({
      salons: 'id',
      servicePresets: 'id, sortOrder',
      turns: 'id, localWorkDate, occurredAt, updatedAt',
      turnServices: 'id, turnId, serviceNameSnapshot',
      adjustments: 'id, localWorkDate',
      payments: 'id, paymentDate',
      paymentAllocations: 'id, paymentId, payPeriodId',
      payPeriods: 'id, startDate, endDate',
    })
    await old.table('turns').add({ id: 'later', localWorkDate: '2026-11-04' })
    await old.table('turns').add({ id: 'earliest', localWorkDate: '2026-10-30' })
    old.close()

    const fresh = createDb(name)
    db = fresh

    const rules = await fresh.payRules.toArray()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({ id: 'default', startDate: '2026-10-30' })
    expect(await fresh.turns.count()).toBe(2)
  })

  it('starts the rules at 2000-01-01 when there are no turns', async () => {
    const name = `upgrade-empty-${++counter}`
    const old = new Dexie(name)
    old.version(1).stores({
      salons: 'id',
      servicePresets: 'id, sortOrder',
      turns: 'id, localWorkDate, occurredAt, updatedAt',
      turnServices: 'id, turnId, serviceNameSnapshot',
      adjustments: 'id, localWorkDate',
      payments: 'id, paymentDate',
      paymentAllocations: 'id, paymentId, payPeriodId',
      payPeriods: 'id, startDate, endDate',
    })
    await old.table('salons').add({ id: 'default', name: 'My salon' })
    old.close()

    const fresh = createDb(name)
    db = fresh

    expect(await fresh.payRules.get('default')).toMatchObject({ startDate: '2000-01-01' })
  })
})
