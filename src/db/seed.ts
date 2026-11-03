import type { Category } from './schema.ts'

// Default categories use readable, stable ids instead of UUIDs so a JSON
// backup from one device matches the categories on another.
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries', names: { fa: 'خوراک', en: 'Groceries' }, icon: 'shopping-cart', order: 1 },
  { id: 'transport', names: { fa: 'رفت‌وآمد', en: 'Transport' }, icon: 'bus', order: 2 },
  { id: 'bills', names: { fa: 'قبض‌ها', en: 'Bills' }, icon: 'file-invoice', order: 3 },
  { id: 'cafe', names: { fa: 'کافه و رستوران', en: 'Eating out' }, icon: 'coffee', order: 4 },
  { id: 'health', names: { fa: 'سلامت', en: 'Health' }, icon: 'heart', order: 5 },
  { id: 'shopping', names: { fa: 'خرید', en: 'Shopping' }, icon: 'shopping-bag', order: 6 },
  { id: 'other', names: { fa: 'سایر', en: 'Other' }, icon: 'dots', order: 7 },
]
