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
    theme: 'system',
    defaultCommissionRateBp: 6000,
    perServiceRates: false,
    weekStartDay: 0,
    payPeriodType: 'none',
    payPeriodAnchorDate: null,
    cashTipHandling: 'inHand',
    cardTipHandling: 'fromSalon',
    lastServicePresetId: null,
    tipButtonsTarget: 'cash',
    numberPad: true,
    onboardingDone: false,
    sayHowToSeen: false,
    hoursOn: false,
    minimumWageCents: null,
    backupReminderDays: 14,
    lastBackupDate: null,
    dismissedReminders: {},
    weeklyGoalCents: null,
    monthlyGoalCents: null,
    taxSetAsideBp: null,
  }

  it('uses English defaults when nothing is saved', () => {
    expect(resolveSettings(null, ['en-GB'])).toEqual(defaults)
  })

  it('prefers the saved choice over the browser language', () => {
    const saved = JSON.stringify({ locale: 'en', defaultCommissionRateBp: 5000, weekStartDay: 1 })
    expect(resolveSettings(saved, ['vi-VN'])).toMatchObject({ locale: 'en', defaultCommissionRateBp: 5000, weekStartDay: 1 })
  })

  it.each(['light', 'dark'] as const)('keeps the saved theme %s', (theme) => {
    expect(resolveSettings(JSON.stringify({ theme }), []).theme).toBe(theme)
  })

  it('reads any other theme as the phone choice', () => {
    expect(resolveSettings(null, []).theme).toBe('system')
    expect(resolveSettings(JSON.stringify({ theme: 'sepia' }), []).theme).toBe('system')
  })

  it('uses the app number pad unless the person turned it off', () => {
    expect(resolveSettings(null, []).numberPad).toBe(true)
    expect(resolveSettings(JSON.stringify({ numberPad: false }), []).numberPad).toBe(false)
  })

  it.each([
    'not json',
    '42',
    'null',
    '{"locale":"fa","defaultCommissionRateBp":20000,"payPeriodType":"daily"}',
  ])('ignores bad saved value %j', (saved) => {
    expect(resolveSettings(saved, ['vi-VN'])).toMatchObject({ locale: 'vi', defaultCommissionRateBp: 6000, payPeriodType: 'none' })
  })

  it('keeps a saved backup reminder choice, last backup date and dismissals', () => {
    const saved = JSON.stringify({
      backupReminderDays: 30,
      lastBackupDate: '2026-11-04',
      dismissedReminders: { 'backup:2026-10-01': '2026-11-04' },
    })
    expect(resolveSettings(saved, [])).toMatchObject({
      backupReminderDays: 30,
      lastBackupDate: '2026-11-04',
      dismissedReminders: { 'backup:2026-10-01': '2026-11-04' },
    })
  })

  it('keeps the Say how-to as seen only when it was saved as true', () => {
    expect(resolveSettings(JSON.stringify({ sayHowToSeen: true }), []).sayHowToSeen).toBe(true)
    expect(resolveSettings(JSON.stringify({ sayHowToSeen: 'yes' }), []).sayHowToSeen).toBe(false)
    expect(resolveSettings(null, []).sayHowToSeen).toBe(false)
  })

  it('keeps a saved tax set-aside percent and refuses a bad one', () => {
    expect(resolveSettings(JSON.stringify({ taxSetAsideBp: 2000 }), []).taxSetAsideBp).toBe(2000)
    expect(resolveSettings(JSON.stringify({ taxSetAsideBp: 20000 }), []).taxSetAsideBp).toBeNull()
    expect(resolveSettings(JSON.stringify({ taxSetAsideBp: '20%' }), []).taxSetAsideBp).toBeNull()
  })

  it('falls back when the backup reminder settings are malformed', () => {
    const saved = JSON.stringify({
      backupReminderDays: 9,
      lastBackupDate: 'soon',
      dismissedReminders: { 'backup:2026-10-01': 42 },
    })
    expect(resolveSettings(saved, [])).toMatchObject({
      backupReminderDays: 14,
      lastBackupDate: null,
      dismissedReminders: {},
    })
  })

  it('keeps saved weekly and monthly goals', () => {
    const saved = JSON.stringify({ weeklyGoalCents: 100_000, monthlyGoalCents: 400_000 })
    expect(resolveSettings(saved, [])).toMatchObject({
      weeklyGoalCents: 100_000,
      monthlyGoalCents: 400_000,
    })
  })

  it.each([
    { weeklyGoalCents: 0, monthlyGoalCents: -5 },
    { weeklyGoalCents: 12.5, monthlyGoalCents: '4000' },
  ])('falls back when a goal is not whole positive cents in %j', (saved) => {
    expect(resolveSettings(JSON.stringify(saved), [])).toMatchObject({
      weeklyGoalCents: null,
      monthlyGoalCents: null,
    })
  })
})
