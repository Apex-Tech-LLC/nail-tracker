import type { Locale } from './locale.ts'

// Amounts are integer Toman everywhere. Floats are never stored, because
// 0.1 + 0.2 !== 0.3 and money must add up exactly.

const PERSIAN_ZERO = 0x06f0
const ARABIC_ZERO = 0x0660

// Thousands separators users may type or paste: Latin comma, Arabic
// thousands separator (what fa-IR formatting outputs), Arabic comma,
// apostrophe, and any whitespace.
const SEPARATORS = /[,٬،'\s‌]/g

// Decimal points: Latin dot, Arabic decimal separator, and slash, which
// Persian users often type as a decimal point.
const DECIMAL_POINT = /[.٫/]/

const NEGATIVE_SIGN = /^[-−]/

export function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const code = ch.charCodeAt(0)
    const zero = code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_ZERO
    return String(code - zero)
  })
}

/**
 * Rewrites every digit in the locale's own script, keeping everything else
 * as is. Phone keyboards often type Latin digits even in a Persian UI, so
 * the amount field passes what the user types through this. The length never
 * changes, so the caret can stay where it was.
 */
export function localizeDigits(input: string, locale: Locale): string {
  const latin = normalizeDigits(input)
  if (locale === 'en') return latin
  return latin.replace(/\d/g, (d) => String.fromCharCode(PERSIAN_ZERO + Number(d)))
}

/**
 * Parses a user-typed amount in Toman. Accepts Persian, Arabic and English
 * digits, with or without thousands separators. Returns null for anything
 * that is not a positive whole number.
 */
export function parseAmount(input: string): number | null {
  const text = normalizeDigits(input.trim())
  if (NEGATIVE_SIGN.test(text) || DECIMAL_POINT.test(text)) return null

  const digits = text.replace(SEPARATORS, '')
  if (!/^\d+$/.test(digits)) return null

  const amount = Number(digits)
  if (amount <= 0 || !Number.isSafeInteger(amount)) return null
  return amount
}

const formatters: Record<Locale, Intl.NumberFormat> = {
  fa: new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }),
}

/** Formats a number with locale digits and thousands separators. */
export function formatAmount(amount: number, locale: Locale): string {
  return formatters[locale].format(amount)
}

const TOMAN: Record<Locale, string> = { fa: 'تومان', en: 'Toman' }

/** Formats an amount with its unit, e.g. "۱۲۰٬۰۰۰ تومان" or "120,000 Toman". */
export function formatToman(amount: number, locale: Locale): string {
  return `${formatAmount(amount, locale)} ${TOMAN[locale]}`
}
