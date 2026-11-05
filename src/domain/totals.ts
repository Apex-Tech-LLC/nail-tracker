import { roundDiv } from './money.ts'

export type AdjustmentCategory = 'bonus' | 'commissionCorrection' | 'tipCorrection' | 'bookkeepingDeduction'

export interface TurnFigures {
  localWorkDate: string
  turnCount: number
  serviceRevenueTotalCents: number
  commissionTotalCents: number
  cashTipCents: number
  cardTipCents: number
  cashTipReceived: boolean
  cardTipReceived: boolean
}

export interface AdjustmentFigures {
  amountCents: number
  category: AdjustmentCategory
}

export interface Totals {
  turns: number
  customers: number
  workDays: number
  serviceRevenueCents: number
  commissionCents: number
  cashTipsCents: number
  cardTipsCents: number
  tipsCents: number
  adjustmentsCents: number
  earnedCents: number
  tipsInHandCents: number
  expectedPayoutCents: number
}

/** Only bookkeeping deductions sit outside the payout: they explain money, they do not move it. */
export function adjustmentAffectsPayout(category: AdjustmentCategory): boolean {
  return category !== 'bookkeepingDeduction'
}

export function sumTotals(
  turns: readonly TurnFigures[],
  adjustments: readonly AdjustmentFigures[],
): Totals {
  const workDays = new Set(turns.map((turn) => turn.localWorkDate))
  const totals: Totals = {
    turns: 0,
    customers: 0,
    workDays: workDays.size,
    serviceRevenueCents: 0,
    commissionCents: 0,
    cashTipsCents: 0,
    cardTipsCents: 0,
    tipsCents: 0,
    adjustmentsCents: 0,
    earnedCents: 0,
    tipsInHandCents: 0,
    expectedPayoutCents: 0,
  }

  for (const turn of turns) {
    totals.turns += turn.turnCount
    if (turn.turnCount >= 1) totals.customers += 1
    totals.serviceRevenueCents += turn.serviceRevenueTotalCents
    totals.commissionCents += turn.commissionTotalCents
    totals.cashTipsCents += turn.cashTipCents
    totals.cardTipsCents += turn.cardTipCents
    if (turn.cashTipReceived) totals.tipsInHandCents += turn.cashTipCents
    if (turn.cardTipReceived) totals.tipsInHandCents += turn.cardTipCents
  }

  for (const adjustment of adjustments) {
    totals.adjustmentsCents += adjustment.amountCents
    if (adjustmentAffectsPayout(adjustment.category)) {
      totals.expectedPayoutCents += adjustment.amountCents
    }
  }

  totals.tipsCents = totals.cashTipsCents + totals.cardTipsCents
  totals.earnedCents = totals.commissionCents + totals.tipsCents + totals.adjustmentsCents
  totals.expectedPayoutCents += totals.commissionCents + totals.tipsCents - totals.tipsInHandCents

  return totals
}

export function averages(totals: Totals): {
  earnedPerTurnCents: number
  tipsPerTurnCents: number
  earnedPerWorkDayCents: number
} {
  return {
    earnedPerTurnCents: totals.turns === 0 ? 0 : roundDiv(totals.earnedCents, totals.turns),
    tipsPerTurnCents: totals.turns === 0 ? 0 : roundDiv(totals.tipsCents, totals.turns),
    earnedPerWorkDayCents: totals.workDays === 0 ? 0 : roundDiv(totals.earnedCents, totals.workDays),
  }
}

/** Turn numbers count every turn in time order, so a customer sees a steady running total. */
export function numberTurns(
  turns: readonly { id: string; turnCount: number; occurredAt: number; createdAt: number }[],
): Map<string, number | null> {
  const ordered = [...turns].sort(
    (a, b) => a.occurredAt - b.occurredAt || a.createdAt - b.createdAt,
  )

  const numbers = new Map<string, number | null>()
  let running = 0
  for (const turn of ordered) {
    if (turn.turnCount === 0) {
      numbers.set(turn.id, null)
      continue
    }
    running += turn.turnCount
    numbers.set(turn.id, running)
  }
  return numbers
}
