// The reader writes its reasons in English for developers. The Check screen
// shows these instead: every reason code has its own words in each language,
// and only what the person said (in quotes), a service name or an amount is
// filled in. Plain TypeScript: no React, no database.

import type { ServicePreset } from '../../db/schema.ts'
import type { DraftCheck, DraftTurn } from '../../domain/voiceReader.ts'
import { formatUsdShort } from '../../domain/money.ts'
import { tf, type StringKey } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { presetName } from '../turns/turnInput.ts'

// Codes that need nothing from the reader's text.
type PlainCode =
  | 'noService'
  | 'sharedTotal'
  | 'inferredSplit'
  | 'correction'
  | 'tipNoAmount'
  | 'paymentNotTip'
  | 'appointment'
  | 'requestConflict'

const PLAIN: Record<PlainCode, StringKey> = {
  noService: 'reasonNoService',
  sharedTotal: 'reasonSharedTotal',
  inferredSplit: 'reasonInferredSplit',
  correction: 'reasonCorrection',
  tipNoAmount: 'reasonTipNoAmount',
  paymentNotTip: 'reasonPaymentNotTip',
  appointment: 'reasonAppointment',
  requestConflict: 'reasonRequestConflict',
}

// Codes that show what the person said, as the first thing in quotes.
type QuotedCode =
  | 'unclearService'
  | 'badAmount'
  | 'halfShorthand'
  | 'decimalComma'
  | 'currencyAssumed'
  | 'priceChange'
  | 'timeNotRead'
  | 'backReference'

const QUOTED: Record<QuotedCode, StringKey> = {
  unclearService: 'reasonUnclearService',
  badAmount: 'reasonBadAmount',
  halfShorthand: 'reasonHalfShorthand',
  decimalComma: 'reasonDecimalComma',
  currencyAssumed: 'reasonCurrencyAssumed',
  priceChange: 'reasonPriceChange',
  timeNotRead: 'reasonTimeNotRead',
  backReference: 'reasonBackReference',
}

const quoted = (text: string) => /"([^"]*)"/.exec(text)?.[1] ?? ''

/** The preset the reader's text names ("matched to Gel-X", "Assumed Manicure from"), in the person's language. */
function namedService(text: string, presets: readonly ServicePreset[], locale: Locale): string | null {
  const preset = presets.find((item) => text.includes(` to ${item.nameEn}.`) || text.startsWith(`Assumed ${item.nameEn} from`))
  return preset ? presetName(preset, locale) : null
}

/** "you said 3 clients, but 4 clients were found" as the two figures, for the count reason. */
export function countFigures(text: string): { said: number; found: number } | null {
  const match = /you said (\d+).*?but (\d+)/.exec(text)
  return match ? { said: Number(match[1]), found: Number(match[2]) } : null
}

function countReason(text: string, locale: Locale): string | null {
  const figures = countFigures(text)
  if (!figures) return null
  return tf(locale, 'reasonCountMismatch', { said: figures.said, found: figures.found })
}

/** The "Not understood" line for words the reader could not place; null when it is not a count note. */
export function countNotUnderstood(text: string, locale: Locale): string | null {
  return text.startsWith('Count mismatch:') ? countReason(text, locale) : null
}

/**
 * Every reason this draft turn should be looked at again, in the person's
 * language. The "no price" reasons come from the draft's own services.
 */
export function reasonsFor(
  turn: DraftTurn,
  presets: readonly ServicePreset[],
  locale: Locale,
): string[] {
  const unpriced = turn.services.filter((service) => service.priceCents === null)
  let nextUnpriced = 0
  const reasons: string[] = []

  for (const check of turn.checks) {
    const reason = reasonFor(check)
    if (reason) reasons.push(reason)
  }
  return reasons

  function serviceName(presetId: string): string {
    const preset = presets.find((item) => item.id === presetId)
    return preset ? presetName(preset, locale) : presetId
  }

  function reasonFor(check: DraftCheck): string | null {
    switch (check.code) {
      case 'noPrice': {
        const service = unpriced[nextUnpriced++]
        if (!service) return tf(locale, 'reasonNoPriceNone', { service: '' })
        if (service.usualPriceCents === null) {
          return tf(locale, 'reasonNoPriceNone', { service: serviceName(service.presetId) })
        }
        const price = formatUsdShort(service.usualPriceCents)
        return turn.services.length === 1
          ? tf(locale, 'reasonNoPrice', { price })
          : tf(locale, 'reasonNoPriceFor', { service: serviceName(service.presetId), price })
      }
      case 'shorthand': {
        const service = namedService(check.text, presets, locale)
        const heard = quoted(check.text)
        return service
          ? tf(locale, 'reasonShorthandAs', { heard, service })
          : tf(locale, 'reasonShorthand', { heard })
      }
      case 'guessedWord': {
        const service = namedService(check.text, presets, locale)
        const heard = quoted(check.text)
        return service
          ? tf(locale, 'reasonGuessedAs', { heard, service })
          : tf(locale, 'reasonGuessed', { heard })
      }
      case 'countMismatch':
        return countReason(check.text, locale)
      case 'repeatExpanded':
        return tf(locale, 'reasonRepeatExpanded', { n: /(\d+)/.exec(check.text)?.[1] ?? '' })
      default: {
        // A new reader code that is in neither table is a compile error here.
        const code: PlainCode | QuotedCode = check.code
        return code in PLAIN
          ? tf(locale, PLAIN[code as PlainCode], {})
          : tf(locale, QUOTED[code as QuotedCode], { heard: quoted(check.text) })
      }
    }
  }
}
