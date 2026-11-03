import { describe, expect, it } from 'vitest'

// Smoke test so the test runner is wired up before real tests land.
describe('test setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
