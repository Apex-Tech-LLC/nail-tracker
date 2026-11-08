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
  // Only on the items that state a said time.
  startTime?: string | null
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
    startTimes: result.turns.map((turn) => turn.startTime),
    hasChecks: result.turns.some((turn) => turn.checks.length > 0) || result.notUnderstood.length > 0,
  }
}

function problems(item: Item): string[] {
  const { turns, startTimes, hasChecks } = actual(item)
  const found: string[] = []
  const expectedTurns = item.turns.map(({ startTime: _startTime, ...rest }) => rest)
  if (JSON.stringify(turns) !== JSON.stringify(expectedTurns)) {
    found.push(`turns differ\n  expected ${JSON.stringify(expectedTurns)}\n  actual   ${JSON.stringify(turns)}`)
  }
  item.turns.forEach((expected, index) => {
    if (expected.startTime !== undefined && startTimes[index] !== expected.startTime) {
      found.push(`turn ${index + 1} start time: expected ${expected.startTime}, got ${startTimes[index]}`)
    }
  })
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

// ---------------------------------------------------------------------------
// Spoken times
// ---------------------------------------------------------------------------

const read = (text: string, locale: ReaderLocale = 'en') => readVoice({ text, presets, locale })
const codes = (turn: { checks: { code: string }[] }) => turn.checks.map((check) => check.code)

describe('spoken times', () => {
  it.each([
    ['gel manicure 45 at 2', 'en', '14:00'],
    ['gel manicure 45 at 2 PM', 'en', '14:00'],
    ['gel manicure 45 at 10 am', 'en', '10:00'],
    ['gel manicure 45 at 12', 'en', '12:00'],
    ['gel manicure 45 at 2:30', 'en', '14:30'],
    ['2:30 gel manicure 45', 'en', '14:30'],
    ['14:30 gel manicure 45', 'en', '14:30'],
    ['gel manicure 45 at 10:15 am', 'en', '10:15'],
    ['gel manicure 45 at 7 pm', 'en', '19:00'],
    ['gel manicure 45 at 7 am', 'en', '07:00'],
    ['son gel tay 45 luc 2 gio', 'vi', '14:00'],
    ['luc hai gio chieu son gel tay 45', 'vi', '14:00'],
    ['lúc hai giờ chiều, sơn gel tay bốn lăm', 'vi', '14:00'],
    ['son gel tay 45 luc 10 gio sang', 'vi', '10:00'],
    ['son gel tay 45 luc 8 gio toi', 'vi', '20:00'],
    ['son gel tay 45 luc 2 gio ruoi', 'vi', '14:30'],
    ['2 gio ruoi son gel tay 45', 'vi', '14:30'],
    ['2 giờ rưỡi sơn gel tay 45', 'vi', '14:30'],
    ['son gel tay 45 luc 3 gio 15', 'vi', '15:15'],
    ['3 gio 15 phut son gel tay 45', 'vi', '15:15'],
    ['son gel tay 45 luc 2h30', 'vi', '14:30'],
  ] as const)('reads the time in "%s"', (text, locale, expected) => {
    const { turns, notUnderstood } = read(text, locale)
    expect(notUnderstood).toEqual([])
    expect(turns).toHaveLength(1)
    expect(turns[0].startTime).toBe(expected)
    expect(turns[0].services[0].priceCents).toBe(4500)
    expect(codes(turns[0])).toEqual([])
  })

  it('takes 1 to 6 as afternoon and 9 to 12 as morning or noon when no am or pm is said', () => {
    expect(read('gel manicure 45 at 1').turns[0].startTime).toBe('13:00')
    expect(read('gel manicure 45 at 6').turns[0].startTime).toBe('18:00')
    expect(read('gel manicure 45 at 9').turns[0].startTime).toBe('09:00')
    expect(read('gel manicure 45 at 11:30').turns[0].startTime).toBe('11:30')
  })

  it('guesses 7 and 8 and asks whether it is morning or evening', () => {
    const seven = read('gel manicure 45 at 7').turns[0]
    expect(seven.startTime).toBe('19:00')
    expect(seven.checks).toEqual([{ code: 'timeGuessedHalf', text: 'Is that morning or evening?' }])
    const eight = read('gel manicure 45 at 8:15').turns[0]
    expect(eight.startTime).toBe('08:15')
    expect(codes(eight)).toEqual(['timeGuessedHalf'])
    expect(codes(read('gel manicure 45 at 7 pm').turns[0])).toEqual([])
  })

  it('keeps a price that looks like a time as a price', () => {
    const twenty = read('pedicure at 20').turns[0]
    expect(twenty.startTime).toBeNull()
    expect(twenty.services[0].priceCents).toBe(2000)

    const forty = read('gel manicure at 45').turns[0]
    expect(forty.startTime).toBeNull()
    expect(forty.services[0].priceCents).toBe(4500)

    // A small number right after a service with no price is its price.
    const ten = read('pedicure at 10').turns[0]
    expect(ten.startTime).toBeNull()
    expect(ten.services[0].priceCents).toBe(1000)

    // 45 after "2 PM" is a price, never minutes.
    const afterPm = read('at 2 PM 45 gel')
    expect(afterPm.turns[0].startTime).toBe('14:00')
    expect(codes(afterPm.turns[0])).not.toContain('timeNotRead')
    expect(afterPm.notUnderstood).toContain('45')
  })

  it('leaves 2.30 as a price', () => {
    const { turns } = read('pedicure 2.30')
    expect(turns[0].startTime).toBeNull()
    expect(turns[0].services[0].priceCents).toBe(230)
  })

  it('does not read a number above 12 as a time without a colon, giờ, am/pm or day part', () => {
    expect(read('gel manicure 45 at 14').turns[0].startTime).toBeNull()
    expect(read('gel manicure 45 at 14 pm').turns[0].startTime).toBe('14:00')
  })

  it('leaves "at 2 30", "at two thirty" and "at 2:75" unread, and the number is not a price', () => {
    for (const text of ['gel manicure 45 at 2 30', 'gel manicure 45 at two thirty', 'gel manicure 45 at 2:75']) {
      const { turns, notUnderstood } = read(text)
      expect(turns, text).toHaveLength(1)
      expect(turns[0].startTime, text).toBeNull()
      expect(codes(turns[0]), text).toEqual(['timeNotRead'])
      expect(turns[0].services[0].priceCents, text).toBe(4500)
      expect(notUnderstood, text).toEqual([])
    }
  })

  it('keeps a time said on its own sentence with the turn before it', () => {
    const { turns } = read('Gel manicure 45. At 2. Pedicure 35.')
    expect(turns).toHaveLength(2)
    expect(turns[0].startTime).toBe('14:00')
    expect(turns[0].checks).toEqual([])
    expect(turns[1].startTime).toBeNull()
    expect(turns[0].heard).toContain('At 2')
  })

  it('keeps a time inside a turn with that turn', () => {
    const { turns } = read('gel manicure 45 at 3, pedicure 35')
    expect(turns).toHaveLength(2)
    expect(turns.map((turn) => turn.startTime)).toEqual(['15:00', null])
  })

  it('keeps the first of two different times and flags the second', () => {
    const { turns } = read('gel manicure 45 at 2. At 4.')
    expect(turns).toHaveLength(1)
    expect(turns[0].startTime).toBe('14:00')
    expect(codes(turns[0])).toEqual(['timeNotRead'])

    const same = read('gel manicure 45 at 2. At 2.').turns[0]
    expect(same.startTime).toBe('14:00')
    expect(same.checks).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Services then prices
// ---------------------------------------------------------------------------

const prices = (text: string, locale: ReaderLocale = 'en') =>
  read(text, locale).turns.map((turn) => turn.services.map((service) => [service.presetId, service.priceCents]))

describe('services named in a row, then their prices', () => {
  it('pairs them in order, in English', () => {
    expect(prices('manicure and pedicure 25 and 35')).toEqual([[['manicure', 2500], ['pedicure', 3500]]])
    expect(prices('mani pedi 25 35')).toEqual([[['manicure', 2500], ['pedicure', 3500]]])
    expect(read('mani pedi 25 35').turns[0].checks).toEqual([])
  })

  it('pairs them in order, in Vietnamese', () => {
    expect(prices('lam tay voi chan 25 voi 35', 'vi')).toEqual([[['manicure', 2500], ['pedicure', 3500]]])
    expect(codes(read('lam tay voi chan 25 voi 35', 'vi').turns[0])).not.toContain('sharedTotal')
  })

  it('keeps one shared total when there is one price', () => {
    const turn = read('manicure and pedicure 60').turns[0]
    expect(turn.services.map((service) => service.priceCents)).toEqual([null, null])
    expect(turn.checks.find((check) => check.code === 'sharedTotal')?.text).toContain('$60')
  })

  it('keeps today’s behaviour when the counts differ', () => {
    const turn = read('manicure pedicure acrylic fill 25 35').turns[0]
    expect(turn.services.map((service) => service.priceCents)).toEqual([null, null, 2500])
    expect(read('manicure pedicure acrylic fill 25 35').notUnderstood).toEqual(['35'])
  })

  it('does not pair a tip with the services', () => {
    const turn = read('manicure and pedicure 60 and 10 tip cash').turns[0]
    expect(codes(turn)).toEqual(['sharedTotal'])
    expect(turn.cashTipCents).toBe(1000)
    expect(turn.services.map((service) => service.priceCents)).toEqual([null, null])

    const paired = read('manicure and pedicure 25 and 35 and 10 tip cash').turns[0]
    expect(paired.services.map((service) => service.priceCents)).toEqual([2500, 3500])
    expect(paired.cashTipCents).toBe(1000)
    expect(codes(paired)).toEqual([])
  })

  it('leaves the alternating form alone', () => {
    expect(prices('Gel-X 65 and nail art 10 and removal 15')).toEqual([
      [['gel-x', 6500], ['nail-art', 1000], ['removal', 1500]],
    ])
  })
})

describe('what was heard', () => {
  it('keeps the tip, channel and payment words under the card', () => {
    const { turns } = read('Gel manicure 45, 10 tip cash. Pedicure 35.')
    expect(turns[0].heard).toBe('Gel manicure 45, 10 tip cash')
    expect(read('Gel manicure 45, tip 10 on card').turns[0].heard).toBe('Gel manicure 45, tip 10 on card')
    expect(read('Gel manicure 45, paid 45 on card').turns[0].heard).toBe('Gel manicure 45, paid 45 on card')
  })
})
