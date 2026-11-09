import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESETS } from '../../src/db/seed.ts'
import { readVoice, type ReaderPreset } from '../../src/domain/voiceReader.ts'
import { t, type StringKey } from '../../src/lib/i18n.ts'

const presets: ReaderPreset[] = DEFAULT_PRESETS.map((preset) => ({
  id: preset.id,
  nameEn: preset.nameEn,
  nameVi: preset.nameVi,
  defaultPriceCents: preset.defaultPriceCents,
}))

// The examples the Say screen's how-to shows. If one stops reading the way it plainly
// means, the how-to is teaching something the app does not do.
const EXPECTED = {
  en: [
    { presetId: 'gel-manicure', priceCents: 4500, cashTipCents: 1000, cardTipCents: 0, request: false },
    { presetId: 'pedicure', priceCents: 3500, cashTipCents: 0, cardTipCents: 800, request: false },
    { presetId: 'acrylic-fill', priceCents: 4500, cashTipCents: 0, cardTipCents: 0, request: true },
  ],
  vi: [
    { presetId: 'gel-manicure', priceCents: 4500, cashTipCents: 1000, cardTipCents: 0, request: false },
    { presetId: 'gel-x', priceCents: 6500, cashTipCents: 0, cardTipCents: 800, request: false },
    { presetId: 'acrylic-fill', priceCents: 4500, cashTipCents: 0, cardTipCents: 0, request: true },
  ],
} as const

describe('the Say how-to examples', () => {
  for (const locale of ['en', 'vi'] as const) {
    EXPECTED[locale].forEach((expected, index) => {
      const key = `sayHowToExample${index + 1}` as StringKey
      const text = t(locale, key)

      it(`reads ${locale} example ${index + 1} ("${text}") as one clear turn`, () => {
        const result = readVoice({ text, locale, presets })
        expect(result.notUnderstood).toEqual([])
        expect(result.turns).toHaveLength(1)
        const [turn] = result.turns
        expect(turn.services.map((service) => ({ presetId: service.presetId, priceCents: service.priceCents }))).toEqual([
          { presetId: expected.presetId, priceCents: expected.priceCents },
        ])
        expect(turn.cashTipCents).toBe(expected.cashTipCents)
        expect(turn.cardTipCents).toBe(expected.cardTipCents)
        expect(turn.request).toBe(expected.request)
        expect(turn.checks).toEqual([])
      })
    })
  }
})
