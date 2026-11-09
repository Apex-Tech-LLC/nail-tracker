// Learning from fixes: when the person opens a card the reader was unsure about
// and saves it with a different service, the words it came from are remembered
// for that service. Plain TypeScript; the screens keep the list in settings.

import { GENERIC_SOUND_WORDS, lettersOf } from './soundAlike.ts'
import { foldPhrase, isReservedPhrase, type DraftTurn, type ReaderLocale, type ReaderPreset } from './voiceReader.ts'

/** The most learned words kept; the newest stay. */
export const LEARNED_WORDS_MAX = 200
const LEARNED_SPAN_MAX = 3

/** The words a card's service was read from, and the service they were read as (null: none). */
export interface LearnFrom {
  words: string
  readAs: string | null
}

// The texts the reader writes for a guessed and for an unclear service.
const GUESSED_CHECK = /^Possible dictation error: "(.*)" matched to /
const UNCLEAR_CHECK = /^Could not tell which service "(.*)" is/

/**
 * What a draft turn could teach the reader: the words of its single guessed
 * service, the words of an unclear service it has none for, or null when it
 * has more than one service or nothing to learn from.
 */
export function learnFromTurn(turn: DraftTurn): LearnFrom | null {
  if (turn.services.length > 1) return null
  const service = turn.services[0]
  if (service) {
    const guessed = turn.checks.some((check) => GUESSED_CHECK.exec(check.text)?.[1] === service.heard)
    return guessed && service.heard !== '' ? { words: service.heard, readAs: service.presetId } : null
  }
  for (const check of turn.checks) {
    const words = UNCLEAR_CHECK.exec(check.text)?.[1]
    if (words) return { words, readAs: null }
  }
  return null
}

/** The folded words to remember, or null when they are too short, too long, general, or already the reader's own. */
export function learnableWords(words: string, presets: readonly ReaderPreset[], locale: ReaderLocale): string | null {
  const folded = foldPhrase(words)
  const count = folded === '' ? 0 : folded.split(' ').length
  if (count === 0 || count > LEARNED_SPAN_MAX || folded.replace(/ /g, '').length < 3) return null
  if (lettersOf(folded).every((word) => GENERIC_SOUND_WORDS.has(word))) return null
  return isReservedPhrase(folded, presets, locale) ? null : folded
}

/** The list with these words learned as this service; the newest entry is last, and the oldest drop out. */
export function withLearned(learned: Readonly<Record<string, string>>, words: string, presetId: string): Record<string, string> {
  const next = { ...learned }
  delete next[words]
  next[words] = presetId
  return Object.fromEntries(Object.entries(next).slice(-LEARNED_WORDS_MAX))
}
