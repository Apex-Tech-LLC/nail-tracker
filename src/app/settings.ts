import { useSyncExternalStore } from 'react'
import type { IsoDate } from '../domain/dates.ts'
import type { Locale } from '../lib/locale.ts'
import type { PayPeriodType } from '../domain/payPeriods.ts'
export type { PayPeriodType }

export type TipHandling = 'inHand' | 'fromSalon'

export interface Settings {
  locale: Locale
  defaultCommissionRateBp: number
  perServiceRates: boolean
  weekStartDay: 0 | 1
  payPeriodType: PayPeriodType
  payPeriodAnchorDate: IsoDate | null
  cashTipHandling: TipHandling
  cardTipHandling: TipHandling
  lastServicePresetId: string | null
  onboardingDone: boolean
}

const STORAGE_KEY = 'nail-tracker.settings'

/** Vietnamese if the browser's first language is Vietnamese, English otherwise. */
export function detectLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

const isTipHandling = (value: unknown): value is TipHandling => value === 'inHand' || value === 'fromSalon'
const isPeriodType = (value: unknown): value is PayPeriodType =>
  value === 'weekly' || value === 'biweekly' || value === 'custom' || value === 'none'
const isRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000
const isDateText = (value: unknown): value is IsoDate => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** Saved choices win over defaults. Anything malformed in storage is ignored rather than trusted. */
export function resolveSettings(saved: string | null, languages: readonly string[]): Settings {
  let parsed: Partial<Record<keyof Settings, unknown>> = {}
  try {
    const value: unknown = saved ? JSON.parse(saved) : null
    if (value && typeof value === 'object') parsed = value
  } catch {
    // Corrupt value: fall back to defaults.
  }
  return {
    locale: parsed.locale === 'vi' || parsed.locale === 'en' ? parsed.locale : detectLocale(languages),
    defaultCommissionRateBp: isRate(parsed.defaultCommissionRateBp) ? parsed.defaultCommissionRateBp : 6000,
    perServiceRates: parsed.perServiceRates === true,
    weekStartDay: parsed.weekStartDay === 1 ? 1 : 0,
    payPeriodType: isPeriodType(parsed.payPeriodType) ? parsed.payPeriodType : 'none',
    payPeriodAnchorDate: isDateText(parsed.payPeriodAnchorDate) ? parsed.payPeriodAnchorDate : null,
    cashTipHandling: isTipHandling(parsed.cashTipHandling) ? parsed.cashTipHandling : 'inHand',
    cardTipHandling: isTipHandling(parsed.cardTipHandling) ? parsed.cardTipHandling : 'fromSalon',
    lastServicePresetId: typeof parsed.lastServicePresetId === 'string' ? parsed.lastServicePresetId : null,
    onboardingDone: parsed.onboardingDone === true,
  }
}

// Settings live in localStorage, not IndexedDB: they are read synchronously
// before the first render, so the page never flashes in the wrong language.
// Storage can throw (private mode, blocked site data), so every access is
// guarded and the app still works with defaults.
function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let current = resolveSettings(readStorage(), navigator.languages ?? [navigator.language])
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function updateSettings(change: Partial<Settings>): void {
  current = { ...current, ...change }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Not saved, but still applied for this session.
  }
  applyToDocument(current)
  listeners.forEach((listener) => listener())
}

/** Back to first-launch defaults, except the language, which stays as the person chose it. */
export function resetSettings(): void {
  const { locale } = current
  current = resolveSettings(JSON.stringify({ locale }), [])
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Not saved, but still applied for this session.
  }
  listeners.forEach((listener) => listener())
}

/** Sets <html lang>. Both languages read left to right. */
export function applyToDocument({ locale }: Settings): void {
  document.documentElement.lang = locale
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings)
}
