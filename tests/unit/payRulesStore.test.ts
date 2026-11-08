import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import {
  deletePayRules,
  savePayRules,
  type PayRulesValues,
} from '../../src/features/payRules/payRulesStore.ts'

const VALUES: PayRulesValues = {
  supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' },
  cardTipFeeBp: 300,
  checkBp: 5000,
  cardTipsPaidIn: 'split',
  guarantee: { kind: 'none' },
  tiers: null,
}

let db: NailDb
let counter = 0

function openFresh() {
  db = createDb(`test-pay-rules-${++counter}`)
  return db
}

/** The one rule a fresh database is seeded with. */
async function seededRule(fresh: NailDb) {
  const [rule] = await fresh.payRules.toArray()
  return rule
}

afterEach(async () => {
  await db.delete()
})

describe('savePayRules', () => {
  it('adds a rule and replaces one that starts on the same day', async () => {
    const fresh = openFresh()
    const seeded = await seededRule(fresh)

    const firstId = await savePayRules(fresh, VALUES, '2026-11-04', 1)
    expect(await fresh.payRules.count()).toBe(2)
    expect(await fresh.payRules.get(firstId)).toMatchObject({
      startDate: '2026-11-04',
      ...VALUES,
    })

    const secondId = await savePayRules(
      fresh,
      { ...VALUES, cardTipFeeBp: 500 },
      '2026-11-04',
      2,
    )
    expect(secondId).toBe(firstId)
    expect(await fresh.payRules.count()).toBe(2)
    expect((await fresh.payRules.get(firstId))?.cardTipFeeBp).toBe(500)
    expect(await fresh.payRules.get(seeded.id)).toMatchObject({ cardTipFeeBp: 0 })
  })

  it('leaves a rule on another day alone', async () => {
    const fresh = openFresh()
    const seeded = await seededRule(fresh)

    await savePayRules(fresh, VALUES, '2026-11-04', 1)

    expect(await fresh.payRules.get(seeded.id)).toMatchObject({ cardTipFeeBp: 0 })
  })
})

describe('deletePayRules', () => {
  it('keeps the only rule and deletes an extra one', async () => {
    const fresh = openFresh()
    const only = await seededRule(fresh)

    expect(await deletePayRules(fresh, only.id)).toBe(false)
    expect(await fresh.payRules.count()).toBe(1)

    const secondId = await savePayRules(fresh, VALUES, '2026-11-04', 2)
    expect(await deletePayRules(fresh, secondId)).toBe(true)
    expect(await fresh.payRules.count()).toBe(1)
  })
})
