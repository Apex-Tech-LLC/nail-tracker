import type { Statement } from './statement.ts'

export interface Received {
  checkCents: number
  cashCents: number
  otherCents: number
}

export interface Stub {
  servicesCents: number | null
  tipsCents: number | null
  deductionsCents: number | null
}

export type Reason =
  | { kind: 'servicesLess' | 'servicesMore'; differenceCents: number }
  | { kind: 'deductionsMore' | 'deductionsLess'; differenceCents: number }
  | { kind: 'cardTips'; salonCents: number; yoursCents: number }
  | {
      kind: 'partShort' | 'partOver'
      part: 'check' | 'cash'
      differenceCents: number
      otherPartMatches: boolean
    }

export interface CheckResult {
  kind: 'matches' | 'short' | 'over'
  differenceCents: number
  reasons: Reason[]
}

/** Within a dollar: pay slips round, so a cent or two either way is not a problem. */
const TOLERANCE_CENTS = 100

export function checkPaycheck(
  statement: Statement,
  received: Received,
  stub: Stub | null,
): CheckResult {
  const receivedCents = received.checkCents + received.cashCents + received.otherCents
  const differenceCents = Math.abs(receivedCents - statement.salonPaysCents)
  const kind =
    differenceCents <= TOLERANCE_CENTS ? 'matches' : receivedCents < statement.salonPaysCents ? 'short' : 'over'

  const reasons: Reason[] = []

  if (stub !== null) {
    if (stub.servicesCents !== null && stub.servicesCents !== statement.servicesTotalCents) {
      if (stub.servicesCents < statement.servicesTotalCents) {
        reasons.push({ kind: 'servicesLess', differenceCents: statement.servicesTotalCents - stub.servicesCents })
      } else {
        reasons.push({ kind: 'servicesMore', differenceCents: stub.servicesCents - statement.servicesTotalCents })
      }
    }

    if (stub.deductionsCents !== null) {
      const expectedDeductions = statement.supplyFeeCents + statement.cardTipFeeCents
      if (stub.deductionsCents > expectedDeductions) {
        reasons.push({ kind: 'deductionsMore', differenceCents: stub.deductionsCents - expectedDeductions })
      } else if (stub.deductionsCents < expectedDeductions) {
        reasons.push({ kind: 'deductionsLess', differenceCents: expectedDeductions - stub.deductionsCents })
      }
    }

    if (stub.tipsCents !== null && stub.tipsCents !== statement.cardTipsCents) {
      reasons.push({ kind: 'cardTips', salonCents: stub.tipsCents, yoursCents: statement.cardTipsCents })
    }
  }

  if (kind !== 'matches' && statement.checkCents !== null && statement.cashCents !== null) {
    const checkDifference = received.checkCents - statement.checkCents
    const cashDifference = received.cashCents - statement.cashCents
    if (checkDifference !== 0) {
      reasons.push({
        kind: checkDifference < 0 ? 'partShort' : 'partOver',
        part: 'check',
        differenceCents: Math.abs(checkDifference),
        otherPartMatches: cashDifference === 0,
      })
    }
    if (cashDifference !== 0) {
      reasons.push({
        kind: cashDifference < 0 ? 'partShort' : 'partOver',
        part: 'cash',
        differenceCents: Math.abs(cashDifference),
        otherPartMatches: checkDifference === 0,
      })
    }
  }

  return { kind, differenceCents, reasons }
}
