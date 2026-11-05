import { describe, expect, it } from 'vitest'
import {
  MAX_CENTS,
  centsToInput,
  formatRate,
  formatUsd,
  parseCents,
  parseRateBp,
  parseSignedCents,
  rateToInput,
  roundDiv,
} from '../../src/domain/money.ts'

describe('parseCents', () => {
  it.each([
    ['45', 4500],
    ['45.5', 4550],
    ['45.50', 4550],
    ['.5', 50],
    ['0', 0],
    ['0.00', 0],
    ['$45', 4500],
    ['$ 45.10', 4510],
    ['1,234.56', 123456],
    ['  19.99  ', 1999],
    ['45.', 4500],
    ['999999.99', MAX_CENTS],
  ])('parses %j as %d', (input, expected) => {
    expect(parseCents(input)).toBe(expected)
  })

  it.each([[''], ['   '], ['.'], ['$'], ['abc'], ['12a'], ['1.234'], ['-5'], ['1e5'], ['1000000'], ['12.3.4']])('rejects %j', (input) => {
    expect(parseCents(input)).toBeNull()
  })

  it('never loses a cent to floating point', () => {
    expect(parseCents('19.99')).toBe(1999)
    expect(parseCents('1.15')).toBe(115)
    expect(parseCents('4.35')).toBe(435)
    expect(parseCents('1.10')).toBe(110)
  })
})

describe('parseSignedCents', () => {
  it.each([
    ['25', 2500],
    ['-25', -2500],
    ['−25.50', -2550],
    ['-$5', -500],
    ['$5', 500],
  ])('parses %j as %d', (input, expected) => {
    expect(parseSignedCents(input)).toBe(expected)
  })

  it.each([[''], ['-'], ['--5'], ['abc'], ['1.234']])('rejects %j', (input) => {
    expect(parseSignedCents(input)).toBeNull()
  })
})

describe('formatUsd', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [4550, '$45.50'],
    [123456, '$1,234.56'],
    [100000000, '$1,000,000.00'],
    [-500, '-$5.00'],
    [-123456, '-$1,234.56'],
  ])('formats %d as %s', (cents, expected) => {
    expect(formatUsd(cents)).toBe(expected)
  })
})

describe('centsToInput', () => {
  it.each([
    [0, '0.00'],
    [4550, '45.50'],
    [5, '0.05'],
    [123456, '1234.56'],
    [-2550, '-25.50'],
  ])('writes %d as %s', (cents, expected) => {
    expect(centsToInput(cents)).toBe(expected)
  })

  it('round-trips through parseCents', () => {
    for (const cents of [0, 1, 99, 100, 1999, 123456]) expect(parseCents(centsToInput(cents))).toBe(cents)
  })
})

describe('roundDiv', () => {
  it.each([
    [10, 4, 3], // 2.5 rounds up
    [9, 4, 2], // 2.25 rounds down
    [11, 4, 3], // 2.75 rounds up
    [0, 7, 0],
    [-10, 4, -3], // halves round away from zero
    [-9, 4, -2],
    [12493750, 10000, 1249],
    [9975000, 10000, 998],
  ])('%d / %d is %d', (numerator, denominator, expected) => {
    expect(roundDiv(numerator, denominator)).toBe(expected)
  })
})

describe('parseRateBp', () => {
  it.each([
    ['60', 6000],
    ['60%', 6000],
    ['60 %', 6000],
    ['62.5', 6250],
    ['33.33', 3333],
    ['0', 0],
    ['100', 10000],
    ['.5', 50],
    ['57.29', 5729],
  ])('parses %j as %d', (input, expected) => {
    expect(parseRateBp(input)).toBe(expected)
  })

  it.each([[''], ['abc'], ['100.01'], ['101'], ['-5'], ['33.333'], ['%']])('rejects %j', (input) => {
    expect(parseRateBp(input)).toBeNull()
  })
})

describe('formatRate and rateToInput', () => {
  it.each([
    [6000, '60%', '60'],
    [6250, '62.5%', '62.5'],
    [3333, '33.33%', '33.33'],
    [0, '0%', '0'],
    [10000, '100%', '100'],
    [5005, '50.05%', '50.05'],
  ])('%d is %s', (bp, shown, typed) => {
    expect(formatRate(bp)).toBe(shown)
    expect(rateToInput(bp)).toBe(typed)
  })
})
