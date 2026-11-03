import { useSyncExternalStore } from 'react'
import type { Calendar } from '../lib/jalali.ts'
import type { Locale } from '../lib/locale.ts'

export interface Settings {
  locale: Locale
  calendar: Calendar
}

const STORAGE_KEY = 'daftar.settings'

/** Persian if the browser's first language is Persian, English otherwise. */
export function detectLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith('fa') ? 'fa' : 'en'
}

/**
 * Saved choices win over detection. The calendar defaults to Jalali in
 * both languages because amounts are in Toman. Anything malformed in
 * storage is ignored rather than trusted.
 */
export function resolveSettings(saved: string | null, languages: readonly string[]): Settings {
  let parsed: Partial<Settings> = {}
  try {
    const value: unknown = saved ? JSON.parse(saved) : null
    if (value && typeof value === 'object') parsed = value
  } catch {
    // Corrupt value: fall back to defaults.
  }
  return {
    locale: parsed.locale === 'fa' || parsed.locale === 'en' ? parsed.locale : detectLocale(languages),
    calendar: parsed.calendar === 'gregorian' ? 'gregorian' : 'jalali',
  }
}

// Settings live in localStorage, not IndexedDB: they are read synchronously
// before the first render, so the page never flashes in the wrong language
// or direction. Storage can throw (private mode, blocked site data), so
// every access is guarded and the app still works with defaults.
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

/** Sets <html lang dir>, which flips the whole layout. */
export function applyToDocument({ locale }: Settings): void {
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings)
}
