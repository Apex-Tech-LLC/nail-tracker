import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type DaftarDb, type Expense } from '../../src/db/schema.ts'
import { DEFAULT_CATEGORIES } from '../../src/db/seed.ts'
import { csvCell, exportCsv } from '../../src/features/backup/exportCsv.ts'
import { exportJson } from '../../src/features/backup/exportJson.ts'
import { ImportError, importJson, parseBackup } from '../../src/features/backup/importJson.ts'

let db: DaftarDb
let counter = 0

beforeEach(() => {
  db = createDb(`backup-${++counter}`)
})

afterEach(async () => {
  await db.delete()
})

const expense = (id: string, overrides: Partial<Expense> = {}): Expense => ({
  id,
  amount: 120000,
  categoryId: 'groceries',
  date: '2026-11-03',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
})

const backupText = (expenses: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ app: 'daftar', version: 1, exportedAt: '2026-11-04T00:00:00.000Z', expenses, categories: DEFAULT_CATEGORIES, ...extra })

async function snapshot() {
  return { expenses: await db.expenses.toArray(), categories: await db.categories.toArray() }
}

describe('exportJson', () => {
  it('writes every expense and category with the format version', async () => {
    await db.expenses.bulkAdd([expense('b', { date: '2026-11-04' }), expense('a', { note: 'میوه' })])
    const backup = JSON.parse(await exportJson(db, new Date('2026-11-04T10:00:00Z')))
    expect(backup).toMatchObject({ app: 'daftar', version: 1, exportedAt: '2026-11-04T10:00:00.000Z' })
    expect(backup.expenses.map((e: Expense) => e.id)).toEqual(['a', 'b'])
    expect(backup.categories).toHaveLength(DEFAULT_CATEGORIES.length)
  })

  it('round-trips into an empty database', async () => {
    await db.expenses.bulkAdd([expense('a', { note: 'میوه' }), expense('b', { amount: 5 })])
    const text = await exportJson(db)
    const other = createDb(`backup-copy-${counter}`)
    try {
      expect(await importJson(other, text)).toEqual({ added: 2, updated: 0, unchanged: 0 })
      expect(await other.expenses.orderBy('id').toArray()).toEqual(await db.expenses.orderBy('id').toArray())
    } finally {
      await other.delete()
    }
  })
})

describe('parseBackup', () => {
  const rejects = (text: string, code: string) => {
    expect(() => parseBackup(text)).toThrow(ImportError)
    try {
      parseBackup(text)
    } catch (error) {
      expect((error as ImportError).code).toBe(code)
    }
  }

  it('rejects text that is not JSON', () => rejects('{"app": "daftar", ', 'notJson'))
  it('rejects JSON that is not a Daftar backup', () => {
    rejects('[]', 'notBackup')
    rejects(JSON.stringify({ app: 'other', version: 1, expenses: [], categories: [] }), 'notBackup')
    rejects(JSON.stringify({ app: 'daftar', version: 1, expenses: {} , categories: [] }), 'notBackup')
  })
  it('rejects an unknown format version, older or newer', () => {
    rejects(backupText([], { version: 0 }), 'unsupportedVersion')
    rejects(backupText([], { version: 2 }), 'unsupportedVersion')
    rejects(backupText([], { version: '1' }), 'unsupportedVersion')
  })
  it.each([
    ['a float amount', { amount: 1.5 }],
    ['a negative amount', { amount: -100 }],
    ['an amount as text', { amount: '120000' }],
    ['an impossible date', { date: '2026-02-30' }],
    ['a Jalali date', { date: '1405/08/12' }],
    ['a missing id', { id: '' }],
    ['a note that is not text', { note: 42 }],
  ])('rejects an expense with %s', (_, overrides) => {
    rejects(backupText([expense('ok'), { ...expense('bad'), ...overrides }]), 'invalidRecord')
  })
  it('drops an empty note instead of storing it', () => {
    expect(parseBackup(backupText([expense('a', { note: '' })])).expenses[0]).not.toHaveProperty('note')
  })
})

