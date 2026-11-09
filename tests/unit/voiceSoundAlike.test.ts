import { describe, expect, it } from 'vitest'
import mishearings from '../../docs/voice/mishearings.json'
import { DEFAULT_PRESETS } from '../../src/db/seed.ts'
import { sameSound, soundFits, soundKey, soundNames } from '../../src/domain/soundAlike.ts'
import { MISHEARD_FORMS } from '../../src/domain/voiceMishearings.ts'
import { learnableWords, learnFromTurn, withLearned } from '../../src/domain/voiceLearning.ts'
import { readVoice, type ReaderLocale, type ReaderPreset } from '../../src/domain/voiceReader.ts'

const presets: ReaderPreset[] = DEFAULT_PRESETS.map((preset) => ({
  id: preset.id,
  nameEn: preset.nameEn,
  nameVi: preset.nameVi,
  defaultPriceCents: preset.defaultPriceCents,
}))

const read = (text: string, locale: ReaderLocale = 'en', list: ReaderPreset[] = presets, learned?: Map<string, string>) =>
  readVoice({ text, presets: list, locale, learned })
const codes = (turn: { checks: { code: string }[] }) => turn.checks.map((check) => check.code)
const guessed = (turn: { checks: { code: string; text: string }[] }) => turn.checks.filter((check) => check.code === 'guessedWord')

// The words the reader knew before the table, so a form that is only a table form can be told apart.
const OLD_TIP_WORDS = new Set(['tips', 'boa', 'tip'])
const OLD_CASH_WORDS = new Set(['cash', 'tien mat'])
const OLD_CARD_WORDS = new Set(['cart'])
const OLD_WORDS = new Set([...OLD_TIP_WORDS, ...OLD_CASH_WORDS, ...OLD_CARD_WORDS])
// Every form the older lists already read as a guessed service, with or without a price.
const OLD_SERVICE_FORMS = new Set([
  'man a cure', 'many cure', 'peddy cure', 'petty cure', 'jail manicure', 'son deo tay', 'gel many cure',
  'jail pedicure', 'son deo chan', 'gel petty cure', 'gel ex', 'jello ex', 'jox', 'gel ich', 'gel et',
  'acrylic feel', 'acrylic field', 'deep powder', 'dip power', 'bot nhun', 'nail heart', 'soak of',
])

const serviceKeys = Object.keys(MISHEARD_FORMS).filter((key) => !['tip', 'cash', 'card'].includes(key))
const serviceForms = serviceKeys.flatMap((key) => MISHEARD_FORMS[key].map((form) => ({ key, form })))

describe('the mishearing table: service forms next to a price', () => {
  it('reads Joe X, the one form heard on a real phone, as Gel-X with Check this', () => {
    const [turn] = read('Joe X 65').turns
    expect(turn.services).toMatchObject([{ presetId: 'gel-x', priceCents: 6500, heard: 'Joe X' }])
    expect(guessed(turn)).toEqual([{ code: 'guessedWord', text: 'Possible dictation error: "Joe X" matched to Gel-X.' }])
  })

  it('covers every service key with at least 30 forms', () => {
    expect(serviceForms.length).toBeGreaterThanOrEqual(30)
    expect(new Set(serviceForms.map((item) => item.key))).toEqual(new Set(serviceKeys))
  })

  describe.each(['en', 'vi'] as const)('%s keyboard', (locale) => {
    it.each(serviceForms)('"$form" then a price is $key', ({ key, form }) => {
      const result = read(`${form} 45`, locale)
      expect(result.notUnderstood).toEqual([])
      expect(result.turns).toHaveLength(1)
      expect(result.turns[0].services).toMatchObject([{ presetId: key, priceCents: 4500 }])
    })
  })

  it('reads a price said before the form, and a tip after it', () => {
    const fresh = serviceForms.filter((item) => read(item.form).turns.length === 0)
    expect(fresh.length).toBeGreaterThan(30)
    for (const { key, form } of fresh) {
      const before = read(`45 ${form}`)
      expect(before.turns[0]?.services, form).toMatchObject([{ presetId: key, priceCents: 4500 }])
      expect(codes(before.turns[0]), form).toContain('guessedWord')
      const withTip = read(`${form} 45, tip 10 cash`).turns
      expect(withTip, form).toHaveLength(1)
      expect(withTip[0].cashTipCents, form).toBe(1000)
    }
  })

  it('never reads a form without a price beside it', () => {
    for (const { form } of serviceForms) {
      if (OLD_SERVICE_FORMS.has(form)) continue
      for (const text of [form, `she said ${form} today`, `I want ${form} please, thanks`]) {
        const turns = read(text).turns
        const named = turns.flatMap((turn) => guessed(turn)).filter((check) => check.text.toLowerCase().includes(`"${form}"`))
        expect(named, text).toEqual([])
      }
    }
  })
})

