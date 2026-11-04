import type { Category, Expense } from '../../db/schema.ts'
import { isoToJalali } from '../../lib/jalali.ts'
import type { Locale } from '../../lib/locale.ts'

// Excel only reads a CSV as UTF-8 (and so shows Persian correctly) when
// the file starts with a byte order mark.
const BOM = '﻿'

const HEADERS: Record<Locale, string[]> = {
  fa: ['تاریخ', 'تاریخ شمسی', 'دسته', 'مبلغ (تومان)', 'یادداشت'],
  en: ['Date', 'Jalali date', 'Category', 'Amount (Toman)', 'Note'],
}

/**
 * Quotes a cell when needed, and defuses text a spreadsheet would run as a
 * formula (a note like "=HYPERLINK(...)" is written as plain text).
 */
export function csvCell(value: string | number): string {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * One row per expense, oldest first, for opening in a spreadsheet. Dates
 * are ISO plus Jalali, and amounts are plain Latin digits so formulas can
 * add them up.
 */
export function exportCsv(expenses: readonly Expense[], categories: readonly Category[], locale: Locale): string {
  const names = new Map(categories.map((c) => [c.id, c.names[locale]]))
  const rows = [...expenses]
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((e) => {
      const { year, month, day } = isoToJalali(e.date)
      const jalali = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
      return [e.date, jalali, names.get(e.categoryId) ?? e.categoryId, e.amount, e.note ?? '']
    })
  return BOM + [HEADERS[locale], ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
