import { roundDiv } from './money.ts'

export interface PricedLine {
  priceCents: number
  rateBp: number
}

export interface TurnMoney {
  lineCommissionCents: number[]
  serviceRevenueTotalCents: number
  commissionTotalCents: number
  earnedTotalCents: number
}

/** Price times rate, rounded half up to the cent. Rates are basis points: 6000 is 60%. */
export function commissionCents(priceCents: number, rateBp: number): number {
  return roundDiv(priceCents * rateBp, 10_000)
}

export function turnTotals(
  lines: readonly PricedLine[],
  cashTipCents: number,
  cardTipCents: number,
): TurnMoney {
  const lineCommissionCents = lines.map((line) => commissionCents(line.priceCents, line.rateBp))
  const serviceRevenueTotalCents = lines.reduce((sum, line) => sum + line.priceCents, 0)
  // Each line is rounded on its own before the lines are added.
  const commissionTotalCents = lineCommissionCents.reduce((sum, cents) => sum + cents, 0)

  return {
    lineCommissionCents,
    serviceRevenueTotalCents,
    commissionTotalCents,
    earnedTotalCents: commissionTotalCents + cashTipCents + cardTipCents,
  }
}