describe('the mishearing table: tips, cash and card', () => {
  const tipForms = MISHEARD_FORMS.tip.filter((form) => !OLD_TIP_WORDS.has(form))
  const cashForms = MISHEARD_FORMS.cash.filter((form) => !OLD_CASH_WORDS.has(form))
  const cardForms = MISHEARD_FORMS.card.filter((form) => !OLD_CARD_WORDS.has(form))

  it.each(tipForms)('"%s" with an amount right next to it is a tip', (form) => {
    for (const text of [`gel manicure 45, ${form} 10 cash`, `gel manicure 45, 10 ${form} cash`]) {
      const [turn] = read(text).turns
      expect(turn.cashTipCents, text).toBe(1000)
      expect(guessed(turn).some((check) => check.text.includes(`"${form}"`)), text).toBe(true)
    }
  })

  it.each(tipForms)('"%s" with no amount beside it is not a tip', (form) => {
    for (const text of [`gel manicure 45 ${form}`, `she bought ${form} today`, `gel manicure 45 ${form} cash`]) {
      for (const turn of read(text).turns) {
        expect(turn.cashTipCents + turn.cardTipCents, text).toBe(0)
        expect(guessed(turn).filter((check) => check.text.includes('matched to tip')), text).toEqual([])
      }
    }
  })

  it.each(cashForms)('"%s" right after a tip amount is cash', (form) => {
    const [turn] = read(`gel manicure 45, tip 10 ${form}`).turns
    expect(turn).toMatchObject({ cashTipCents: 1000, cardTipCents: 0 })
    expect(guessed(turn).some((check) => check.text.includes(`"${form}"`))).toBe(true)
  })

  it.each(cardForms)('"%s" right after a tip amount is card', (form) => {
    const [turn] = read(`gel manicure 45, tip 10 ${form}`).turns
    expect(turn).toMatchObject({ cashTipCents: 0, cardTipCents: 1000 })
    expect(guessed(turn).some((check) => check.text.includes(`"${form}"`))).toBe(true)
  })

  it.each([...cashForms, ...cardForms])('"%s" after a service, with no tip amount, changes nothing', (form) => {
    const turns = read(`gel manicure 45 ${form}`).turns
    expect(turns).toHaveLength(1)
    expect(turns[0].services).toMatchObject([{ presetId: 'gel-manicure', priceCents: 4500 }])
    expect(turns[0].cashTipCents + turns[0].cardTipCents).toBe(0)
    expect(guessed(turns[0])).toEqual([])
  })

  it('"the" is a card only as in "tip 10 the"', () => {
    expect(read('gel manicure 45, tip 10 the').turns[0]).toMatchObject({ cardTipCents: 1000 })
    expect(read('gel manicure 45, the tip is 10').turns[0]).toMatchObject({ cardTipCents: 0 })
    expect(read('the 10 gel manicure 45').turns.every((turn) => turn.cardTipCents === 0)).toBe(true)
  })

  it('keeps the older words working exactly as before', () => {
    expect(read('gel manicure 45, tip 10 cash').turns[0]).toMatchObject({ cashTipCents: 1000 })
    expect(read('gel manicure 45, tip 10 card').turns[0]).toMatchObject({ cardTipCents: 1000 })
    expect(read('gel manicure 45, tip 10 cart').turns[0]).toMatchObject({ cardTipCents: 1000 })
    expect(read('gel manicure 45, tip 10 tien mat').turns[0]).toMatchObject({ cashTipCents: 1000 })
  })

  it('leaves request, walk-in and next forms out of the table', () => {
    expect(Object.keys(MISHEARD_FORMS)).not.toContain('request')
    expect(Object.keys(MISHEARD_FORMS)).not.toContain('walk-in')
    expect(Object.keys(MISHEARD_FORMS)).not.toContain('next')
  })
})

