import { updateSettings } from '../../app/settings.ts'
import { db, type ServicePreset } from '../../db/schema.ts'
import { turnTotals } from '../../domain/commission.ts'
import { todayIso } from '../../domain/dates.ts'
import type { Locale } from '../../lib/locale.ts'
import { requestPersistence } from '../../pwa/persistStorage.ts'
import { copiedTurnInput } from './turnInput.ts'
import { addTurn } from './turnStore.ts'

/** What to do once a brand new turn is saved: remember its last service, ask to keep the data. */
export function afterNewTurnSaved(
  lastChoice: string,
  presets: readonly ServicePreset[],
): void {
  const preset = presets.find((item) => item.id === lastChoice)
  if (preset) updateSettings({ lastServicePresetId: preset.id })
  void requestPersistence()
}

export interface CopiedTurn {
  id: string
  earnedTotalCents: number
}

/**
 * Saves a copy of this turn dated today, exactly as the Copy form would if its
 * Save were tapped without a change. Null when the turn no longer exists.
 */
export async function saveCopyOfTurn(turnId: string, locale: Locale): Promise<CopiedTurn | null> {
  const [source, services, presets] = await Promise.all([
    db.turns.get(turnId),
    db.turnServices.where('turnId').equals(turnId).sortBy('sortOrder'),
    db.servicePresets
      .orderBy('sortOrder')
      .filter((preset) => preset.isActive)
      .toArray(),
  ])
  if (!source || services.length === 0) return null

  const built = copiedTurnInput(source, services, presets, locale, todayIso())
  if (!('input' in built)) throw new Error('This turn cannot be copied as it is')

  const id = await addTurn(db, built.input)
  afterNewTurnSaved(built.input.lines[built.input.lines.length - 1].servicePresetId ?? 'other', presets)
  const money = turnTotals(
    built.input.lines.map((line) => ({ priceCents: line.priceCents, rateBp: line.rateBp })),
    built.input.cashTipCents,
    built.input.cardTipCents,
  )
  return { id, earnedTotalCents: money.earnedTotalCents }
}
