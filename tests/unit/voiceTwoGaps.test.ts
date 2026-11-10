import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESETS } from '../../src/db/seed.ts'
import { readVoice, type ReaderLocale, type ReaderPreset } from '../../src/domain/voiceReader.ts'

const presets: ReaderPreset[] = DEFAULT_PRESETS.map((preset) => ({
  id: preset.id,
  nameEn: preset.nameEn,
  nameVi: preset.nameVi,
  defaultPriceCents: preset.defaultPriceCents,
}))

const read = (text: string, locale: ReaderLocale = 'en') => readVoice({ text, presets, locale })
const codes = (turn: { checks: { code: string }[] }) => turn.checks.map((check) => check.code)
const lines = (text: string, locale: ReaderLocale = 'en') =>
  read(text, locale).turns.map((turn) => ({
    time: turn.startTime,
    services: turn.services.map((service) => [service.presetId, service.priceCents]),
    codes: codes(turn),
  }))

describe('a time said on its own before the first service', () => {
  it.each([
    ['at 2 PM. gel x 45', 'en'],
    ['at 2 PM next gel x 45', 'en'],
    ['lúc 2 giờ chiều. gel x 45', 'vi'],
    ['lúc 2 giờ chiều next gel x 45', 'vi'],
  ] as const)('goes to that service: %s', (text, locale) => {
    expect(lines(text, locale)).toEqual([{ time: '14:00', services: [['gel-x', 4500]], codes: [] }])
  })

  it('brings the guessed AM/PM and unreadable-time checks along', () => {
    expect(lines('at 7. gel x 45')).toEqual([{ time: '19:00', services: [['gel-x', 4500]], codes: ['timeGuessedHalf'] }])
    expect(lines('at 2 30. gel x 45')).toEqual([{ time: null, services: [['gel-x', 4500]], codes: ['timeNotRead'] }])
  })

  it('keeps the old reading when the service has a time of its own', () => {
    const turns = lines('at 2 PM. gel x 45 at 3 PM')
    expect(turns).toHaveLength(2)
    expect(turns[0]).toMatchObject({ time: '14:00', services: [] })
    expect(turns[1]).toMatchObject({ time: '15:00', services: [['gel-x', 4500]] })
  })

  it('keeps the old reading once a card exists, or when no service follows', () => {
    const afterCard = lines('gel 45. at 2 PM. pedi 35')
    expect(afterCard).toHaveLength(2)
    expect(afterCard[0].time).toBe('14:00')
    expect(afterCard[1]).toMatchObject({ time: null, services: [['pedicure', 3500]] })

    const afterNext = lines('gel 45. at 2 PM next gel x 45')
    expect(afterNext[0].time).toBe('14:00')
    expect(afterNext[1]).toMatchObject({ time: null, services: [['gel-x', 4500]] })

    const tip = read('at 2 PM. tip 5').turns
    expect(tip).toHaveLength(1)
    expect(tip[0]).toMatchObject({ startTime: '14:00', cashTipCents: 500, services: [] })
    expect(codes(tip[0])).toEqual(['noService'])
  })
})

describe('a price said right before its service', () => {
  it.each([
    ['45 manicure', 'en', 'manicure'],
    ['45 gel x', 'en', 'gel-x'],
    ['at 2 PM 45 gel x', 'en', 'gel-x'],
    ['45 làm tay', 'vi', 'manicure'],
    ['45 đô sơn gel tay', 'vi', 'gel-manicure'],
  ] as const)('%s', (text, locale, presetId) => {
    const result = read(text, locale)
    expect(result.turns[0].services).toMatchObject([{ presetId, priceCents: 4500 }])
    expect(codes(result.turns[0])).toContain('priceBeforeService')
    expect(codes(result.turns[0])).not.toContain('noPrice')
    expect(result.notUnderstood).toEqual([])
  })

  it('gives "at 2 PM 45 gel x" its time and its price', () => {
    expect(lines('at 2 PM 45 gel x')).toEqual([{ time: '14:00', services: [['gel-x', 4500]], codes: ['priceBeforeService'] }])
  })

  it('reaches the next service across a comma: gel 45, 35 pedi', () => {
    const result = read('gel 45, 35 pedi')
    expect(result.turns).toHaveLength(2)
    expect(result.turns[1].services).toMatchObject([{ presetId: 'pedicure', priceCents: 3500 }])
    expect(codes(result.turns[1])).toContain('priceBeforeService')
    expect(result.notUnderstood).toEqual([])

    const vi = read('sơn gel tay 45, 35 làm chân', 'vi').turns
    expect(vi[0].services).toMatchObject([{ presetId: 'gel-manicure', priceCents: 4500 }])
    expect(vi[1].services).toMatchObject([{ presetId: 'pedicure', priceCents: 3500 }])
    expect(codes(vi[1])).toContain('priceBeforeService')
  })

  it('leaves a bare count under 10 alone', () => {
    for (const [text, locale] of [
      ['2 pedi', 'en'],
      ['$90 for 2 gel', 'en'],
      ['2 làm chân', 'vi'],
      ['90 đô cho 2 sơn gel tay', 'vi'],
    ] as const) {
      const result = read(text, locale)
      expect(
        result.turns[0].services.every((service) => service.priceCents === null),
        text,
      ).toBe(true)
      expect(codes(result.turns[0]), text).not.toContain('priceBeforeService')
    }
  })

  it('still takes a small amount that says it is money', () => {
    expect(read('$5 pedi').turns[0].services).toMatchObject([{ presetId: 'pedicure', priceCents: 500 }])
    expect(read('9.50 pedi').turns[0].services).toMatchObject([{ presetId: 'pedicure', priceCents: 950 }])
    expect(read('5 dollars pedi').turns[0].services).toMatchObject([{ presetId: 'pedicure', priceCents: 500 }])
  })

  it('does not take minutes, tips, totals or the price a service already owns', () => {
    for (const [text, locale] of [
      ['gel manicure 45 minutes', 'en'],
      ['45 minutes gel manicure', 'en'],
      ['sơn gel tay 45 phút', 'vi'],
      ['45 phút sơn gel tay', 'vi'],
      ['cash 5 pedicure', 'en'],
      ['cash 45 pedicure', 'en'],
      ['tip 10 pedicure', 'en'],
      ['manicure 45 total 60 pedicure', 'en'],
      ['làm tay 45 tổng 60 làm chân', 'vi'],
    ] as const) {
      expect(read(text, locale).turns.flatMap(codes), text).not.toContain('priceBeforeService')
    }
    expect(read('cash 45 pedicure').turns[0].services[0].priceCents).toBeNull()
    expect(read('45 pedicure 35').turns[0].services[0].priceCents).toBe(3500)
    expect(read('gel manicure 45 minutes').turns[0].services[0].priceCents).toBe(4500)
  })

  it('keeps the guessed-word readings that already worked', () => {
    const [turn] = read('45 đô gieo ích', 'vi').turns
    expect(turn.services).toMatchObject([{ presetId: 'gel-x', priceCents: 4500 }])
    expect(codes(turn)).toEqual(['guessedWord'])
  })
})
