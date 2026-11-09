import { getSettings, updateSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { learnableWords, withLearned } from '../../domain/voiceLearning.ts'
import type { Locale } from '../../lib/locale.ts'
import type { TurnFormValues } from '../turns/turnInput.ts'
import type { DraftCard } from './voiceSession.ts'

/**
 * Remembers the words a draft was read from when the person saved it with
 * exactly one service that is not the one the reader chose (or none was chosen).
 * Cards with several services, or words the reader already owns, teach nothing.
 */
export async function learnFromFix(card: DraftCard, values: TurnFormValues, locale: Locale): Promise<void> {
  const from = card.learnFrom
  if (!from || values.lines.length !== 1) return
  const choice = values.lines[0].choice
  if (choice === from.readAs) return

  const presets = await db.servicePresets.filter((preset) => preset.isActive).toArray()
  if (!presets.some((preset) => preset.id === choice)) return
  const words = learnableWords(from.words, presets, locale)
  if (words === null) return
  updateSettings({ learnedWords: withLearned(getSettings().learnedWords, words, choice) })
}
