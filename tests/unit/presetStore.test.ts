import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type NailDb } from '../../src/db/schema.ts'
import {
  addPreset,
  movePreset,
  removePreset,
  updatePreset,
  type PresetInput,
} from '../../src/features/presets/presetStore.ts'
import { addTurn, type TurnInput } from '../../src/features/turns/turnStore.ts'

let db: NailDb
let counter = 0

function openFresh() {
  db = createDb(`test-${++counter}`)
  return db
}

afterEach(async () => {
  await db.delete()
})

function presetInput(overrides: Partial<PresetInput> = {}): PresetInput {
  return {
    nameEn: '',
    nameVi: '',
    defaultPriceCents: null,
    defaultCommissionRateBp: null,
    ...overrides,
  }
}

function turnInput(overrides: Partial<TurnInput> = {}): TurnInput {
  return {
    occurredAt: 1_800_000_000_000,
    localWorkDate: '2026-11-04',
    turnCount: 1,
    clientType: 'unspecified',
    cashTipCents: 0,
    cardTipCents: 0,
    cashTipReceived: false,
    cardTipReceived: false,
    lines: [{ servicePresetId: null, name: 'Manicure', priceCents: 5000, rateBp: 6000 }],
    ...overrides,
  }
}

async function activeIds(fresh: NailDb): Promise<string[]> {
  const presets = await fresh.servicePresets.orderBy('sortOrder').toArray()
  return presets.filter((preset) => preset.isActive).map((preset) => preset.id)
}

describe('addPreset', () => {
  it('trims the names and appends after the existing order', async () => {
    const fresh = openFresh()

    const id = await addPreset(
      fresh,
      presetInput({ nameEn: ' Polish change ', nameVi: 'Đổi màu' }),
      100,
    )

    expect(await fresh.servicePresets.get(id)).toMatchObject({
      salonId: null,
      nameEn: 'Polish change',
      nameVi: 'Đổi màu',
      defaultPriceCents: null,
      defaultCommissionRateBp: null,
      isCustom: true,
      sortOrder: 11,
      isActive: true,
      createdAt: 100,
      updatedAt: 100,
    })
  })
})

describe('updatePreset', () => {
  it('changes the usual price and updatedAt', async () => {
    const fresh = openFresh()
    const before = await fresh.servicePresets.get('gel-x')

    await updatePreset(
      fresh,
      'gel-x',
      presetInput({ nameEn: 'Gel-X', nameVi: 'Gel-X', defaultPriceCents: 7000 }),
      200,
    )

    const after = await fresh.servicePresets.get('gel-x')
    expect(after).toMatchObject({ defaultPriceCents: 7000 })
    expect(after?.updatedAt).not.toBe(before?.updatedAt)
  })

  it('rejects a preset that does not exist', async () => {
    const fresh = openFresh()

    await expect(updatePreset(fresh, 'missing', presetInput(), 100)).rejects.toThrow(
      'Preset not found',
    )
  })
})

describe('removePreset', () => {
  it('hides the row without deleting it', async () => {
    const fresh = openFresh()

    await removePreset(fresh, 'manicure', 100)

    expect(await fresh.servicePresets.get('manicure')).toMatchObject({
      isActive: false,
      updatedAt: 100,
    })
  })
})

describe('movePreset', () => {
  it('swaps with the preset above', async () => {
    const fresh = openFresh()

    await movePreset(fresh, 'pedicure', -1, 100)

    expect((await activeIds(fresh)).slice(0, 2)).toEqual(['pedicure', 'manicure'])
    expect(await fresh.servicePresets.get('manicure')).toMatchObject({ sortOrder: 2, updatedAt: 100 })
    expect(await fresh.servicePresets.get('pedicure')).toMatchObject({ sortOrder: 1, updatedAt: 100 })
  })

  it('does nothing at the top', async () => {
    const fresh = openFresh()
    const before = await fresh.servicePresets.orderBy('sortOrder').toArray()

    await movePreset(fresh, 'manicure', -1, 100)

    expect(await fresh.servicePresets.orderBy('sortOrder').toArray()).toEqual(before)
  })

  it('skips removed rows', async () => {
    const fresh = openFresh()

    await removePreset(fresh, 'pedicure', 50)
    await movePreset(fresh, 'gel-manicure', -1, 100)

    expect((await activeIds(fresh)).slice(0, 2)).toEqual(['gel-manicure', 'manicure'])
  })
})

describe('preset names on old turns', () => {
  it('keeps the name saved on the turn when the preset is renamed', async () => {
    const fresh = openFresh()
    const turnId = await addTurn(
      fresh,
      turnInput({
        lines: [
          { servicePresetId: 'pedicure', name: 'Pedicure', priceCents: 5000, rateBp: 6000 },
        ],
      }),
      100,
    )

    await updatePreset(
      fresh,
      'pedicure',
      presetInput({ nameEn: 'Spa Pedi', nameVi: 'Spa Pedi', defaultPriceCents: 8000 }),
      200,
    )

    const services = await fresh.turnServices.where('turnId').equals(turnId).toArray()
    expect(services[0].serviceNameSnapshot).toBe('Pedicure')
  })
})
