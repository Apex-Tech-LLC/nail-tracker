// Money is always a whole number of cents. Text is split on the dot and each
// part is parsed as a whole number, so no cent is ever lost to a float.

export const MAX_CENTS = 99_999_999

const AMOUNT = /^\d*\.?\d{0,2}$/
const SEPARATORS = /[,\s]/g

/** Parses already sign- and dollar-stripped text as a non-negative amount. */
function parseAmountParts(raw: string): number | null {
  const text = raw.replace(SEPARATORS, '')
  if (!AMOUNT.test(text) || !/\d/.test(text)) return null

  const [whole = '', fraction = ''] = text.split('.')
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'))
  return cents > MAX_CENTS ? null : cents
}

export function parseCents(input: string): number | null {
  let text = input.trim()
  if (text.startsWith('$')) text = text.slice(1)
  return parseAmountParts(text)
}

export function parseSignedCents(input: string): number | null {
  let text = input.trim()
  let negative = false
  if (text.startsWith('-') || text.startsWith('−')) {
    negative = true
    text = text.slice(1)
  }
  if (text.startsWith('$')) text = text.slice(1)

  const cents = parseAmountParts(text)
  if (cents === null) return null
  return negative ? -cents : cents
}

const dollarFormat = new Intl.NumberFormat('en-US')

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.trunc(abs / 100)
  const rest = abs % 100
  return `${sign}$${dollarFormat.format(dollars)}.${String(rest).padStart(2, '0')}`
}

/** Like formatUsd, but a whole dollar amount drops the cents: $35, $35.50. */
export function formatUsdShort(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.trunc(abs / 100)
  const rest = abs % 100
  if (rest === 0) return `${sign}$${dollarFormat.format(dollars)}`
  return `${sign}$${dollarFormat.format(dollars)}.${String(rest).padStart(2, '0')}`
}

/** Whole dollars only, rounded to the nearest dollar: $212 for 21250. */
export function formatUsdWhole(cents: number): string {
  const whole = roundDiv(cents, 100)
  return `${whole < 0 ? '-' : ''}$${dollarFormat.format(Math.abs(whole))}`
}

/**
 * Types one number-pad key into a money box. Digits append, one dot opens the
 * cents, and a key that would break the two-decimal shape or the cents limit is
 * refused, leaving the value as it was.
 */
export function padAmount(value: string, key: string): string {
  if (key === '.') {
    if (value.includes('.')) return value
    return value === '' ? '0.' : `${value}.`
  }
  if (!/^\d$/.test(key)) return value

  const dot = value.indexOf('.')
  if (dot !== -1 && value.length - dot - 1 >= 2) return value

  const next = value + key
  return parseCents(next) === null ? value : next
}

export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.trunc(abs / 100)
  const rest = abs % 100
  return `${sign}${dollars}.${String(rest).padStart(2, '0')}`
}

export function roundDiv(n: number, d: number): number {
  const rounded = Math.floor((Math.abs(n) * 2 + d) / (2 * d))
  return n < 0 ? -rounded : rounded
}

export function parseRateBp(input: string): number | null {
  let text = input.trim()
  if (text.endsWith('%')) text = text.slice(0, -1).trim()

  const bp = parseAmountParts(text)
  if (bp === null || bp > 10_000) return null
  return bp
}

function rateText(bp: number): string {
  const whole = Math.trunc(bp / 100)
  const rest = bp % 100
  if (rest === 0) return String(whole)
  if (rest % 10 === 0) return `${whole}.${rest / 10}`
  return `${whole}.${String(rest).padStart(2, '0')}`
}

export function formatRate(bp: number): string {
  return `${rateText(bp)}%`
}

export function rateToInput(bp: number): string {
  return rateText(bp)
}