describe('collisions: ordinary words that look like a form', () => {
  const collisions = mishearings.collisions as { t: string; key: string }[]
  const tableForms = new Set(Object.values(MISHEARD_FORMS).flat())
  const fromTable = collisions.filter((item) => tableForms.has(item.t) && !OLD_SERVICE_FORMS.has(item.t) && !OLD_WORDS.has(item.t))

  it('has collision forms to test against', () => {
    expect(fromTable.length).toBeGreaterThan(50)
  })

  it('leaves a collision form alone without its guard', () => {
    for (const { t: form } of fromTable) {
      for (const locale of ['en', 'vi'] as const) {
        for (const text of [`she said ${form} today`, form]) {
          const named = read(text, locale)
            .turns.flatMap((turn) => guessed(turn))
            .filter((check) => check.text.toLowerCase().includes(`"${form}"`))
          expect(named, `${locale}: ${text}`).toEqual([])
        }
      }
    }
  })

  it('accepts a collision form once its guard holds, and says it is a guess', () => {
    const guarded = fromTable.filter((item) => serviceKeys.includes(item.key) && read(item.t).turns.length === 0)
    expect(guarded.length).toBeGreaterThan(30)
    for (const { t: form, key } of guarded) {
      const [turn] = read(`${form} 45`).turns
      expect(turn.services, form).toMatchObject([{ presetId: key, priceCents: 4500 }])
      expect(codes(turn), form).toContain('guessedWord')
    }
  })
})

describe('sound-alikes', () => {
  const custom: ReaderPreset[] = [
    ...presets,
    { id: 'lash-lift', nameEn: 'Lash Lift', nameVi: 'Nối mi', defaultPriceCents: 8000 },
    { id: 'mini-mani', nameEn: 'Mini Mani', nameVi: 'Mini Mani', defaultPriceCents: 2000 },
  ]
  const renamed = presets.map((preset) => (preset.id === 'gel-x' ? { ...preset, nameEn: 'Extensions', nameVi: 'Nối móng' } : preset))

  it('matches a word to a renamed service by sound, with Check this naming both', () => {
    const [turn] = read('extension 65', 'en', renamed).turns
    expect(turn.services).toMatchObject([{ presetId: 'gel-x', priceCents: 6500, heard: 'extension' }])
    expect(guessed(turn)).toEqual([{ code: 'guessedWord', text: 'Possible dictation error: "extension" matched to Extensions.' }])
  })

  it('matches a split name to the renamed service', () => {
    expect(read('ex tension 65', 'en', renamed).turns[0].services).toMatchObject([{ presetId: 'gel-x' }])
  })

  it('matches a custom service by sound', () => {
    const [turn] = read('noy mee 40', 'en', custom).turns
    expect(turn.services).toMatchObject([{ presetId: 'lash-lift', priceCents: 4000 }])
    expect(guessed(turn)[0].text).toBe('Possible dictation error: "noy mee" matched to Lash Lift.')
  })

  it('reads a price said first, too', () => {
    expect(read('40 noy mee', 'en', custom).turns[0].services).toMatchObject([{ presetId: 'lash-lift', priceCents: 4000 }])
  })

  it('needs a price beside the words', () => {
    expect(read('she liked extension', 'en', renamed).turns).toEqual([])
    expect(read('noy mee', 'en', custom).turns).toEqual([])
  })

  describe('when two services fit', () => {
    const two: ReaderPreset[] = [...presets, { id: 'mani-cure', nameEn: 'Mani Cure', nameVi: 'Mani Cure', defaultPriceCents: 3000 }]

    it('leaves words that sound like both unresolved', () => {
      const [turn] = read('manni kure 25', 'en', two).turns
      expect(turn.services).toEqual([])
      expect(codes(turn)).toContain('unclearService')
      expect(codes(turn)).not.toContain('guessedWord')
    })

    it('leaves a table form unresolved when it also sounds like another service', () => {
      const [turn] = read('mini cure 25', 'en', two).turns
      expect(turn.services).toEqual([])
      expect(codes(turn)).toContain('unclearService')
      expect(read('mini cure 25').turns[0].services).toMatchObject([{ presetId: 'manicure', priceCents: 2500 }])
    })

    it('still reads the exact name of either service', () => {
      expect(read('mani cure 25', 'en', two).turns[0].services).toMatchObject([{ presetId: 'mani-cure' }])
      expect(read('manicure 25', 'en', two).turns[0].services).toMatchObject([{ presetId: 'manicure' }])
    })
  })

  it.each(['gel 45', 'acrylic 45', 'art 20'])('does not guess a service from the general word in "%s"', (text) => {
    const [turn] = read(text).turns
    expect(turn.services).toEqual([])
    expect(guessed(turn)).toEqual([])
  })

  it('leaves a bare general word to the unclear-service check', () => {
    expect(codes(read('gel 45').turns[0])).toContain('unclearService')
    expect(codes(read('acrylic 45').turns[0])).toContain('unclearService')
  })

  it('never takes a word that is already read another way', () => {
    expect(read('manicure 45').turns[0].checks).toEqual([])
    expect(read('Gel-X 65, tip 10 card').turns[0]).toMatchObject({ cardTipCents: 1000 })
  })

  it('knows what the services sound like', () => {
    expect(sameSound(soundKey(['joe', 'x']), soundKey(['gel', 'x']))).toBe(true)
    expect(sameSound(soundKey(['joe', 'x']), soundKey(['pedicure']))).toBe(false)
    expect(soundFits(['joe', 'x'], soundNames('gel-x', ['Gel-X', 'Gel-X']))).toEqual(['gel-x'])
    expect(soundFits(['gel'], soundNames('gel-x', ['Gel-X']))).toEqual([])
    expect(soundNames('x', ['Gel', 'Nail Art'])).toEqual([])
  })
})