describe('importJson', () => {
  beforeEach(async () => {
    await db.expenses.bulkAdd([expense('kept'), expense('edited-here', { amount: 999, updatedAt: 5000 })])
  })

  it.each([
    ['a corrupt file', '{"app":"daftar","exp'],
    ['an empty file', ''],
    ['another app’s JSON', '{"name":"something else"}'],
    ['an older format version', backupText([expense('new')], { version: 0 })],
    ['a newer format version', backupText([expense('new')], { version: 2 })],
    ['one bad record among good ones', backupText([expense('new'), expense('broken', { amount: 0 })])],
  ])('leaves existing data untouched for %s', async (_, text) => {
    const before = await snapshot()
    await expect(importJson(db, text)).rejects.toBeInstanceOf(ImportError)
    expect(await snapshot()).toEqual(before)
  })

  it('adds new expenses and never deletes ones missing from the file', async () => {
    const result = await importJson(db, backupText([expense('new')]))
    expect(result).toEqual({ added: 1, updated: 0, unchanged: 0 })
    expect((await db.expenses.toCollection().primaryKeys()).sort()).toEqual(['edited-here', 'kept', 'new'])
  })

  it('keeps whichever copy of an expense was edited last', async () => {
    const result = await importJson(
      db,
      backupText([
        expense('kept', { amount: 50, updatedAt: 2000 }), // newer in the file: replaces
        expense('edited-here', { amount: 1, updatedAt: 3000 }), // older in the file: ignored
      ]),
    )
    expect(result).toEqual({ added: 0, updated: 1, unchanged: 1 })
    expect((await db.expenses.get('kept'))?.amount).toBe(50)
    expect((await db.expenses.get('edited-here'))?.amount).toBe(999)
  })

  it('adds unknown categories but keeps the names of existing ones', async () => {
    const renamed = { ...DEFAULT_CATEGORIES[0], names: { fa: 'تغییر', en: 'Changed' } }
    const pets = { id: 'pets', names: { fa: 'حیوانات', en: 'Pets' }, icon: 'dots', order: 99 }
    await importJson(db, backupText([], { categories: [renamed, pets] }))
    expect((await db.categories.get(renamed.id))?.names).toEqual(DEFAULT_CATEGORIES[0].names)
    expect(await db.categories.get('pets')).toEqual(pets)
  })

  it('importing the same file twice changes nothing the second time', async () => {
    const text = backupText([expense('new'), expense('another', { date: '2026-10-01' })])
    await importJson(db, text)
    const before = await snapshot()
    expect(await importJson(db, text)).toEqual({ added: 0, updated: 0, unchanged: 2 })
    expect(await snapshot()).toEqual(before)
  })
})

describe('exportCsv', () => {
  it('writes a BOM, a header and one row per expense, oldest first', () => {
    const csv = exportCsv(
      [expense('b', { date: '2026-11-04', amount: 85000, categoryId: 'transport' }), expense('a', { note: 'میوه' })],
      DEFAULT_CATEGORIES,
      'fa',
    )
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual([
      'تاریخ,تاریخ شمسی,دسته,مبلغ (تومان),یادداشت',
      '2026-11-03,1405/08/12,خوراک,120000,میوه',
      '2026-11-04,1405/08/13,رفت‌وآمد,85000,',
      '',
    ])
  })

  it('uses English headers and category names for en', () => {
    const lines = exportCsv([expense('a')], DEFAULT_CATEGORIES, 'en').slice(1).split('\r\n')
    expect(lines[0]).toBe('Date,Jalali date,Category,Amount (Toman),Note')
    expect(lines[1]).toBe('2026-11-03,1405/08/12,Groceries,120000,')
  })

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('نان, شیر')).toBe('"نان, شیر"')
    expect(csvCell('the "good" one')).toBe('"the ""good"" one"')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
  })

  it('stops a note from running as a spreadsheet formula', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(csvCell('+98 912')).toBe("'+98 912")
    expect(csvCell(120000)).toBe('120000')
  })
})
