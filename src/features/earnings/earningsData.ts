import type { NailDb } from '../../db/schema.ts'
import type { IsoDate } from '../../domain/dates.ts'
import { averages, sumTotals, type Totals } from '../../domain/totals.ts'
import { loadRange } from '../turns/turnStore.ts'

export interface EarningsData {
  totals: Totals
  averages: ReturnType<typeof averages>
  paidInRangeCents: number
  outstandingAllTimeCents: number
}

export async function loadEarnings(
  db: NailDb,
  start: IsoDate,
  end: IsoDate,
): Promise<EarningsData> {
  const [range, paymentsInRange, allTurns, allAdjustments, allPayments] = await Promise.all([
    loadRange(db, start, end),
    db.payments.where('paymentDate').between(start, end, true, true).toArray(),
    db.turns.toArray(),
    db.adjustments.toArray(),
    db.payments.toArray(),
  ])

  const totals = sumTotals(range.turns, range.adjustments)
  const allTotals = sumTotals(allTurns, allAdjustments)

  return {
    totals,
    averages: averages(totals),
    paidInRangeCents: paymentsInRange.reduce((sum, payment) => sum + payment.amountCents, 0),
    // Outstanding is always the whole picture: every turn and adjustment ever
    // recorded, less every payment ever received.
    outstandingAllTimeCents:
      allTotals.expectedPayoutCents -
      allPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
  }
}
