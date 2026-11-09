import { afterEach, describe, expect, it } from 'vitest'
import type { ServicePreset } from '../../src/db/schema.ts'
import type { DraftCheck, DraftTurn } from '../../src/domain/voiceReader.ts'
import {
  canLookRight,
  lookedAt,
  unpricedLines,
  withLinePrice,
  withTip,
} from '../../src/features/voice/quickFixes.ts'
import {
  cardFromTurn,
  clearVoiceSession,
  getVoiceSession,
  updateCard,
  updateVoiceSession,
} from '../../src/features/voice/voiceSession.ts'

const preset = (id: string): ServicePreset => ({
  id,
  salonId: null,
  nameEn: id,
  nameVi: id,
  defaultPriceCents: null,
  defaultCommissionRateBp: null,
  isCustom: false,
  sortOrder: 0,
  isActive: true,
  createdAt: 0,
  updatedAt: 0,
})
const presets = [preset('gel'), preset('pedi')]
const defaults = { defaultCommissionRateBp: 6000, cashTipHandling: 'inHand', cardTipHandling: 'inHand' } as const

function card(checks: DraftCheck[], services = [{ presetId: 'gel', priceCents: 4500 as number | null }]) {
  const turn: DraftTurn = {
    heard: 'gel',
    services: services.map((service) => ({ ...service, heard: 'gel', usualPriceCents: null })),
    cashTipCents: 0,
    cardTipCents: 0,
    request: false,
    startTime: null,
    checks,
  }
  return cardFromTurn(turn, 0, presets, defaults, '2026-11-04')
}
const check = (code: DraftCheck['code']): DraftCheck => ({ code, text: code })

afterEach(() => clearVoiceSession())

describe('updateCard', () => {
  it('replaces only the card with that key and keeps the rest of the session', () => {
    const first = card([])
    const second = card([])
    updateVoiceSession({ text: 'said', cards: [first, second], made: true })

    updateCard(second.key, (item) => ({ ...item, reviewed: true }))

    const after = getVoiceSession()
    expect(after.cards[0]).toBe(first)
    expect(after.cards[1].reviewed).toBe(true)
    expect(after.text).toBe('said')
  })

  it('reads the session as it is now, so two changes in a row both stick', () => {
    const only = card([])
    updateVoiceSession({ cards: [only] })
    updateCard(only.key, (item) => ({ ...item, reviewed: true }))
    updateCard(only.key, (item) => ({ ...item, values: { ...item.values, note: 'x' } }))
    expect(getVoiceSession().cards[0]).toMatchObject({ reviewed: true, values: { note: 'x' } })
  })

  it('does nothing for a key that is not there', () => {
    const only = card([])
    updateVoiceSession({ cards: [only] })
    updateCard('missing', (item) => ({ ...item, reviewed: true }))
    expect(getVoiceSession().cards[0]).toBe(only)
  })
})

describe('quick fixes', () => {
  it('offers Looks right only for a savable card with look-only doubts', () => {
    const input = {} as never
    expect(canLookRight(card([check('shorthand'), check('priceChange')]), input)).toBe(true)
    expect(canLookRight(card([check('shorthand')]), null)).toBe(false)
    for (const code of ['noService', 'unclearService', 'countMismatch', 'badAmount', 'paymentNotTip', 'backReference', 'timeNotRead', 'tipNoAmount', 'noPrice'] as const) {
      expect(canLookRight(card([check('shorthand'), check(code)]), input), code).toBe(false)
    }
    expect(lookedAt(card([check('shorthand')])).reviewed).toBe(true)
  })

  it('a price removes one no-price doubt and reviews the card only when none are left', () => {
    const two = card([check('noPrice'), check('noPrice')], [
      { presetId: 'gel', priceCents: null },
      { presetId: 'pedi', priceCents: null },
    ])
    expect(unpricedLines(two)).toHaveLength(2)

    const one = withLinePrice(two, two.values.lines[1].key, 3500)
    expect(one.values.lines[1].amount).toBe('35.00')
    expect(one.values.lines[0].amount).toBe('')
    expect(one.reader.checks).toHaveLength(1)
    expect(one.reviewed).toBe(false)

    const done = withLinePrice(one, one.values.lines[0].key, 4500)
    expect(done.reader.checks).toHaveLength(0)
    expect(done.reviewed).toBe(true)
  })

  it('a tip fills the chosen box and clears the doubt; the same tip again puts the doubt back', () => {
    const start = card([check('tipNoAmount'), check('shorthand')])
    const cash = withTip(start, 'cash', 1000)
    expect(cash.values.cashText).toBe('10.00')
    expect(cash.values.cardText).toBe('')
    expect(cash.reader.checks.map((item) => item.code)).toEqual(['shorthand'])
    expect(cash.tipPicked).toBe(true)

    const back = withTip(cash, 'cash', null)
    expect(back.values.cashText).toBe('')
    expect(back.reader.checks.map((item) => item.code)).toEqual(['shorthand', 'tipNoAmount'])
    expect(back.tipPicked).toBe(false)

    expect(withTip(start, 'card', 500).values.cardText).toBe('5.00')
  })
})
