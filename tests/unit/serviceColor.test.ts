import { describe, expect, it } from 'vitest'
import { serviceColor } from '../../src/ui/serviceColor.ts'

const COLORS = [
  '#a3164d',
  '#d98fb0',
  '#6b2c91',
  '#2c7a91',
  '#c06a2b',
  '#3d8b5f',
  '#8a5a44',
  '#4a5bb5',
]

describe('serviceColor', () => {
  it('gives the same name the same colour every time', () => {
    expect(serviceColor('Gel Manicure')).toBe(serviceColor('Gel Manicure'))
    expect(serviceColor('gel manicure')).toBe(serviceColor('Gel Manicure'))
  })

  it('always returns one of the eight colours', () => {
    for (const name of ['', 'Manicure', 'Pedicure', 'Gel-X', 'Nail Art / Design', 'Other']) {
      expect(COLORS).toContain(serviceColor(name))
    }
  })
})
