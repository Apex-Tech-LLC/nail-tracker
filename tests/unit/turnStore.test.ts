import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import {
  addTurn,
  deleteTurn,
  loadRange,
  servicesByTurn,
  updateTurn,
  type TurnInput,
} from '../../src/features/turns/turnStore.ts'

let db: NailDb
let counter = 0

function openFresh() {
  db = createDb(`test-${++counter}`)
  return db
}

afterEach(async () => {
  await db.delete()
})

function line(priceCents: number, rateBp: number) {
  return {
    servicePresetId: null,
    name: 'Manicure',
    priceCents,
    rateBp,
  }
}

function turnInput(overrides: Partial<TurnInput> = {}): TurnInput {
  return {
    occurredAt: 1_800_000_000_000,
    localWorkDate: '2026-11-04',
    turnCount: 1,
    clientType: 'walkIn',
    cashTipCents: 0,
    cardTipCents: 0,
    cashTipReceived: false,
    cardTipReceived: false,
    lines: [line(10000, 6000)],
    ...overrides,
  }
}

describe('addTurn', () => {
  it('saves money correctly', async () => {
    const fresh = openFresh()
    const id = await addTurn(
      fresh,
      turnInput({
        lines: [{ ...line(10000, 6000), name: ' Manicure ', servicePresetId: 'manicure' }],
        cashTipCents: 1000,
        cardTipCents: 1500,
      }),
      100,
    )

    expect(await fresh.turns.get(id)).toMatchObject({
      salonId: 'default',
      occurredAt: 1_800_000_000_000,
      localWorkDate: '2026-11-04',
      turnCount: 1,
      clientType: 'walkIn',
      cashTipCents: 1000,
      cardTipCents: 1500,
      cashTipReceived: false,
      cardTipReceived: false,
      serviceRevenueTotalCents: 10000,
      commissionTotalCents: 6000,
      earnedTotalCents: 8500,
      createdAt: 100,
      updatedAt: 100,
    })

    const services = await fresh.turnServices.where('turnId').equals(id).toArray()
    expect(services).toHaveLength(1)
    expect(services[0]).toMatchObject({
      turnId: id,
      servicePresetId: 'manicure',
      serviceNameSnapshot: 'Manicure',
      servicePriceCents: 10000,
      commissionRateSnapshotBp: 6000,
      commissionCents: 6000,
      sortOrder: 0,
    })
  })

  it('adds several services in order', async () => {
    const fresh = openFresh()
    const id = await addTurn(
      fresh,
      turnInput({
        lines: [line(4000, 6000), line(5000, 6000), line(1500, 6000)],
        cardTipCents: 1500,
      }),
      100,
    )

    expect(await fresh.turns.get(id)).toMatchObject({
      serviceRevenueTotalCents: 10500,
      commissionTotalCents: 6300,
      earnedTotalCents: 7800,
    })

    const services = await fresh.turnServices.where('turnId').equals(id).toArray()
    expect(services).toHaveLength(3)
    expect(servicesByTurn(services).get(id)?.map((service) => service.sortOrder)).toEqual([0, 1, 2])
    expect(servicesByTurn([...services].reverse()).get(id)?.map((service) => service.sortOrder)).toEqual([
      0, 1, 2,
    ])
  })

  it('rejects a turn with no services', async () => {
    const fresh = openFresh()

    await expect(addTurn(fresh, turnInput({ lines: [] }))).rejects.toThrow(
      'A turn needs at least one service',
    )
    expect(await fresh.turns.count()).toBe(0)
  })

  it('keeps the rate each turn was saved with', async () => {
    const fresh = openFresh()
    const firstId = await addTurn(fresh, turnInput({ lines: [line(10000, 6000)] }), 100)
    const secondId = await addTurn(fresh, turnInput({ lines: [line(10000, 5000)] }), 200)

    expect((await fresh.turns.get(firstId))?.commissionTotalCents).toBe(6000)
    expect((await fresh.turns.get(secondId))?.commissionTotalCents).toBe(5000)
    expect((await fresh.turnServices.where('turnId').equals(firstId).toArray())[0]).toMatchObject({
      commissionRateSnapshotBp: 6000,
    })
  })
})

describe('updateTurn', () => {
  it('keeps createdAt and replaces the service rows', async () => {
    const fresh = openFresh()
    const id = await addTurn(
      fresh,
      turnInput({ lines: [line(10000, 6000)], note: 'first' }),
      100,
    )
    const oldServices = await fresh.turnServices.where('turnId').equals(id).toArray()

    await updateTurn(
      fresh,
      id,
      turnInput({ lines: [line(20000, 5000)], note: 'updated' }),
      200,
    )

    expect(await fresh.turns.get(id)).toMatchObject({
      createdAt: 100,
      updatedAt: 200,
      note: 'updated',
      serviceRevenueTotalCents: 20000,
      commissionTotalCents: 10000,
      earnedTotalCents: 10000,
    })

    const newServices = await fresh.turnServices.where('turnId').equals(id).toArray()
    expect(newServices).toHaveLength(1)
    expect(newServices[0].id).not.toBe(oldServices[0].id)
    expect(newServices[0]).toMatchObject({ servicePriceCents: 20000, commissionCents: 10000 })
    expect(await fresh.turnServices.get(oldServices[0].id)).toBeUndefined()
  })

  it('removes a note that was cleared', async () => {
    const fresh = openFresh()
    const id = await addTurn(fresh, turnInput({ note: 'x' }), 100)

    await updateTurn(fresh, id, turnInput(), 200)

    expect((await fresh.turns.get(id))?.note).toBeUndefined()
  })

  it('rejects a turn that does not exist', async () => {
    const fresh = openFresh()

    await expect(updateTurn(fresh, 'missing', turnInput())).rejects.toThrow('Turn not found')
  })
})

describe('deleteTurn', () => {
  it('removes the turn and its service rows', async () => {
    const fresh = openFresh()
    const id = await addTurn(fresh, turnInput(), 100)

    await deleteTurn(fresh, id)

    expect(await fresh.turns.count()).toBe(0)
    expect(await fresh.turnServices.count()).toBe(0)
  })
})

describe('loadRange', () => {
  it('loads the turns, their services and the adjustments in the range', async () => {
    const fresh = openFresh()
    const dayOne = await addTurn(fresh, turnInput({ localWorkDate: '2026-11-01', occurredAt: 1 }), 1)
    const dayTwo = await addTurn(fresh, turnInput({ localWorkDate: '2026-11-02', occurredAt: 2 }), 2)
    const dayThree = await addTurn(
      fresh,
      turnInput({ localWorkDate: '2026-11-03', occurredAt: 3 }),
      3,
    )
    await fresh.adjustments.add({
      id: 'adj-1',
      occurredAt: 4,
      localWorkDate: '2026-11-02',
      amountCents: 250,
      category: 'bonus',
      createdAt: 4,
      updatedAt: 4,
    })

    const range = await loadRange(fresh, '2026-11-02', '2026-11-03')

    expect(range.turns.map((turn) => turn.id)).not.toContain(dayOne)
    expect(range.turns.map((turn) => turn.id).sort()).toEqual([dayTwo, dayThree].sort())
    expect(range.services).toHaveLength(2)
    expect(servicesByTurn(range.services).get(dayTwo)).toHaveLength(1)
    expect(servicesByTurn(range.services).get(dayThree)).toHaveLength(1)
    expect(range.adjustments.map((adjustment) => adjustment.id)).toEqual(['adj-1'])
  })
})