describe('words the person taught', () => {
  const learned = new Map([['banana', 'gel-x']])

  it('match with no check, in place of an unknown word', () => {
    const [turn] = read('banana 45', 'en', presets, learned).turns
    expect(turn.services).toMatchObject([{ presetId: 'gel-x', priceCents: 4500 }])
    expect(turn.checks).toEqual([])
  })

  it('beat the table, with no check', () => {
    const [turn] = read('joe x 45', 'en', presets, new Map([['joe x', 'pedicure']])).turns
    expect(turn.services).toMatchObject([{ presetId: 'pedicure' }])
    expect(turn.checks).toEqual([])
  })

  it('beat a sound-alike', () => {
    const renamed = presets.map((preset) => (preset.id === 'gel-x' ? { ...preset, nameEn: 'Extensions' } : preset))
    const [turn] = read('extension 65', 'en', renamed, new Map([['extension', 'pedicure']])).turns
    expect(turn.services).toMatchObject([{ presetId: 'pedicure' }])
    expect(turn.checks).toEqual([])
  })

  it('never beat an exact service name or a marker', () => {
    expect(read('manicure 45', 'en', presets, new Map([['manicure', 'pedicure']])).turns[0].services).toMatchObject([{ presetId: 'manicure' }])
    expect(read('gel manicure 45, tip 10 cash', 'en', presets, new Map([['cash', 'pedicure'], ['tip', 'pedicure']])).turns[0]).toMatchObject({
      cashTipCents: 1000,
      services: [{ presetId: 'gel-manicure' }],
    })
  })

  it('are ignored when the service is gone', () => {
    const result = read('banana 45', 'en', presets, new Map([['banana', 'deleted-service']]))
    expect(result.turns[0].services).toEqual([])
    expect(result.notUnderstood).toEqual(['banana'])
  })

  it('are matched however the accents or case fall', () => {
    const [turn] = read('Gieo Ích 45', 'vi', presets, new Map([['gieo ich', 'pedicure']])).turns
    expect(turn.services).toMatchObject([{ presetId: 'pedicure' }])
    expect(turn.checks).toEqual([])
  })
})

