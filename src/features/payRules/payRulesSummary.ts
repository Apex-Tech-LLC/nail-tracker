import type { Guarantee, PayRules, SupplyFee, Tiers } from '../../domain/payRules.ts'
import { formatRate, formatUsdShort } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'

type RulesShape = Pick<PayRules, 'supplyFee' | 'cardTipFeeBp' | 'checkBp' | 'guarantee' | 'tiers'>

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

export function guaranteeSummary(locale: Locale, guarantee: Guarantee): string | null {
  if (guarantee.kind === 'none') return null
  const amount = formatUsdShort(guarantee.cents)
  const summary =
    guarantee.kind === 'perDay'
      ? tf(locale, 'guaranteePerDaySummary', { amount })
      : tf(locale, 'guaranteePerPeriodSummary', { amount })
  if (guarantee.minDays === null) return summary
  return `${summary} · ${tf(locale, 'guaranteeFromDays', { days: guarantee.minDays })}`
}

export function tiersSummary(locale: Locale, tiers: Tiers | null): string | null {
  if (tiers === null) return null
  return tf(locale, 'tiersSummary', {
    rates: tiers.levels.map((level) => formatRate(level.rateBp)).join(' / '),
  })
}

/** One line for the Settings row: rate, supply fee, card-tip fee, check/cash split, guarantee and tiers. */
export function payRulesSummary(locale: Locale, rateBp: number, rules: RulesShape): string {
  return [
    formatRate(rateBp),
    supplyFeeSummary(locale, rules.supplyFee),
    cardTipFeeSummary(locale, rules.cardTipFeeBp),
    splitSummary(locale, rules.checkBp),
    guaranteeSummary(locale, rules.guarantee),
    tiersSummary(locale, rules.tiers),
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')
}
