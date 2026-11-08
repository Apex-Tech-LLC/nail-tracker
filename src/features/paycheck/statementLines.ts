import type { PayRules } from '../../domain/payRules.ts'
import { formatRate, formatUsd, formatUsdShort } from '../../domain/money.ts'
import type { Statement } from '../../domain/statement.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'

export type StatementEndRules = Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'>

export interface StatementLine {
  label: string
  value: string
  strong?: boolean
  large?: boolean
  indent?: boolean
}

export type StatementItem =
  | { kind: 'line'; line: StatementLine }
  | { kind: 'rule' }

export function daysWorkedLabel(locale: Locale, days: number): string {
  return days === 1 ? t(locale, 'daysWorkedOne') : tf(locale, 'daysWorked', { n: days })
}

/**
 * Every line the statement shows, in the order the card shows them, so the
 * card and the shared picture cannot drift apart. One rule marks the divider
 * before "Salon should pay you".
 */
export function statementItems(
  locale: Locale,
  statement: Statement,
  endRules: StatementEndRules,
): StatementItem[] {
  const items: StatementItem[] = []
  const add = (line: StatementLine) => items.push({ kind: 'line', line })

  add({
    label:
      statement.services === 1 && statement.turns === 1
        ? t(locale, 'statementServicesLineOne')
        : tf(locale, 'statementServicesLine', {
            services: statement.services,
            turns: statement.turns,
          }),
    value: formatUsd(statement.servicesTotalCents),
  })

  if (endRules.supplyFee.kind === 'perService') {
    add({
      label: tf(
        locale,
        statement.services === 1
          ? 'statementSupplyFeePerServiceOne'
          : 'statementSupplyFeePerService',
        { amount: formatUsdShort(endRules.supplyFee.cents), n: statement.services },
      ),
      value: `− ${formatUsd(statement.supplyFeeCents)}`,
    })
  } else if (endRules.supplyFee.kind === 'percent') {
    add({
      label: tf(locale, 'statementSupplyFeePercent', {
        rate: formatRate(endRules.supplyFee.bp),
      }),
      value: `− ${formatUsd(statement.supplyFeeCents)}`,
    })
  }

  add({
    label:
      statement.tierRates !== null
        ? tf(locale, 'statementShareWithTiers', {
            rates: statement.tierRates.map(formatRate).join(' / '),
            base: formatUsd(statement.shareBaseCents),
          })
        : statement.shareRateBp !== null && statement.supplyFeeWhen !== 'afterSplit'
          ? tf(locale, 'statementShareWithRate', {
              rate: formatRate(statement.shareRateBp),
              base: formatUsd(statement.shareBaseCents),
            })
          : t(locale, 'statementShare'),
    value: formatUsd(statement.shareCents),
  })

  add({ label: t(locale, 'cardTips'), value: formatUsd(statement.cardTipsCents) })

  if (endRules.cardTipFeeBp > 0) {
    add({
      label: tf(locale, 'statementCardTipFee', { rate: formatRate(endRules.cardTipFeeBp) }),
      value: `− ${formatUsd(statement.cardTipFeeCents)}`,
    })
  }

  if (statement.cashTipsHeldCents > 0) {
    add({
      label: t(locale, 'cashTipsSalonHolds'),
      value: formatUsd(statement.cashTipsHeldCents),
    })
  }

  if (statement.adjustmentsCents !== 0) {
    add({ label: t(locale, 'adjustments'), value: formatUsd(statement.adjustmentsCents) })
  }

  const guarantee = endRules.guarantee
  if (guarantee.kind !== 'none') {
    const days = statement.guaranteeDays
    let label: string
    if (guarantee.minDays !== null && days < guarantee.minDays) {
      label = tf(locale, 'statementGuaranteeMinDays', { needed: guarantee.minDays, days })
    } else if (guarantee.kind === 'perPeriod') {
      const total = formatUsdShort(guarantee.cents)
      label =
        statement.guaranteeTopUpCents > 0
          ? tf(locale, 'statementGuaranteePeriod', { total })
          : tf(locale, 'statementGuaranteePeriodNotNeeded', { total })
    } else {
      const amount = formatUsdShort(guarantee.cents)
      const total = formatUsdShort(guarantee.cents * days)
      label =
        statement.guaranteeTopUpCents > 0
          ? tf(locale, days === 1 ? 'statementGuaranteeTopUpOne' : 'statementGuaranteeTopUp', {
              amount,
              days,
              total,
            })
          : tf(
              locale,
              days === 1 ? 'statementGuaranteeNotNeededOne' : 'statementGuaranteeNotNeeded',
              { amount, days, total },
            )
    }
    add({ label, value: formatUsd(statement.guaranteeTopUpCents) })
  }

  items.push({ kind: 'rule' })

  add({
    label: t(locale, 'salonShouldPay'),
    value: formatUsd(statement.salonPaysCents),
    strong: true,
    large: true,
  })

  const checkBp = endRules.checkBp
  if (checkBp !== null && statement.checkCents !== null && statement.cashCents !== null) {
    add({
      label: tf(locale, 'statementAsCheck', { rate: formatRate(checkBp) }),
      value: formatUsd(statement.checkCents),
      indent: true,
    })
    add({
      label: tf(locale, 'statementAsCash', { rate: formatRate(10_000 - checkBp) }),
      value: formatUsd(statement.cashCents),
      indent: true,
    })
  }

  if (statement.cashTipsInHandCents > 0) {
    add({
      label: t(locale, 'cashTipsAlreadyHave'),
      value: formatUsd(statement.cashTipsInHandCents),
    })
  }

  add({ label: t(locale, 'earnedInTotal'), value: formatUsd(statement.earnedTotalCents) })

  return items
}
