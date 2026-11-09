import { useSyncExternalStore } from 'react'
import type { IsoDate } from '../domain/dates.ts'
import type { Locale } from '../lib/locale.ts'
import type { PayPeriodType } from '../domain/payPeriods.ts'
export type { PayPeriodType }

export type TipHandling = 'inHand' | 'fromSalon'
export type TipButtonsTarget = 'cash' | 'card'
/** How often Home reminds the person to save a backup. 0 turns the reminder off. */
export type BackupReminderDays = 7 | 14 | 30 | 0
/** Light or dark by explicit choice, or whatever the phone shows. */
export type ThemeChoice = 'system' | 'light' | 'dark'

export interface Settings {
  locale: Locale
  theme: ThemeChoice
  defaultCommissionRateBp: number
  perServiceRates: boolean
  weekStartDay: 0 | 1
  payPeriodType: PayPeriodType
  payPeriodAnchorDate: IsoDate | null
  cashTipHandling: TipHandling
  cardTipHandling: TipHandling
  lastServicePresetId: string | null
  tipButtonsTarget: TipButtonsTarget
  numberPad: boolean
  onboardingDone: boolean
  /** The first-time how-to on the Say screen has been closed once, so it stays closed unless asked for. */
  sayHowToSeen: boolean
  /** Optional hours tracking, off until the technician turns it on. */
  hoursOn: boolean
  minimumWageCents: number | null
  backupReminderDays: BackupReminderDays
  lastBackupDate: IsoDate | null
  /** Reminder key to the day it was dismissed. */
  dismissedReminders: Record<string, IsoDate>
  /** What the person wants to earn in a week, or null for no goal. */
  weeklyGoalCents: number | null
  /** What the person wants to earn in a month, or null for no goal. */
  monthlyGoalCents: number | null
  /** Part of earned money to keep for taxes, in whole basis points. null: off. */
  taxSetAsideBp: number | null
}

const STORAGE_KEY = 'nail-tracker.settings'

/** Vietnamese if the browser's first language is Vietnamese, English otherwise. */
export function detectLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

const isTipHandling = (value: unknown): value is TipHandling => value === 'inHand' || value === 'fromSalon'
const isTheme = (value: unknown): value is ThemeChoice => value === 'light' || value === 'dark'
const isPeriodType = (value: unknown): value is PayPeriodType =>
  value === 'weekly' || value === 'biweekly' || value === 'custom' || value === 'none'
const isRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000
const isDateText = (value: unknown): value is IsoDate => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const isCents = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
const isReminderDays = (value: unknown): value is BackupReminderDays =>
  value === 7 || value === 14 || value === 30 || value === 0
const isGoalCents = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

function isDismissedMap(value: unknown): value is Record<string, IsoDate> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every(isDateText)
}

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
    theme: isTheme(parsed.theme) ? parsed.theme : 'system',
    defaultCommissionRateBp: isRate(parsed.defaultCommissionRateBp) ? parsed.defaultCommissionRateBp : 6000,
    perServiceRates: parsed.perServiceRates === true,
    weekStartDay: parsed.weekStartDay === 1 ? 1 : 0,
    payPeriodType: isPeriodType(parsed.payPeriodType) ? parsed.payPeriodType : 'none',
    payPeriodAnchorDate: isDateText(parsed.payPeriodAnchorDate) ? parsed.payPeriodAnchorDate : null,
    cashTipHandling: isTipHandling(parsed.cashTipHandling) ? parsed.cashTipHandling : 'inHand',
    cardTipHandling: isTipHandling(parsed.cardTipHandling) ? parsed.cardTipHandling : 'fromSalon',
    lastServicePresetId: typeof parsed.lastServicePresetId === 'string' ? parsed.lastServicePresetId : null,
    tipButtonsTarget: parsed.tipButtonsTarget === 'card' ? 'card' : 'cash',
    numberPad: parsed.numberPad !== false,
    onboardingDone: parsed.onboardingDone === true,
    sayHowToSeen: parsed.sayHowToSeen === true,
    hoursOn: parsed.hoursOn === true,
    minimumWageCents: isCents(parsed.minimumWageCents) ? parsed.minimumWageCents : null,
    backupReminderDays: isReminderDays(parsed.backupReminderDays) ? parsed.backupReminderDays : 14,
    lastBackupDate: isDateText(parsed.lastBackupDate) ? parsed.lastBackupDate : null,
    dismissedReminders: isDismissedMap(parsed.dismissedReminders) ? parsed.dismissedReminders : {},
    weeklyGoalCents: isGoalCents(parsed.weeklyGoalCents) ? parsed.weeklyGoalCents : null,
    monthlyGoalCents: isGoalCents(parsed.monthlyGoalCents) ? parsed.monthlyGoalCents : null,
    taxSetAsideBp: isRate(parsed.taxSetAsideBp) ? parsed.taxSetAsideBp : null,
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

/** Back to first-launch defaults, except the language and theme, which stay as the person chose them. */
export function resetSettings(): void {
  const { locale, theme } = current
  current = resolveSettings(JSON.stringify({ locale, theme }), [])
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Not saved, but still applied for this session.
  }
  listeners.forEach((listener) => listener())
}

// The page colour for each mode, so the phone's top bar matches the app.
// These are the only colours allowed outside index.css.
const PAGE_COLOR = { light: '#f7f4f8', dark: '#17131f' } as const

/**
 * Sets <html lang> (both languages read left to right) and the theme, and
 * points both theme-color tags at the colour of the mode on screen.
 */
export function applyToDocument({ locale, theme }: Settings): void {
  document.documentElement.lang = locale
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = theme

  const light = theme === 'system' ? PAGE_COLOR.light : PAGE_COLOR[theme]
  const dark = theme === 'system' ? PAGE_COLOR.dark : PAGE_COLOR[theme]
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = meta.media.includes('dark') ? dark : light
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings)
}
