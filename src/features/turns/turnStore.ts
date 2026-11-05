import { turnTotals, type TurnMoney } from '../../domain/commission.ts'
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

function assertHasLines(input: TurnInput): void {
  if (input.lines.length === 0) throw new Error('A turn needs at least one service')
}

function turnMoney(input: TurnInput): TurnMoney {
  return turnTotals(
    input.lines.map((line) => ({ priceCents: line.priceCents, rateBp: line.rateBp })),
    input.cashTipCents,
    input.cardTipCents,
  )
}

function buildTurn(
  input: TurnInput,
  money: TurnMoney,
  ids: { id: string; salonId: string | null; createdAt: number },
  now: number,
): Turn {
  const note = input.note?.trim()
  return {
    id: ids.id,
    salonId: ids.salonId,
    occurredAt: input.occurredAt,
    localWorkDate: input.localWorkDate,
    turnCount: input.turnCount,
    clientType: input.clientType,
    ...(note ? { note } : {}),
    cashTipCents: input.cashTipCents,
    cardTipCents: input.cardTipCents,
    cashTipReceived: input.cashTipReceived,
    cardTipReceived: input.cardTipReceived,
    serviceRevenueTotalCents: money.serviceRevenueTotalCents,
    commissionTotalCents: money.commissionTotalCents,
    earnedTotalCents: money.earnedTotalCents,
    createdAt: ids.createdAt,
    updatedAt: now,
  }
}

function buildServices(
  turnId: string,
  input: TurnInput,
  lineCommissionCents: readonly number[],
  now: number,
): TurnService[] {
  return input.lines.map((line, index) => ({
    id: crypto.randomUUID(),
    turnId,
    servicePresetId: line.servicePresetId,
    serviceNameSnapshot: line.name.trim(),
    servicePriceCents: line.priceCents,
    commissionRateSnapshotBp: line.rateBp,
    commissionCents: lineCommissionCents[index],
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  }))
}

export async function addTurn(
  db: NailDb,
  input: TurnInput,
  now: number = Date.now(),
): Promise<string> {
  assertHasLines(input)
  const money = turnMoney(input)
  const id = crypto.randomUUID()

  await db.transaction('rw', db.turns, db.turnServices, async () => {
    await db.turns.add(
      buildTurn(input, money, { id, salonId: 'default', createdAt: now }, now),
    )
    await db.turnServices.bulkAdd(buildServices(id, input, money.lineCommissionCents, now))
  })

  return id
}

export async function updateTurn(
  db: NailDb,
  id: string,
  input: TurnInput,
  now: number = Date.now(),
): Promise<void> {
  assertHasLines(input)
  const money = turnMoney(input)

  await db.transaction('rw', db.turns, db.turnServices, async () => {
    const existing = await db.turns.get(id)
    if (!existing) throw new Error('Turn not found')

    await db.turns.put(
      buildTurn(input, money, { id, salonId: existing.salonId, createdAt: existing.createdAt }, now),
    )
    await db.turnServices.where('turnId').equals(id).delete()
    await db.turnServices.bulkAdd(buildServices(id, input, money.lineCommissionCents, now))
  })
}

export async function deleteTurn(db: NailDb, id: string): Promise<void> {
  await db.transaction('rw', db.turns, db.turnServices, async () => {
    await db.turns.delete(id)
    await db.turnServices.where('turnId').equals(id).delete()
  })
}

export async function loadRange(
  db: NailDb,
  start: IsoDate,
  end: IsoDate,
): Promise<{ turns: Turn[]; services: TurnService[]; adjustments: Adjustment[] }> {
  const [turns, adjustments] = await Promise.all([
    db.turns.where('localWorkDate').between(start, end, true, true).toArray(),
    db.adjustments.where('localWorkDate').between(start, end, true, true).toArray(),
  ])
  const services =
    turns.length === 0
      ? []
      : await db.turnServices
          .where('turnId')
          .anyOf(turns.map((turn) => turn.id))
          .toArray()

  return { turns, services, adjustments }
}

export function servicesByTurn(services: readonly TurnService[]): Map<string, TurnService[]> {
  const grouped = new Map<string, TurnService[]>()

  for (const service of services) {
    const group = grouped.get(service.turnId)
    if (group) group.push(service)
    else grouped.set(service.turnId, [service])
  }

  for (const group of grouped.values()) {
    group.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  return grouped
}
