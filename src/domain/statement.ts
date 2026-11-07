import type { IsoDate } from './dates.ts'
import { roundDiv } from './money.ts'
import { rulesOn, type FeeWhen, type PayRules, type SupplyFee } from './payRules.ts'
import { adjustmentAffectsPayout, type AdjustmentFigures, type TurnFigures } from './totals.ts'

export interface StatementService {
  localWorkDate: IsoDate
  priceCents: number
  commissionRateBp: number
  commissionCents: number
}

export interface Statement {
  daysWorked: number
  turns: number
  services: number
  servicesTotalCents: number
  supplyFeeCents: number
  supplyFeeWhen: FeeWhen | null
  shareRateBp: number | null // the one rate when every service used the same rate, else null
  shareBaseCents: number // what the rate was applied to (services total minus a before-split fee)
  shareCents: number // your share after the supply fee
  cardTipsCents: number
  cardTipsHeldCents: number
  cardTipFeeCents: number
  adjustmentsCents: number // only those that change pay (adjustmentAffectsPayout)
  guaranteeTopUpCents: number // always 0 until release 2.4
  salonPaysCents: number
  checkCents: number | null
  cashCents: number | null
  cashTipsInHandCents: number
  earnedTotalCents: number
  byDay: {
    date: IsoDate
    servicesTotalCents: number
    shareCents: number
    cardTipsCents: number
  }[]
}

function feeForService(fee: SupplyFee, priceCents: number): number {
  if (priceCents <= 0) return 0
  if (fee.kind === 'perService') return fee.cents
  if (fee.kind === 'percent') return roundDiv(priceCents * fee.bp, 10_000)
  return 0
}

function feeWhen(fee: SupplyFee): FeeWhen | null {
  return fee.kind === 'none' ? null : fee.when
}

interface DayLine {
  servicesTotalCents: number
  shareCents: number
  cardTipsCents: number
}

function dayLine(days: Map<IsoDate, DayLine>, date: IsoDate): DayLine {
  let line = days.get(date)
  if (!line) {
    line = { servicesTotalCents: 0, shareCents: 0, cardTipsCents: 0 }
    days.set(date, line)
  }
  return line
}

export function buildStatement(input: {
  services: readonly StatementService[]
  turns: readonly TurnFigures[]
  adjustments: readonly AdjustmentFigures[]
  rules: readonly PayRules[]
  periodEnd: IsoDate
}): Statement {
  const { services, turns, adjustments, rules, periodEnd } = input
  const endRules = rulesOn(rules, periodEnd)
  const days = new Map<IsoDate, DayLine>()

  let servicesTotalCents = 0
  let supplyFeeCents = 0
  let beforeSplitFeeCents = 0
  let shareCents = 0
  let shareRateBp: number | null = null
  let sameRate = true

  for (const service of services) {
    servicesTotalCents += service.priceCents
    if (services.length > 0) {
      if (shareRateBp === null) shareRateBp = service.commissionRateBp
      else if (shareRateBp !== service.commissionRateBp) sameRate = false
    }

    const serviceRules = rulesOn(rules, service.localWorkDate)
    const fee = Math.min(feeForService(serviceRules.supplyFee, service.priceCents), service.priceCents)
    supplyFeeCents += fee

    let share: number
    if (feeWhen(serviceRules.supplyFee) === 'beforeSplit') {
      beforeSplitFeeCents += fee
      share = roundDiv((service.priceCents - fee) * service.commissionRateBp, 10_000)
    } else {
      // The split already happened, so the saved commission is the starting point.
      share = Math.max(0, service.commissionCents - fee)
    }
    shareCents += share

    const line = dayLine(days, service.localWorkDate)
    line.servicesTotalCents += service.priceCents
    line.shareCents += share
  }

  let cardTipsCents = 0
  let cardTipsHeldCents = 0
  let cardTipsInHandCents = 0
  let heldCardTipFeeCents = 0
  let cardTipFeeCents = 0
  let cashTipsInHandCents = 0
  let turnCount = 0
  const workedDays = new Set<IsoDate>()

  for (const turn of turns) {
    turnCount += turn.turnCount
    if (turn.turnCount >= 1) workedDays.add(turn.localWorkDate)
    if (turn.cashTipReceived) cashTipsInHandCents += turn.cashTipCents

    cardTipsCents += turn.cardTipCents
    const turnRules = rulesOn(rules, turn.localWorkDate)
    const fee = roundDiv(turn.cardTipCents * turnRules.cardTipFeeBp, 10_000)
    cardTipFeeCents += fee
    if (turn.cardTipReceived) {
      cardTipsInHandCents += turn.cardTipCents
    } else {
      cardTipsHeldCents += turn.cardTipCents
      heldCardTipFeeCents += fee
    }

    dayLine(days, turn.localWorkDate).cardTipsCents += turn.cardTipCents
  }

  let adjustmentsCents = 0
  let adjustmentsOutsidePay = 0
  for (const adjustment of adjustments) {
    if (adjustmentAffectsPayout(adjustment.category)) adjustmentsCents += adjustment.amountCents
    else adjustmentsOutsidePay += adjustment.amountCents
  }

  const guaranteeTopUpCents = 0
  const salonPaysCents =
    shareCents + guaranteeTopUpCents + cardTipsHeldCents - cardTipFeeCents + adjustmentsCents

  let checkCents: number | null = null
  let cashCents: number | null = null
  if (endRules.checkBp !== null) {
    let partBaseCents = salonPaysCents
    const netHeldCardTips = cardTipsHeldCents - heldCardTipFeeCents
    if (endRules.cardTipsPaidIn === 'check' || endRules.cardTipsPaidIn === 'cash') {
      partBaseCents -= netHeldCardTips
    }
    checkCents = roundDiv(partBaseCents * endRules.checkBp, 10_000)
    if (endRules.cardTipsPaidIn === 'check') checkCents += netHeldCardTips
    cashCents = salonPaysCents - checkCents
  }

  const shareBaseCents = servicesTotalCents - beforeSplitFeeCents
  const earnedTotalCents =
    salonPaysCents + cashTipsInHandCents + cardTipsInHandCents + adjustmentsOutsidePay

  return {
    daysWorked: workedDays.size,
    turns: turnCount,
    services: services.length,
    servicesTotalCents,
    supplyFeeCents,
    supplyFeeWhen: feeWhen(endRules.supplyFee),
    shareRateBp: sameRate ? shareRateBp : null,
    shareBaseCents,
    shareCents,
    cardTipsCents,
    cardTipsHeldCents,
    cardTipFeeCents,
    adjustmentsCents,
    guaranteeTopUpCents,
    salonPaysCents,
    checkCents,
    cashCents,
    cashTipsInHandCents,
    earnedTotalCents,
    byDay: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, line]) => ({ date, ...line })),
  }
}
