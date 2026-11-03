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
    addExpense: 'افزودن هزینه',
    newExpense: 'هزینه جدید',
    editExpense: 'ویرایش هزینه',
    close: 'بستن',
    amount: 'مبلغ',
    toman: 'تومان',
    category: 'دسته',
    date: 'تاریخ',
    otherDay: 'روز دیگر',
    day: 'روز',
    month: 'ماه',
    year: 'سال',
    note: 'یادداشت (اختیاری)',
    notePlaceholder: 'میوه از بازار',
    save: 'ذخیره',
    errorAmount: 'مبلغ را به تومان و بدون اعشار وارد کن.',
    errorCategory: 'یک دسته انتخاب کن.',
    errorDate: 'این تاریخ وجود ندارد.',
    delete: 'حذف',
    expenseDeleted: 'هزینه حذف شد',
    undo: 'برگرداندن',
  },
  en: {
    appName: 'Daftar',
    spentIn: 'Spent in',
    today: 'Today',
    yesterday: 'Yesterday',
    emptyTitle: 'No expenses yet',
    emptyBody: 'Your expenses show up here, day by day.',
    addSampleData: 'Add sample data (dev only)',
    addExpense: 'Add expense',
    newExpense: 'New expense',
    editExpense: 'Edit expense',
    close: 'Close',
    amount: 'Amount',
    toman: 'Toman',
    category: 'Category',
    date: 'Date',
    otherDay: 'Other day',
    day: 'Day',
    month: 'Month',
    year: 'Year',
    note: 'Note (optional)',
    notePlaceholder: 'Fruit from the market',
    save: 'Save',
    errorAmount: 'Enter a whole amount in Toman.',
    errorCategory: 'Pick a category.',
    errorDate: "That date doesn't exist.",
    delete: 'Delete',
    expenseDeleted: 'Expense deleted',
    undo: 'Undo',
  },
} satisfies Record<Locale, Record<string, string>>

export type StringKey = keyof (typeof strings)['fa']

export function t(locale: Locale, key: StringKey): string {
  return strings[locale][key]
}
