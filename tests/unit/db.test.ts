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

  it('orders presets from manicure to removal', async () => {
    const fresh = openFresh()
    const presets = await fresh.servicePresets.orderBy('sortOrder').toArray()

    expect(presets[0].id).toBe('manicure')
    expect(presets.at(-1)?.id).toBe('removal')
    expect(presets.map((preset) => preset.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})
