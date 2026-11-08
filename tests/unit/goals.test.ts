import { describe, expect, it } from 'vitest'
import { goalMessageKey, goalProgress } from '../../src/domain/goals.ts'

describe('goalProgress', () => {
  it('gives the money still to earn and how full the bar is', () => {
    expect(goalProgress(64_000, 100_000)).toEqual({ toGoCents: 36_000, fillPercent: 64 })
  })

  it('never asks for less than zero once the goal is passed', () => {
    expect(goalProgress(112_000, 100_000)).toEqual({ toGoCents: 0, fillPercent: 100 })
  })

  it('is full when the goal is landed exactly', () => {
    expect(goalProgress(100_000, 100_000)).toEqual({ toGoCents: 0, fillPercent: 100 })
  })

  it('starts empty when nothing is earned', () => {
    expect(goalProgress(0, 100_000)).toEqual({ toGoCents: 100_000, fillPercent: 0 })
  })

  it('rounds the fill to the nearest whole percent', () => {
    expect(goalProgress(1, 3)).toEqual({ toGoCents: 2, fillPercent: 33 })
    expect(goalProgress(2, 3)).toEqual({ toGoCents: 1, fillPercent: 67 })
  })

  it('treats a goal of zero or less as nothing to fill', () => {
    expect(goalProgress(50_000, 0)).toEqual({ toGoCents: 0, fillPercent: 0 })
    expect(goalProgress(50_000, -1)).toEqual({ toGoCents: 0, fillPercent: 0 })
  })
})

describe('goalMessageKey', () => {
  it('names the kind and the period start, once each week or month', () => {
    expect(goalMessageKey('week', '2026-11-01')).toBe('goal:week:2026-11-01')
    expect(goalMessageKey('month', '2026-11-01')).toBe('goal:month:2026-11-01')
  })
})
