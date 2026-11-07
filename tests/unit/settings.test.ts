import { describe, expect, it } from 'vitest'
import { detectLocale, resolveSettings } from '../../src/app/settings.ts'

describe('detectLocale', () => {
  it.each([
    [['vi-VN', 'en-US'], 'vi'],
    [['VI'], 'vi'],
    [['en-US', 'vi-VN'], 'en'],
    [['de-DE'], 'en'],
    [[], 'en'],
  ] as const)('%j → %s', (languages, locale) => {
    expect(detectLocale(languages)).toBe(locale)
  })
})

describe('resolveSettings', () => {
  const defaults = {
    locale: 'en',
    defaultCommissionRateBp: 6000,
    perServiceRates: false,
    weekStartDay: 0,
    payPeriodType: 'none',
    payPeriodAnchorDate: null,
    cashTipHandling: 'inHand',
    cardTipHandling: 'fromSalon',
    lastServicePresetId: null,
    tipButtonsTarget: 'cash',
    onboardingDone: false,
  }

  it('uses English defaults when nothing is saved', () => {
    expect(resolveSettings(null, ['en-GB'])).toEqual(defaults)
  })

  it('prefers the saved choice over the browser language', () => {
    const saved = JSON.stringify({ locale: 'en', defaultCommissionRateBp: 5000, weekStartDay: 1 })
    expect(resolveSettings(saved, ['vi-VN'])).toMatchObject({ locale: 'en', defaultCommissionRateBp: 5000, weekStartDay: 1 })
  })

  it.each([
    'not json',
    '42',
    'null',
    '{"locale":"fa","defaultCommissionRateBp":20000,"payPeriodType":"daily"}',
  ])('ignores bad saved value %j', (saved) => {
    expect(resolveSettings(saved, ['vi-VN'])).toMatchObject({ locale: 'vi', defaultCommissionRateBp: 6000, payPeriodType: 'none' })
  })
})
