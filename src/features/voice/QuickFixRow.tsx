import { useState } from 'react'
import { useSettings } from '../../app/settings.ts'
import type { ServicePreset } from '../../db/schema.ts'
import { parseCents } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import { PriceSheet } from '../presets/PriceSheet.tsx'
import { TipChips } from '../turns/TipChips.tsx'
import { tipCents } from '../turns/turnInput.ts'
import type { TurnInput } from '../turns/turnStore.ts'
import { chip, chipOff, chipOn } from '../../ui/styles.ts'
import {
  canLookRight,
  hasTipCheck,
  lineName,
  lookedAt,
  percentTip,
  unpricedLines,
  withLinePrice,
  withTip,
} from './quickFixes.ts'
import { updateCard, type DraftCard } from './voiceSession.ts'

/** The one-tap fixes under a flagged card: Looks right, a price for each line without one, a tip for a tip said with no amount. */
export function QuickFixRow({
  card,
  input,
  presets,
}: {
  card: DraftCard
  input: TurnInput | null
  presets: readonly ServicePreset[]
}) {
  const { locale, tipButtonsTarget } = useSettings()
  const [pricingKey, setPricingKey] = useState<string | null>(null)
  const unpriced = unpricedLines(card)
  const pricing = unpriced.find((line) => line.key === pricingKey)
  const showTip = hasTipCheck(card) || card.tipPicked === true
  const tipText = tipButtonsTarget === 'cash' ? card.values.cashText : card.values.cardText
  const pressedCents = tipText.trim() === '' ? null : tipCents(tipText)
  const lookRight = canLookRight(card, input)

  if (!lookRight && unpriced.length === 0 && !showTip) return null

  return (
    <div
      role="group"
      aria-label={t(locale, 'quickFixes')}
      className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2"
    >
      {lookRight && (
        <button
          type="button"
          className={`${chip} ${chipOn}`}
          onClick={() => updateCard(card.key, lookedAt)}
        >
          {t(locale, 'looksRight')}
        </button>
      )}
      {unpriced.map((line) => (
        <button
          key={line.key}
          type="button"
          className={`${chip} ${chipOff} break-words text-left`}
          onClick={() => setPricingKey(line.key)}
        >
          {unpriced.length === 1
            ? t(locale, 'setPrice')
            : tf(locale, 'setPriceFor', { service: lineName(line, presets, locale) })}
        </button>
      ))}
      {showTip && (
        <TipChips
          percentCents={percentTip(card)}
          pressedCents={pressedCents}
          onPick={(cents) =>
            updateCard(card.key, (item) =>
              withTip(item, tipButtonsTarget, pressedCents === cents ? null : cents),
            )
          }
        />
      )}
      {pricing && (
        <PriceSheet
          priceCents={parseCents(pricing.amount)}
          name={lineName(pricing, presets, locale)}
          label="linePrice"
          onSave={(cents) => {
            if (cents !== null) updateCard(card.key, (item) => withLinePrice(item, pricing.key, cents))
          }}
          onClose={() => setPricingKey(null)}
        />
      )}
    </div>
  )
}
