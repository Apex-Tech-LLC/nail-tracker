import type { Settings } from '../../app/settings.ts'

export type TipChoice = 'standard' | 'allPayday' | 'custom'

/** What each tip answer means for the two tip settings. Custom keeps what is there, and the person picks in Settings. */
export function tipSettings(choice: TipChoice, current: Settings): Pick<Settings, 'cashTipHandling' | 'cardTipHandling'> {
  if (choice === 'standard') return { cashTipHandling: 'inHand', cardTipHandling: 'fromSalon' }
  if (choice === 'allPayday') return { cashTipHandling: 'fromSalon', cardTipHandling: 'fromSalon' }
  return { cashTipHandling: current.cashTipHandling, cardTipHandling: current.cardTipHandling }
}
