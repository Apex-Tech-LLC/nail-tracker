import type { PayRules, SupplyFee } from '../../domain/payRules.ts'
import { formatRate, formatUsdShort } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'

type RulesShape = Pick<PayRules, 'supplyFee' | 'cardTipFeeBp' | 'checkBp'>

export function supplyFeeSummary(locale: Locale, fee: SupplyFee): string {
  if (fee.kind === 'none') return t(locale, 'noSupplyFee')
  if (fee.kind === 'perService') {
    return tf(locale, 'supplyFeeAmountSummary', { amount: formatUsdShort(fee.cents) })
  }
  return tf(locale, 'supplyFeePercentSummary', { rate: formatRate(fee.bp) })
}

export function cardTipFeeSummary(locale: Locale, bp: number): string {
  return bp === 0 ? t(locale, 'noCardTipFee') : tf(locale, 'cardTipFee', { rate: formatRate(bp) })
}

export function splitSummary(locale: Locale, checkBp: number | null): string {
  if (checkBp === null) return t(locale, 'noCheckSplit')
  if (checkBp === 5000) return t(locale, 'splitHalfSummary')
  return tf(locale, 'splitPercentSummary', { rate: formatRate(checkBp) })
}

/** One line for the Settings row: rate, supply fee, card-tip fee, check/cash split. */
export function payRulesSummary(locale: Locale, rateBp: number, rules: RulesShape): string {
  return [
    formatRate(rateBp),
    supplyFeeSummary(locale, rules.supplyFee),
    cardTipFeeSummary(locale, rules.cardTipFeeBp),
    splitSummary(locale, rules.checkBp),
  ].join(' · ')
}
