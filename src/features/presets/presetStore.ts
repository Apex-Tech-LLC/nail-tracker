import type { NailDb, ServicePreset } from '../../db/schema.ts'

export interface PresetInput {
  nameEn: string
  nameVi: string
  defaultPriceCents: number | null
  defaultCommissionRateBp: number | null
}

type PresetFields = Pick<
  ServicePreset,
  'nameEn' | 'nameVi' | 'defaultPriceCents' | 'defaultCommissionRateBp'
>

function fields(input: PresetInput): PresetFields {
  return {
    nameEn: input.nameEn.trim(),
    nameVi: input.nameVi.trim(),
    defaultPriceCents: input.defaultPriceCents,
    defaultCommissionRateBp: input.defaultCommissionRateBp,
  }
}

export async function addPreset(
  db: NailDb,
  input: PresetInput,
  now: number = Date.now(),
): Promise<string> {
  const id = crypto.randomUUID()

  await db.transaction('rw', db.servicePresets, async () => {
    const last = await db.servicePresets.orderBy('sortOrder').last()
    const preset: ServicePreset = {
      id,
      salonId: null,
      ...fields(input),
      isCustom: true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
    await db.servicePresets.add(preset)
  })

  return id
}

export async function updatePreset(
  db: NailDb,
  id: string,
  input: PresetInput,
  now: number = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.servicePresets, async () => {
    const existing = await db.servicePresets.get(id)
    if (!existing) throw new Error('Preset not found')
    await db.servicePresets.put({ ...existing, ...fields(input), updatedAt: now })
  })
}

/** Removed presets stay as rows so old turns can still resolve the service they used. */
export async function removePreset(
  db: NailDb,
  id: string,
  now: number = Date.now(),
): Promise<void> {
  await db.servicePresets.update(id, { isActive: false, updatedAt: now })
}

export async function movePreset(
  db: NailDb,
  id: string,
  direction: -1 | 1,
  now: number = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.servicePresets, async () => {
    const active = (await db.servicePresets.orderBy('sortOrder').toArray()).filter(
      (preset) => preset.isActive,
    )
    const index = active.findIndex((preset) => preset.id === id)
    if (index === -1) return

    const moving = active[index]
    const other = active[index + direction]
    if (!other) return

    await db.servicePresets.put({ ...moving, sortOrder: other.sortOrder, updatedAt: now })
    await db.servicePresets.put({ ...other, sortOrder: moving.sortOrder, updatedAt: now })
  })
}
