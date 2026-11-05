import type { IsoDate } from '../../domain/dates.ts'
import type { AdjustmentCategory } from '../../domain/totals.ts'
import type { Adjustment, NailDb } from '../../db/schema.ts'

export interface AdjustmentInput {
  occurredAt: number
  localWorkDate: IsoDate
  amountCents: number
  category: AdjustmentCategory
  note?: string
}

function buildAdjustment(
  input: AdjustmentInput,
  ids: { id: string; createdAt: number },
  now: number,
): Adjustment {
  const note = input.note?.trim()
  return {
    id: ids.id,
    occurredAt: input.occurredAt,
    localWorkDate: input.localWorkDate,
    amountCents: input.amountCents,
    category: input.category,
    ...(note ? { note } : {}),
    createdAt: ids.createdAt,
    updatedAt: now,
  }
}

export async function addAdjustment(
  db: NailDb,
  input: AdjustmentInput,
  now: number = Date.now(),
): Promise<string> {
  if (input.amountCents === 0) throw new Error('An adjustment cannot be zero')

  const id = crypto.randomUUID()
  await db.adjustments.add(buildAdjustment(input, { id, createdAt: now }, now))
  return id
}

export async function updateAdjustment(
  db: NailDb,
  id: string,
  input: AdjustmentInput,
  now: number = Date.now(),
): Promise<void> {
  if (input.amountCents === 0) throw new Error('An adjustment cannot be zero')

  const existing = await db.adjustments.get(id)
  if (!existing) throw new Error('Adjustment not found')

  await db.adjustments.put(buildAdjustment(input, { id, createdAt: existing.createdAt }, now))
}

export async function deleteAdjustment(db: NailDb, id: string): Promise<void> {
  await db.adjustments.delete(id)
}
