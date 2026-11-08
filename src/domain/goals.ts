import type { IsoDate } from './dates.ts'

export type GoalKind = 'week' | 'month'

export interface GoalProgress {
  /** Money still to earn, never below zero. */
  toGoCents: number
  /** How full the bar is, from 0 to 100. */
  fillPercent: number
}

/** Progress toward a goal in whole cents. A goal of zero or less counts as unreachable, not as met. */
export function goalProgress(earnedCents: number, goalCents: number): GoalProgress {
  if (goalCents <= 0) return { toGoCents: 0, fillPercent: 0 }
  const toGoCents = Math.max(0, goalCents - earnedCents)
  const fillPercent = Math.min(100, Math.max(0, Math.round((earnedCents / goalCents) * 100)))
  return { toGoCents, fillPercent }
}

/** Reminder key for the one-time "you hit your goal" message: kind plus the period start. */
export function goalMessageKey(kind: GoalKind, periodStart: IsoDate): string {
  return `goal:${kind}:${periodStart}`
}
