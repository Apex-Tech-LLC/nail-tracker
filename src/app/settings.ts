import type { Calendar } from '../lib/jalali.ts'
import type { Locale } from '../lib/locale.ts'

export interface Settings {
  locale: Locale
  calendar: Calendar
}

// Fixed defaults for now; #24 adds language detection and a saved choice.
export function useSettings(): Settings {
  return { locale: 'fa', calendar: 'jalali' }
}
