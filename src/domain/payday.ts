export type PayStateName = 'owed' | 'paid' | 'overpaid' | 'empty'

export interface AllocationLine {
  payPeriodId: string
  amountCents: number
}

export function payState(
  expectedCents: number,
  paidCents: number,
): { outstandingCents: number; state: PayStateName } {
  const outstandingCents = expectedCents - paidCents
  if (outstandingCents > 0) return { outstandingCents, state: 'owed' }
  if (outstandingCents < 0) return { outstandingCents, state: 'overpaid' }
  return { outstandingCents, state: expectedCents === 0 ? 'empty' : 'paid' }
}

export function suggestAllocations(
  amountCents: number,
  periods: readonly { payPeriodId: string; outstandingCents: number }[],
  fallbackPeriodId: string,
): AllocationLine[] {
  const lines: AllocationLine[] = []
  let remaining = amountCents

  // The periods arrive oldest first, so this pays the oldest debt first.
  for (const period of periods) {
    if (remaining <= 0) break
    if (period.outstandingCents <= 0) continue

    const amount = Math.min(remaining, period.outstandingCents)
    lines.push({ payPeriodId: period.payPeriodId, amountCents: amount })
    remaining -= amount
  }

  if (remaining > 0) {
    const fallback = lines.find((line) => line.payPeriodId === fallbackPeriodId)
    if (fallback) fallback.amountCents += remaining
    else lines.push({ payPeriodId: fallbackPeriodId, amountCents: remaining })
  }

  return lines
}

export function allocationProblem(
  amountCents: number,
  lines: readonly AllocationLine[],
): 'amount' | 'line' | 'mismatch' | null {
  if (amountCents <= 0) return 'amount'
  if (lines.some((line) => line.amountCents <= 0)) return 'line'

  const allocated = lines.reduce((sum, line) => sum + line.amountCents, 0)
  return allocated === amountCents ? null : 'mismatch'
}
