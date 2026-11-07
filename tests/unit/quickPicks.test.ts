import { describe, expect, it } from 'vitest'
import {
  lastPrice,
  serviceUse,
  topCombos,
  type QuickPickEntry,
  type QuickPickLine,
} from '../../src/domain/quickPicks.ts'

function line(key: string, priceCents: number, name = key): QuickPickLine {
  return { key, name, priceCents }
}

function entry(id: string, occurredAt: number, lines: QuickPickLine[]): QuickPickEntry {
  return { turn: { id, occurredAt }, lines }
}

const GEL = 'gel-manicure'
const ART = 'nail-art'

describe('serviceUse', () => {
  it('counts the turns that used each service key', () => {
    const use = serviceUse([
      entry('a', 100, [line(GEL, 3500), line(ART, 1000)]),
      entry('b', 200, [line(GEL, 3500)]),
      entry('c', 300, [line(ART, 1000), line(GEL, 3500)]),
    ])

    expect(use.get(GEL)).toBe(3)
    expect(use.get(ART)).toBe(2)
    expect(use.get('other')).toBeUndefined()
  })

  it('counts a service once on a turn that lists it twice', () => {
    const use = serviceUse([entry('a', 100, [line(GEL, 3500), line(GEL, 3500)])])
    expect(use.get(GEL)).toBe(1)
  })
})

describe('lastPrice', () => {
  it('follows the newest turn even when an older turn is later in the array', () => {
    const prices = lastPrice([
      entry('new', 200, [line(GEL, 4000)]),
      entry('old', 100, [line(GEL, 3500)]),
    ])
    expect(prices.get(GEL)).toBe(4000)
  })

  it('follows the newest turn when the array is in date order too', () => {
    const prices = lastPrice([
      entry('old', 100, [line(GEL, 3500)]),
      entry('new', 200, [line(GEL, 4000)]),
    ])
    expect(prices.get(GEL)).toBe(4000)
  })
})

describe('topCombos', () => {
  it('treats Gel + Art and Art + Gel at the same prices as one combination', () => {
    const combos = topCombos([
      entry('a', 100, [line(GEL, 3500), line(ART, 1000)]),
      entry('b', 200, [line(ART, 1000), line(GEL, 3500)]),
    ])

    expect(combos).toHaveLength(1)
    expect(combos[0].count).toBe(2)
    // The lines come from the most recent turn, in the order it entered them.
    expect(combos[0].lines.map((item) => item.key)).toEqual([ART, GEL])
  })

  it('leaves out a combination that was used only once', () => {
    expect(topCombos([entry('a', 100, [line(GEL, 3500)])])).toEqual([])
  })

  it('gives the tie to the combination used more recently', () => {
    const combos = topCombos([
      // Both combinations appear twice; B was used last.
      entry('a1', 100, [line('manicure', 2000)]),
      entry('a2', 200, [line('manicure', 2000)]),
      entry('b1', 150, [line('pedicure', 4500)]),
      entry('b2', 300, [line('pedicure', 4500)]),
    ])

    expect(combos.map((combo) => combo.lines[0].key)).toEqual(['pedicure', 'manicure'])
  })

  it('respects the limit', () => {
    const entries: QuickPickEntry[] = []
    for (let index = 0; index < 5; index += 1) {
      entries.push(entry(`a${index}`, index, [line(`service-${index}`, 1000)]))
      entries.push(entry(`b${index}`, index + 10, [line(`service-${index}`, 1000)]))
    }

    expect(topCombos(entries, 2)).toHaveLength(2)
    expect(topCombos(entries)).toHaveLength(4)
  })
})
