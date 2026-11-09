// The one-tap fixes on a flagged Check card. Plain TypeScript: each takes a card
// and gives back the fixed card; the screen saves it with `updateCard`.

import type { ServicePreset } from '../../db/schema.ts'
import { centsToInput, parseCents, roundDiv } from '../../domain/money.ts'
import type { CheckCode, DraftCheck } from '../../domain/voiceReader.ts'
import type { Locale } from '../../lib/locale.ts'
import { t } from '../../lib/i18n.ts'
import type { LineState } from '../turns/ServiceLineFields.tsx'
import { presetName } from '../turns/turnInput.ts'
import type { TurnInput } from '../turns/turnStore.ts'
import type { DraftCard } from './voiceSession.ts'

// Codes that only ask the person to look: if the turn can be saved, "Looks right" is honest.
const LOOK_ONLY: ReadonlySet<CheckCode> = new Set<CheckCode>([
  'shorthand',
  'guessedWord',
  'timeGuessedHalf',
  'repeatExpanded',
  'requestConflict',
  'inferredSplit',
  'sharedTotal',
  'currencyAssumed',
  'decimalComma',
  'halfShorthand',
  'priceChange',
  'appointment',
  'correction',
])

// The reader's own words for a tip said without an amount, put back when a picked tip is taken away.
const TIP_NO_AMOUNT: DraftCheck = {
  code: 'tipNoAmount',
  text: 'A tip was mentioned without an amount; enter the tip.',
}

/** "Looks right" is offered only for a turn that can be saved and has nothing left but things to look at. */
export function canLookRight(card: DraftCard, input: TurnInput | null): boolean {
  return input !== null && card.reader.checks.every((check) => LOOK_ONLY.has(check.code))
}

export function lookedAt(card: DraftCard): DraftCard {
  return { ...card, reviewed: true }
}

export function lineName(line: LineState, presets: readonly ServicePreset[], locale: Locale): string {
  const preset = presets.find((candidate) => candidate.id === line.choice)
  return preset ? presetName(preset, locale) : line.customName.trim() || t(locale, 'presetOther')
}

/** The lines that have no readable price, in the order shown. */
export function unpricedLines(card: DraftCard): LineState[] {
  return card.values.lines.filter((line) => parseCents(line.amount) === null)
}

export function hasTipCheck(card: DraftCard): boolean {
  return card.reader.checks.some((check) => check.code === 'tipNoAmount')
}

/** One line gets its price and one "no price" doubt goes; the card is reviewed once no doubt is left. */
export function withLinePrice(card: DraftCard, lineKey: string, cents: number): DraftCard {
  const at = card.reader.checks.findIndex((check) => check.code === 'noPrice')
  const checks = at < 0 ? card.reader.checks : card.reader.checks.filter((_, index) => index !== at)
  return {
    ...card,
    reviewed: card.reviewed || checks.length === 0,
    reader: { ...card.reader, checks },
    values: {
      ...card.values,
      lines: card.values.lines.map((line) =>
        line.key === lineKey ? { ...line, amount: centsToInput(cents) } : line,
      ),
    },
  }
}

/** 18% of the services, or null when no line has a price yet. */
export function percentTip(card: DraftCard): number | null {
  const subtotal = card.values.lines.reduce((sum, line) => sum + (parseCents(line.amount) ?? 0), 0)
  return subtotal > 0 ? roundDiv(subtotal * 1800, 10_000) : null
}

/** A tip chip fills the chosen tip box and clears the "tip with no amount" doubt; null empties it and brings the doubt back. */
export function withTip(card: DraftCard, box: 'cash' | 'card', cents: number | null): DraftCard {
  const without = card.reader.checks.filter((check) => check.code !== 'tipNoAmount')
  const checks = cents === null ? [...without, TIP_NO_AMOUNT] : without
  const text = cents === null ? '' : centsToInput(cents)
  return {
    ...card,
    tipPicked: cents !== null,
    reader: { ...card.reader, checks },
    values: box === 'cash' ? { ...card.values, cashText: text } : { ...card.values, cardText: text },
  }
}
