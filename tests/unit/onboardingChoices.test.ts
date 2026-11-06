import { describe, expect, it } from 'vitest'
import { resolveSettings } from '../../src/app/settings.ts'
import { tipSettings } from '../../src/features/onboarding/onboardingChoices.ts'

describe('tipSettings', () => {
  const current = resolveSettings(null, ['en-US'])

  it('standard keeps cash tips in hand and card tips with the salon', () => {
    expect(tipSettings('standard', current)).toEqual({
      cashTipHandling: 'inHand',
      cardTipHandling: 'fromSalon',
    })
  })

  it('allPayday sends both kinds of tips to payday', () => {
    expect(tipSettings('allPayday', current)).toEqual({
      cashTipHandling: 'fromSalon',
      cardTipHandling: 'fromSalon',
    })
  })

  it('custom keeps the values that are already saved', () => {
    const changed = { ...current, cashTipHandling: 'fromSalon' as const, cardTipHandling: 'inHand' as const }
    expect(tipSettings('custom', changed)).toEqual({
      cashTipHandling: 'fromSalon',
      cardTipHandling: 'inHand',
    })
  })
})
