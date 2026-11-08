import { describe, expect, it } from 'vitest'
import phrases from '../../docs/voice/phrases.json'
import { DEFAULT_PRESETS } from '../../src/db/seed.ts'
import { readVoice } from '../../src/domain/voiceReader.ts'
import type { ReaderLocale, ReaderPreset } from '../../src/domain/voiceReader.ts'

interface ExpectedTurn {
  services: { presetId: string; priceCents: number | null }[]
  cashTipCents: number
  cardTipCents: number
  request: boolean
}

interface Item {
  id: string
  locale: ReaderLocale
  text: string
  turns: ExpectedTurn[]
  check: string[]
}

const items = phrases as Item[]

const presets: ReaderPreset[] = DEFAULT_PRESETS.map((preset) => ({
  id: preset.id,
  nameEn: preset.nameEn,
  nameVi: preset.nameVi,
  defaultPriceCents: preset.defaultPriceCents,
}))

// Sentences the reader still gets wrong, each with the reason. Only the hard
// groups may be listed here: corrections, guessed mishearings, back-references,
// decimal commas and the "rưỡi" shorthand. The core items must all pass.
const knownGaps: Record<string, string> = {}

// What the reader returned, boiled down to what the table states exactly.
function actual(item: Item) {
  const result = readVoice({ text: item.text, presets, locale: item.locale })
  return {
    result,
    turns: result.turns.map((turn) => ({
      services: turn.services.map((service) => ({ presetId: service.presetId, priceCents: service.priceCents })),
      cashTipCents: turn.cashTipCents,
      cardTipCents: turn.cardTipCents,
      request: turn.request,
    })),
    hasChecks: result.turns.some((turn) => turn.checks.length > 0) || result.notUnderstood.length > 0,
  }
}

function problems(item: Item): string[] {
  const { turns, hasChecks } = actual(item)
  const found: string[] = []
  if (JSON.stringify(turns) !== JSON.stringify(item.turns)) {
    found.push(`turns differ\n  expected ${JSON.stringify(item.turns)}\n  actual   ${JSON.stringify(turns)}`)
  }
  if (hasChecks !== item.check.length > 0) {
    found.push(`expected ${item.check.length > 0 ? 'a check' : 'no check'} but the reader gave ${hasChecks ? 'one' : 'none'}`)
  }
  return found
}

describe('the example table', () => {
  it('has 315 sentences with unique ids', () => {
    expect(items).toHaveLength(315)
    expect(new Set(items.map((item) => item.id)).size).toBe(315)
  })

  it('lists at most 40 known gaps, all of them real items', () => {
    const ids = new Set(items.map((item) => item.id))
    expect(Object.keys(knownGaps).length).toBeLessThanOrEqual(40)
    for (const id of Object.keys(knownGaps)) expect(ids.has(id), id).toBe(true)
  })

  describe.each(['en', 'vi', 'mixed'] as const)('%s', (locale) => {
    for (const item of items.filter((candidate) => candidate.locale === locale)) {
      const gap = knownGaps[item.id]
      if (gap) {
        it(`${item.id} (known gap: ${gap})`, () => {
          expect(problems(item), `${item.id} now passes: remove it from knownGaps`).not.toEqual([])
        })
      } else {
        it(`${item.id}: ${item.text}`, () => {
          expect(problems(item), item.text).toEqual([])
        })
      }
    }
  })
})

describe('the spec examples', () => {
  const withUsual: ReaderPreset[] = presets.map((preset) =>
    preset.id === 'pedicure' ? { ...preset, defaultPriceCents: 3500 } : preset,
  )

  it('Gel manicure 45, 10 tip cash. Pedicure 35. gives two turns', () => {
    const { turns, notUnderstood } = readVoice({
      text: 'Gel manicure 45, 10 tip cash. Pedicure 35.',
      presets: withUsual,
      locale: 'en',
    })
    expect(notUnderstood).toEqual([])
    expect(turns).toHaveLength(2)
    expect(turns[0].services).toEqual([{ presetId: 'gel-manicure', priceCents: 4500, usualPriceCents: null }])
    expect(turns[0].cashTipCents).toBe(1000)
    expect(turns[0].cardTipCents).toBe(0)
    expect(turns[0].checks).toEqual([])
    expect(turns[1].services).toEqual([{ presetId: 'pedicure', priceCents: 3500, usualPriceCents: 3500 }])
    expect(turns[1].checks).toEqual([])
  })

  it('"pedicure" alone gives a noPrice check with the usual price', () => {
    const { turns } = readVoice({ text: 'pedicure', presets: withUsual, locale: 'en' })
    expect(turns).toHaveLength(1)
    expect(turns[0].services).toEqual([{ presetId: 'pedicure', priceCents: null, usualPriceCents: 3500 }])
    expect(turns[0].checks.map((check) => check.code)).toEqual(['noPrice'])
    expect(turns[0].checks[0].text).toContain('$35')
  })

  it('uses the last price when the preset has no price of its own', () => {
    const { turns } = readVoice({
      text: 'pedicure',
      presets,
      lastPrices: new Map([['pedicure', 3200]]),
      locale: 'en',
    })
    expect(turns[0].services[0].usualPriceCents).toBe(3200)
  })

  it('reads Sơn gel tay bốn lăm, tip mười đô as Gel Manicure $45 with a $10 cash tip', () => {
    const { turns, notUnderstood } = readVoice({ text: 'Sơn gel tay bốn lăm, tip mười đô', presets, locale: 'vi' })
    expect(notUnderstood).toEqual([])
    expect(turns).toHaveLength(1)
    expect(turns[0].services[0]).toMatchObject({ presetId: 'gel-manicure', priceCents: 4500 })
    expect(turns[0].cashTipCents).toBe(1000)
    expect(turns[0].cardTipCents).toBe(0)
    expect(turns[0].checks).toEqual([])
  })

  it('reads mixed text as Vietnamese', () => {
    const mixed = readVoice({ text: 'Sơn gel tay bốn lăm, tip mười đô', presets, locale: 'mixed' })
    const vi = readVoice({ text: 'Sơn gel tay bốn lăm, tip mười đô', presets, locale: 'vi' })
    expect(mixed).toEqual(vi)
  })

  it('reads the three-job day from the problem statement', () => {
    const { turns } = readVoice({
      text: 'Three jobs. Gel manicure 45, 10 tip cash. Pedicure 35. Acrylic fill 50, 8 tip on card, she asked for me.',
      presets,
      locale: 'en',
    })
    expect(turns).toHaveLength(3)
    expect(turns[2].services[0]).toMatchObject({ presetId: 'acrylic-fill', priceCents: 5000 })
    expect(turns[2].cardTipCents).toBe(800)
    expect(turns[2].request).toBe(true)
    expect(turns.flatMap((turn) => turn.checks)).toEqual([])
  })

  it('keeps money in whole cents', () => {
    const { turns } = readVoice({ text: 'Manicure 35.50, tip 5,25', presets, locale: 'en' })
    expect(turns[0].services[0].priceCents).toBe(3550)
    expect(turns[0].cashTipCents).toBe(525)
    expect(Number.isInteger(turns[0].cashTipCents)).toBe(true)
  })
})
