import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import {
  addAdjustment,
  deleteAdjustment,
  updateAdjustment,
  type AdjustmentInput,
} from '../../src/features/adjustments/adjustmentStore.ts'

let db: NailDb
let counter = 0

function openFresh() {
  db = createDb(`test-${++counter}`)
  return db
}

afterEach(async () => {
  await db.delete()
})

function adjustmentInput(overrides: Partial<AdjustmentInput> = {}): AdjustmentInput {
  return {
    occurredAt: 1_800_000_000_000,
    localWorkDate: '2026-11-04',
    amountCents: -2500,
    category: 'tipCorrection',
    ...overrides,
  }
}

describe('addAdjustment', () => {
  it('saves a signed amount and leaves an empty note out', async () => {
    const fresh = openFresh()
    const id = await addAdjustment(fresh, adjustmentInput({ note: '' }), 100)

    const saved = await fresh.adjustments.get(id)
    expect(saved).toMatchObject({
      occurredAt: 1_800_000_000_000,
      localWorkDate: '2026-11-04',
      amountCents: -2500,
      category: 'tipCorrection',
      createdAt: 100,
      updatedAt: 100,
    })
    expect(saved?.note).toBeUndefined()
  })

  it('rejects zero and saves nothing', async () => {
    const fresh = openFresh()

    await expect(addAdjustment(fresh, adjustmentInput({ amountCents: 0 }))).rejects.toThrow(
      'An adjustment cannot be zero',
    )
    expect(await fresh.adjustments.count()).toBe(0)
  })
})

describe('updateAdjustment', () => {
  it('keeps createdAt and updates the amount', async () => {
    const fresh = openFresh()
    const id = await addAdjustment(fresh, adjustmentInput(), 100)

    await updateAdjustment(
      fresh,
      id,
      adjustmentInput({ amountCents: 2000, category: 'bonus' }),
      200,
    )

    expect(await fresh.adjustments.get(id)).toMatchObject({
      amountCents: 2000,
      category: 'bonus',
      createdAt: 100,
      updatedAt: 200,
    })
  })

  it('rejects an adjustment that does not exist', async () => {
    const fresh = openFresh()

    await expect(updateAdjustment(fresh, 'missing', adjustmentInput())).rejects.toThrow(
      'Adjustment not found',
    )
  })
})

describe('deleteAdjustment', () => {
  it('removes the adjustment', async () => {
    const fresh = openFresh()
    const id = await addAdjustment(fresh, adjustmentInput(), 100)

    await deleteAdjustment(fresh, id)

    expect(await fresh.adjustments.count()).toBe(0)
  })
})
