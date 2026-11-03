import { describe, expect, it } from 'vitest'
import { detectLocale, resolveSettings } from '../../src/app/settings.ts'

describe('detectLocale', () => {
  it.each([
    [['fa-IR', 'en-US'], 'fa'],
    [['fa'], 'fa'],
    [['FA-ir'], 'fa'],
    [['en-US', 'fa-IR'], 'en'],
    [['de-DE'], 'en'],
    [[], 'en'],
  ] as const)('%j → %s', (languages, locale) => {
    expect(detectLocale(languages)).toBe(locale)
  })
})

describe('resolveSettings', () => {
  it('detects language and uses Jalali when nothing is saved', () => {
    expect(resolveSettings(null, ['en-GB'])).toEqual({ locale: 'en', calendar: 'jalali' })
  })

  it('prefers the saved choice over the browser language', () => {
    const saved = JSON.stringify({ locale: 'en', calendar: 'gregorian' })
    expect(resolveSettings(saved, ['fa-IR'])).toEqual({ locale: 'en', calendar: 'gregorian' })
  })

  it.each(['not json', '{"locale":"de","calendar":"lunar"}', '42', 'null'])('ignores bad saved value %j', (saved) => {
    expect(resolveSettings(saved, ['fa-IR'])).toEqual({ locale: 'fa', calendar: 'jalali' })
  })
})