describe('learning from a fix', () => {
  it('learns the words of a single guessed service', () => {
    const [turn] = read('Joe X 65').turns
    expect(learnFromTurn(turn)).toEqual({ words: 'Joe X', readAs: 'gel-x' })
  })

  it('learns the words of an unclear service', () => {
    const [turn] = read('gel 45').turns
    expect(learnFromTurn(turn)).toEqual({ words: 'gel', readAs: null })
  })

  it('learns nothing from clear services, several services or no words', () => {
    expect(learnFromTurn(read('Gel-X 65').turns[0])).toBeNull()
    expect(read('manicure and joe x 65 and 35').turns[0].services).toHaveLength(2)
    expect(learnFromTurn(read('manicure and joe x 65 and 35').turns[0])).toBeNull()
    expect(learnFromTurn(read('tip 10 cash').turns[0])).toBeNull()
  })

  it('keeps only short, plain words that are not the reader’s own', () => {
    expect(learnableWords('Gieo Ích', presets, 'vi')).toBe('gieo ich')
    expect(learnableWords('Joe X', presets, 'en')).toBe('joe x')
    for (const bare of ['gel', 'acrylic', 'art', 'dip', 'Gel dip']) expect(learnableWords(bare, presets, 'en'), bare).toBeNull()
    for (const reserved of ['manicure', 'Gel-X', 'tip', 'cash', 'card', 'request', 'walk-in', 'five', '45', 'bốn lăm', 'tiền mặt']) {
      expect(learnableWords(reserved, presets, 'en'), reserved).toBeNull()
    }
    expect(learnableWords('one two three four', presets, 'en')).toBeNull()
    expect(learnableWords('x', presets, 'en')).toBeNull()
  })

  it('keeps the newest 200 and moves a repeated word to the end', () => {
    let learned: Record<string, string> = {}
    for (let index = 0; index < 205; index++) learned = withLearned(learned, `word ${'x'.repeat(index + 1)}`, 'gel-x')
    expect(Object.keys(learned)).toHaveLength(200)
    expect(Object.keys(learned)).not.toContain('word x')
    expect(Object.keys(learned)).toContain(`word ${'x'.repeat(205)}`)
    const again = withLearned({ a: 'pedicure', b: 'gel-x' }, 'a', 'manicure')
    expect(Object.entries(again)).toEqual([['b', 'gel-x'], ['a', 'manicure']])
  })
})

describe('real-looking sentences', () => {
  it('Joe X 65 tip 10 cash', () => {
    const [turn] = read('Joe X 65 tip 10 cash').turns
    expect(turn).toMatchObject({ cashTipCents: 1000, cardTipCents: 0, services: [{ presetId: 'gel-x', priceCents: 6500 }] })
    expect(codes(turn)).toEqual(['guessedWord'])
  })

  it('jello x bốn lăm, tip mười tiền mặt', () => {
    const [turn] = read('jello x bốn lăm, tip mười tiền mặt', 'vi').turns
    expect(turn).toMatchObject({ cashTipCents: 1000, services: [{ presetId: 'gel-x', priceCents: 4500 }] })
    expect(codes(turn)).toEqual(['guessedWord'])
  })

  it('45 đô gieo ích', () => {
    const result = read('45 đô gieo ích', 'vi')
    expect(result.turns).toHaveLength(1)
    expect(result.turns[0].services).toMatchObject([{ presetId: 'gel-x', priceCents: 4500 }])
    expect(codes(result.turns[0])).toEqual(['guessedWord'])
    expect(result.notUnderstood).toEqual([])
  })

  it('petty cure 35', () => {
    const [turn] = read('petty cure 35').turns
    expect(turn.services).toMatchObject([{ presetId: 'pedicure', priceCents: 3500 }])
  })

  it('two sentences together keep their own prices and tips', () => {
    const result = read('Joe X 65, tip 10 cash. Mini cure 25, tip 5 card.')
    expect(result.turns.map((turn) => [turn.services[0]?.presetId, turn.services[0]?.priceCents, turn.cashTipCents, turn.cardTipCents])).toEqual([
      ['gel-x', 6500, 1000, 0],
      ['manicure', 2500, 0, 500],
    ])
  })
})
