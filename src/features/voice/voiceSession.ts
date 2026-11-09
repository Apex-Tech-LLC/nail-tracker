// What the Say and Check screens hold between screens: the words typed or pasted, the
// chosen day and the draft turns. It lives in memory only, so it survives
// opening and closing a draft turn, or leaving Say and coming back, for as long
// as the app is open. Nothing here is written to the database.

import { useSyncExternalStore } from 'react'
import type { ServicePreset } from '../../db/schema.ts'
import { todayIso, type IsoDate } from '../../domain/dates.ts'
import { centsToInput } from '../../domain/money.ts'
import { learnFromTurn, type LearnFrom } from '../../domain/voiceLearning.ts'
import type { DraftTurn, ReaderResult } from '../../domain/voiceReader.ts'
import type { LineState } from '../turns/ServiceLineFields.tsx'
import type { TipHandling } from '../../app/settings.ts'
import type { TurnFormValues } from '../turns/turnInput.ts'
import { newLine } from '../turns/turnInput.ts'

export interface DraftCard {
  key: string
  // As the reader returned it: what was heard and why it is unsure.
  reader: DraftTurn
  // What is shown and saved. Its day is the session's day, set when saving.
  values: TurnFormValues
  // The person opened and fixed this card, so the reader's doubts no longer apply.
  reviewed: boolean
  // The words the reader was unsure of, to remember if the person saves this card with another service. null: nothing to learn.
  learnFrom: LearnFrom | null
}

export interface VoiceSession {
  // The one Say box: dictated words, or a ChatGPT answer pasted in.
  text: string
  // null means today, whichever day today is when it is read.
  date: IsoDate | null
  cards: DraftCard[]
  notUnderstood: string[]
  // Make turns has run: the Check screen has something to show, even if it is nothing.
  made: boolean
}

const EMPTY: VoiceSession = { text: '', date: null, cards: [], notUnderstood: [], made: false }

let session: VoiceSession = EMPTY
const listeners = new Set<() => void>()

export function getVoiceSession(): VoiceSession {
  return session
}

export function updateVoiceSession(change: Partial<VoiceSession>): void {
  session = { ...session, ...change }
  for (const listener of listeners) listener()
}

export function clearVoiceSession(): void {
  session = EMPTY
  for (const listener of listeners) listener()
}

export function useVoiceSession(): VoiceSession {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getVoiceSession,
  )
}

export function sessionDate(current: VoiceSession): IsoDate {
  return current.date ?? todayIso()
}

/** The first draft is at 9:00 and each one after starts 45 minutes later, for as long as the day lasts. */
export function slotTime(index: number): string {
  const minutes = Math.min(9 * 60 + index * 45, 23 * 60 + 59)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

export interface CardDefaults {
  defaultCommissionRateBp: number
  cashTipHandling: TipHandling
  cardTipHandling: TipHandling
}

/**
 * The card for one draft turn. A service with no heard price takes its usual
 * price, and the commission rate is the service's own or the default, exactly
 * as for a new turn: the reader never sets it. The time is the one said, else
 * the slot for this card's position among all the cards.
 */
export function cardFromTurn(
  turn: DraftTurn,
  index: number,
  presets: readonly ServicePreset[],
  defaults: CardDefaults,
  date: IsoDate,
): DraftCard {
  const lines = turn.services.map((service): LineState => {
    const preset = presets.find((item) => item.id === service.presetId)
    const line = newLine(
      preset ? preset.id : 'other',
      preset?.defaultCommissionRateBp ?? defaults.defaultCommissionRateBp,
    )
    const priceCents = service.priceCents ?? service.usualPriceCents
    return priceCents === null ? line : { ...line, amount: centsToInput(priceCents) }
  })
  return {
    key: crypto.randomUUID(),
    reader: turn,
    reviewed: false,
    learnFrom: learnFromTurn(turn),
    values: {
      lines,
      cashText: turn.cashTipCents > 0 ? centsToInput(turn.cashTipCents) : '',
      cardText: turn.cardTipCents > 0 ? centsToInput(turn.cardTipCents) : '',
      turnCountText: '1',
      date,
      time: turn.startTime ?? slotTime(index),
      clientType: turn.request ? 'request' : 'walkIn',
      cashTipReceived: defaults.cashTipHandling === 'inHand',
      cardTipReceived: defaults.cardTipHandling === 'inHand',
      note: '',
    },
  }
}

/** One card per draft turn, in the order said. */
export function cardsFromReader(
  result: ReaderResult,
  presets: readonly ServicePreset[],
  defaults: CardDefaults,
  date: IsoDate,
): DraftCard[] {
  return result.turns.map((turn, index) => cardFromTurn(turn, index, presets, defaults, date))
}

/** A card made straight from words the reader could not place: no service yet, the words as heard. */
export function cardFromLeftover(
  heard: string,
  index: number,
  presets: readonly ServicePreset[],
  defaults: CardDefaults,
  date: IsoDate,
): DraftCard {
  const turn: DraftTurn = {
    heard,
    services: [],
    cashTipCents: 0,
    cardTipCents: 0,
    request: false,
    startTime: null,
    checks: [{ code: 'noService', text: 'No service heard; choose one.' }],
  }
  return { ...cardFromTurn(turn, index, presets, defaults, date), learnFrom: { words: heard, readAs: null } }
}
