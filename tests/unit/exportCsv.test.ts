import { describe, expect, it } from 'vitest'
import type { Adjustment, Turn, TurnService } from '../../src/db/schema.ts'
import { localDateTimeToMs } from '../../src/domain/dates.ts'
import { exportCsv } from '../../src/features/backup/exportCsv.ts'

const TURN_ID = 'turn-1'

const at = (date: string, time: string) => localDateTimeToMs(date, time)

function turn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: TURN_ID,
    salonId: 'default',
    occurredAt: at('2026-11-04', '09:30'),
    localWorkDate: '2026-11-04',
    turnCount: 1,
    clientType: 'walkIn',
    cashTipCents: 1000,
    cardTipCents: 1500,
    cashTipReceived: true,
    cardTipReceived: false,
    serviceRevenueTotalCents: 10000,
    commissionTotalCents: 6000,
    earnedTotalCents: 8500,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function service(overrides: Partial<TurnService> = {}): TurnService {
  return {
    id: 'service-1',
    turnId: TURN_ID,
    servicePresetId: 'manicure',
    serviceNameSnapshot: 'Manicure',
    servicePriceCents: 10000,
    commissionRateSnapshotBp: 6000,
    commissionCents: 6000,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function adjustment(overrides: Partial<Adjustment> = {}): Adjustment {
  return {
    id: 'adjustment-1',
    occurredAt: at('2026-11-05', '10:00'),
    localWorkDate: '2026-11-05',
    amountCents: 1250,
    category: 'bonus',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

const body = (csv: string): string[] => csv.slice(1).split('\r\n').slice(1).filter(Boolean)
const cells = (row: string): string[] => row.split(',')

describe('exportCsv', () => {
  it('starts with the byte order mark', () => {
    expect(exportCsv([], [], [], 'en').charCodeAt(0)).toBe(0xfeff)
  })

  it('writes the English header', () => {
    expect(exportCsv([], [], [], 'en').slice(1).split('\r\n')[0]).toMatch(/^Type,Date,Time,Turns,Services/)
  })

  it('writes the Vietnamese header', () => {
    expect(exportCsv([], [], [], 'vi').slice(1).split('\r\n')[0]).toMatch(/^Loại,Ngày,Giờ,Turn,Dịch vụ/)
  })

  it('writes a turn with its money and client type', () => {
    const row = cells(
      body(exportCsv([turn()], [service()], [], 'en'))[0],
    )

    expect(row).toEqual([
      'Turn',
      '2026-11-04',
      '09:30',
      '1',
      'Manicure',
      '100.00',
      '60.00',
      '10.00',
      '15.00',
      '85.00',
      'Walk-in',
      '',
    ])
  })

  it('joins several services in their saved order', () => {
    const services = [
      service({ id: 'b', serviceNameSnapshot: 'Pedicure', sortOrder: 1 }),
      service({ id: 'a', serviceNameSnapshot: 'Gel Manicure', sortOrder: 0 }),
    ]

    expect(body(exportCsv([turn()], services, [], 'en'))[0]).toContain('Gel Manicure + Pedicure')
  })

  it('writes negative money as a plain number, not as protected text', () => {
    const row = cells(body(exportCsv([], [], [adjustment({ amountCents: -500 })], 'en'))[0])

    expect(row[9]).toBe('-5.00')
    expect(row[9].startsWith("'")).toBe(false)
  })

  it('defuses a note a spreadsheet would run as a formula', () => {
    const csv = exportCsv([turn({ note: '=HYPERLINK("x")' })], [service()], [], 'en')

    expect(csv).toContain(`"'=HYPERLINK`)
  })

  it('keeps a comma in a note inside one quoted cell', () => {
    expect(exportCsv([turn({ note: 'a, b' })], [service()], [], 'en')).toContain('"a, b"')
  })

  it('puts the older date first, whichever order it came in', () => {
    const later = turn({ occurredAt: at('2026-11-06', '09:00'), localWorkDate: '2026-11-06' })
    const earlier = adjustment({
      occurredAt: at('2026-11-04', '09:00'),
      localWorkDate: '2026-11-04',
    })

    const rows = body(exportCsv([later], [], [earlier], 'en'))

    expect(rows[0].split(',')[1]).toBe('2026-11-04')
    expect(rows[1].split(',')[1]).toBe('2026-11-06')
  })
})
