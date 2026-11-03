import { describe, expect, it } from 'vitest'
import { numberToWords } from '../../src/lib/numberWords.ts'

describe('numberToWords in Persian', () => {
  it.each([
    [7, 'هفت'],
    [15, 'پانزده'],
    [40, 'چهل'],
    [125, 'صد و بیست و پنج'],
    [1000, 'هزار'],
    [1500, 'هزار و پانصد'],
    [120000, 'صد و بیست هزار'],
    [1250000, 'یک میلیون و دویست و پنجاه هزار'],
    [2000001, 'دو میلیون و یک'],
    [3000000000, 'سه میلیارد'],
  ])('%d → %s', (n, words) => {
    expect(numberToWords(n, 'fa')).toBe(words)
  })
})

describe('numberToWords in English', () => {
  it.each([
    [7, 'seven'],
    [15, 'fifteen'],
    [125, 'one hundred twenty-five'],
    [1000, 'one thousand'],
    [120000, 'one hundred twenty thousand'],
    [1250000, 'one million two hundred fifty thousand'],
    [2000001, 'two million one'],
  ])('%d → %s', (n, words) => {
    expect(numberToWords(n, 'en')).toBe(words)
  })
})

describe('numberToWords edge cases', () => {
  it.each([0, -5, 1.5, 1e15, Number.NaN])('returns empty for %d', (n) => {
    expect(numberToWords(n, 'fa')).toBe('')
  })
})
