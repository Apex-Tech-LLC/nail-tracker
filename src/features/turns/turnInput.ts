// Turns what is on the Add turn form into the input the database layer saves.
// Add turn and the voice Check screen both use it, so a turn can never be
// worked out one way here and another way there.
// Plain TypeScript: no React, no database.

import type { ClientType, ServicePreset, Turn } from '../../db/schema.ts'
import { isIsoDate, localDateTimeToMs, timeOf, type IsoDate } from '../../domain/dates.ts'
import { parseCents, parseRateBp, rateToInput } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import type { LineErrors, LineState } from './ServiceLineFields.tsx'
import type { TurnInput, TurnLineInput } from './turnStore.ts'

export interface Errors {
  date?: string
  cash?: string
  card?: string
  turnCount?: string
  services?: string
  lines: Record<string, LineErrors>
}

/** Everything the form holds that ends up on the saved turn. The tip texts are the boxes as shown. */
export interface TurnFormValues {
  lines: LineState[]
  cashText: string
  cardText: string
  turnCountText: string
  date: IsoDate
  time: string
  clientType: ClientType
  cashTipReceived: boolean
  cardTipReceived: boolean
  note: string
}

/** A blank service line for this choice, at this rate. */
export function newLine(choice: string, rateBp: number): LineState {
  return {
    key: crypto.randomUUID(),
    choice,
    customName: '',
    amount: '',
    rate: rateToInput(rateBp),
    rateTouched: false,
    originalChoice: choice,
    originalName: '',
  }
}

export function presetName(preset: ServicePreset, locale: Locale): string {
  return locale === 'vi' ? preset.nameVi : preset.nameEn
}

/** A typed time pins the moment; without one, the turn is simply now. */
function occurredAtFor(date: IsoDate, time: string): number {
  return time ? localDateTimeToMs(date, time) : Date.now()
}

/**
 * Editing keeps the saved moment unless the time or the day was changed.
 * A cleared time box keeps the original moment too.
 */
function occurredAtForEdit(date: IsoDate, time: string, turn: Turn): number {
  if (time === '') return turn.occurredAt
  if (time === timeOf(turn.occurredAt) && date === turn.localWorkDate) return turn.occurredAt
  return localDateTimeToMs(date, time)
}

/** A tip box's cents: empty is 0, unreadable is null. */
export function tipCents(text: string): number | null {
  return text.trim() === '' ? 0 : parseCents(text)
}

export type TurnInputResult = { input: TurnInput } | { errors: Errors }

/**
 * The turn input for these form values, or the errors to show. `editing` is
 * the saved turn being edited, which keeps its moment unless the time or day moved.
 */
export function turnInputFromForm(
  values: TurnFormValues,
  presets: readonly ServicePreset[],
  locale: Locale,
  editing?: Turn,
): TurnInputResult {
  if (values.lines.length === 0) {
    return { errors: { lines: {}, services: t(locale, 'errorNoService') } }
  }

  const lineErrors: Record<string, LineErrors> = {}
  const lines: TurnLineInput[] = []

  for (const line of values.lines) {
    const errors: LineErrors = {}
    const priceCents = parseCents(line.amount)
    const rateBp = parseRateBp(line.rate)
    if (priceCents === null) errors.amount = t(locale, 'errorAmount')
    if (rateBp === null) errors.rate = t(locale, 'errorRate')
    if (line.choice === 'other' && line.customName.trim() === '') {
      errors.serviceName = t(locale, 'errorServiceName')
    }
    if (priceCents === null || rateBp === null || errors.serviceName) {
      lineErrors[line.key] = errors
      continue
    }

    const preset = presets.find((item) => item.id === line.choice)
    // An unchanged preset keeps the name saved on the turn, so editing a tip
    // never rewrites history with a renamed preset.
    const name =
      preset && line.choice === line.originalChoice && line.originalName
        ? line.originalName
        : preset
          ? presetName(preset, locale)
          : line.customName.trim()
    lines.push({ servicePresetId: preset?.id ?? null, name, priceCents, rateBp })
  }

  const cashTipCents = tipCents(values.cashText)
  const cardTipCents = tipCents(values.cardText)
  const turnCount = /^\d{1,2}$/.test(values.turnCountText) ? Number(values.turnCountText) : null
  const errors: Errors = { lines: lineErrors }
  if (cashTipCents === null) errors.cash = t(locale, 'errorAmount')
  if (cardTipCents === null) errors.card = t(locale, 'errorAmount')
  if (turnCount === null) errors.turnCount = t(locale, 'errorTurnCount')
  if (!isIsoDate(values.date)) errors.date = t(locale, 'errorDate')

  if (
    cashTipCents === null ||
    cardTipCents === null ||
    turnCount === null ||
    !isIsoDate(values.date) ||
    Object.keys(lineErrors).length > 0
  ) {
    return { errors }
  }

  return {
    input: {
      occurredAt: editing
        ? occurredAtForEdit(values.date, values.time, editing)
        : occurredAtFor(values.date, values.time),
      localWorkDate: values.date,
      turnCount,
      clientType: values.clientType,
      note: values.note,
      cashTipCents,
      cardTipCents,
      cashTipReceived: values.cashTipReceived,
      cardTipReceived: values.cardTipReceived,
      lines,
    },
  }
}
