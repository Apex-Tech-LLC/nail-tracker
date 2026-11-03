import type { Locale } from './locale.ts'

// UI strings. Kept small and typed: a missing key in one language is a
// type error. The full language switch lands in #24.
const strings = {
  fa: {
    appName: 'دفتر',
    spentIn: 'خرج',
    today: 'امروز',
    yesterday: 'دیروز',
    emptyTitle: 'هنوز هزینه‌ای ثبت نشده',
    emptyBody: 'هزینه‌هایت اینجا، روزبه‌روز، دیده می‌شوند.',
    addSampleData: 'افزودن داده نمونه (فقط در حالت توسعه)',
  },
  en: {
    appName: 'Daftar',
    spentIn: 'Spent in',
    today: 'Today',
    yesterday: 'Yesterday',
    emptyTitle: 'No expenses yet',
    emptyBody: 'Your expenses show up here, day by day.',
    addSampleData: 'Add sample data (dev only)',
  },
} satisfies Record<Locale, Record<string, string>>

export type StringKey = keyof (typeof strings)['fa']

export function t(locale: Locale, key: StringKey): string {
  return strings[locale][key]
}
