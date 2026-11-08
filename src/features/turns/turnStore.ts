import { turnTotals, type TurnMoney } from '../../domain/commission.ts'
import { addDays, type IsoDate } from '../../domain/dates.ts'
import type { QuickPickEntry } from '../../domain/quickPicks.ts'
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

/** Saves every input or none of them: one transaction round all the adds. */
export async function addTurns(
  db: NailDb,
  inputs: readonly TurnInput[],
  now: number = Date.now(),
): Promise<string[]> {
  return db.transaction('rw', db.turns, db.turnServices, async () => {
    const ids: string[] = []
    for (const input of inputs) ids.push(await addTurn(db, input, now))
    return ids
  })
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

export interface RemovedTurn {
  turn: Turn
  services: TurnService[]
}

/** Removes a turn and hands back the exact rows, so Undo can put them back. */
export async function deleteTurn(db: NailDb, id: string): Promise<RemovedTurn | null> {
  return db.transaction('rw', db.turns, db.turnServices, async () => {
    const turn = await db.turns.get(id)
    if (!turn) return null

    const services = await db.turnServices.where('turnId').equals(id).toArray()
    await db.turns.delete(id)
    await db.turnServices.where('turnId').equals(id).delete()
    return { turn, services }
  })
}

/** Puts back the rows deleteTurn removed, with their original ids. */
export async function restoreTurn(db: NailDb, removed: RemovedTurn): Promise<void> {
  await db.transaction('rw', db.turns, db.turnServices, async () => {
    await db.turns.put(removed.turn)
    await db.turnServices.bulkPut(removed.services)
  })
}

/** One indexed range read of turns and adjustments, for screens that never show service names. */
export async function loadTurnDates(
  db: NailDb,
  start: IsoDate,
  end: IsoDate,
): Promise<{ turns: Turn[]; adjustments: Adjustment[] }> {
  const [turns, adjustments] = await Promise.all([
    db.turns.where('localWorkDate').between(start, end, true, true).toArray(),
    db.adjustments.where('localWorkDate').between(start, end, true, true).toArray(),
  ])
  return { turns, adjustments }
}

export async function loadRange(
  db: NailDb,
  start: IsoDate,
  end: IsoDate,
): Promise<{ turns: Turn[]; services: TurnService[]; adjustments: Adjustment[] }> {
  const { turns, adjustments } = await loadTurnDates(db, start, end)
  const services = await loadTurnServices(
    db,
    turns.map((turn) => turn.id),
  )

  return { turns, services, adjustments }
}

/**
 * The service lines for these turns. One index lookup per turn id is quick for
 * a day or a month; over a long range a single scan of the whole table is
 * quicker, because tens of thousands of lookups add up.
 */
export async function loadTurnServices(
  db: NailDb,
  turnIds: readonly string[],
): Promise<TurnService[]> {
  if (turnIds.length === 0) return []
  if (turnIds.length < 1000) {
    return db.turnServices.where('turnId').anyOf([...turnIds]).toArray()
  }

  const wanted = new Set(turnIds)
  return (await db.turnServices.toArray()).filter((service) => wanted.has(service.turnId))
}

/** A saved line's quick-pick key: its preset id, or the lower-cased name without one. */
export function quickPickKey(service: TurnService): string {
  return service.servicePresetId ?? `name:${service.serviceNameSnapshot.toLowerCase()}`
}

/** The last 30 days of turns and their lines, ready for the quick-pick maths. */
export async function loadQuickPickEntries(
  db: NailDb,
  today: IsoDate,
): Promise<QuickPickEntry[]> {
  const { turns, services } = await loadRange(db, addDays(today, -29), today)
  const grouped = servicesByTurn(services)

  return turns.map((turn) => ({
    turn: { id: turn.id, occurredAt: turn.occurredAt },
    lines: (grouped.get(turn.id) ?? []).map((service) => ({
      key: quickPickKey(service),
      name: service.serviceNameSnapshot,
      priceCents: service.servicePriceCents,
    })),
  }))
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
