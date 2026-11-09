import { describe, expect, it } from 'vitest'
import type { ServicePreset, Turn, TurnService } from '../../src/db/schema.ts'
import { copiedTurnInput, copiedTurnValues } from '../../src/features/turns/turnInput.ts'

const preset: ServicePreset = {
  id: 'gel-x',
  salonId: null,
  nameEn: 'Gel-X',
  nameVi: 'Gel-X mới',
  defaultPriceCents: 7000,
  defaultCommissionRateBp: 6000,
  isCustom: false,
  sortOrder: 0,
  isActive: true,
  createdAt: 0,
  updatedAt: 0,
}

const source: Turn = {
  id: 'turn-1',
  salonId: 'default',
  occurredAt: 1_700_000_000_000,
  localWorkDate: '2026-11-02',
  turnCount: 2,
  clientType: 'request',
  note: 'bride',
  cashTipCents: 1000,
  cardTipCents: 0,
  cashTipReceived: false,
  cardTipReceived: true,
  serviceRevenueTotalCents: 10_500,
  commissionTotalCents: 5775,
  earnedTotalCents: 6775,
  createdAt: 1,
  updatedAt: 1,
}

function service(overrides: Partial<TurnService>): TurnService {
  return {
    id: 'service-1',
    turnId: 'turn-1',
    servicePresetId: 'gel-x',
    serviceNameSnapshot: 'Old Gel-X name',
    servicePriceCents: 7500,
    commissionRateSnapshotBp: 5500,
    commissionCents: 4125,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

const services = [
  service({}),
  service({
    id: 'service-2',
    servicePresetId: null,
    serviceNameSnapshot: 'Repair',
    servicePriceCents: 3000,
    commissionRateSnapshotBp: 5500,
    commissionCents: 1650,
    sortOrder: 1,
  }),
]

describe('copiedTurnInput', () => {
  it('keeps the services, saved rates, prices, tips and client type, dated the given day', () => {
    const built = copiedTurnInput(source, services, [preset], 'en', '2026-11-04')
    if (!('input' in built)) throw new Error('expected an input')

    expect(built.input).toMatchObject({
      localWorkDate: '2026-11-04',
      turnCount: 2,
      clientType: 'request',
      note: 'bride',
      cashTipCents: 1000,
      cardTipCents: 0,
      cashTipReceived: false,
      cardTipReceived: true,
    })
    // A preset line takes the preset's current name; a custom line keeps its own.
    expect(built.input.lines).toEqual([
      { servicePresetId: 'gel-x', name: 'Gel-X', priceCents: 7500, rateBp: 5500 },
      { servicePresetId: null, name: 'Repair', priceCents: 3000, rateBp: 5500 },
    ])
  })

  it('stamps the copy at the current moment, not the old one', () => {
    const before = Date.now()
    const built = copiedTurnInput(source, services, [preset], 'en', '2026-11-04')
    if (!('input' in built)) throw new Error('expected an input')
    expect(built.input.occurredAt).toBeGreaterThanOrEqual(before)
  })

  it('treats a service whose preset was removed as a custom line with its saved name', () => {
    const values = copiedTurnValues(source, [services[0]], [], '2026-11-04')
    expect(values.lines[0]).toMatchObject({ choice: 'other', customName: 'Old Gel-X name' })
  })

  it('leaves empty tip boxes and an empty note when the turn had none', () => {
    const plain: Turn = { ...source, cashTipCents: 0, note: undefined }
    const values = copiedTurnValues(plain, services, [preset], '2026-11-04')
    expect([values.cashText, values.cardText, values.note, values.time]).toEqual(['', '', '', ''])
  })
})
