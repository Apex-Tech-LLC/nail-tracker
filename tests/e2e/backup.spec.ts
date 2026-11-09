import { readFileSync } from 'node:fs'
import { expect, test, type FileChooser, type Locator, type Page } from '@playwright/test'
import { addTurn, seedSettings, skipOnboarding } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone.
const NOON = new Date('2026-11-04T12:00:00')

// The delete word XÓA, the other accent placement XOÁ, and XÓA typed with a separate accent.
const VI_DELETE_WORD = '\u0058\u00D3\u0041'
const VI_OTHER_SPELLING = '\u0058\u004F\u00C1'
const VI_SEPARATE_ACCENT = '\u0058\u004F\u0301\u0041'

/** The big earned number on Home. */
function heroEarned(page: Page): Locator {
  return page.getByTestId('hero-earned')
}

const status = (page: Page) => page.locator('p[role=status]')
const fileInput = (page: Page) => page.locator('input[type=file]')

/** Counts how many times a table is cleared, so a deleted-once check has something to count. */
async function countStoreClears(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const counter = window as unknown as { storeClears: number }
    counter.storeClears = 0
    const original = IDBObjectStore.prototype.clear
    IDBObjectStore.prototype.clear = function (this: IDBObjectStore) {
      counter.storeClears += 1
      return original.call(this)
    }
  })
}

const storeClears = (page: Page) =>
  page.evaluate(() => (window as unknown as { storeClears: number }).storeClears)

async function saveBackup(page: Page, path: string): Promise<void> {
  await page.goto('./#/settings')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save backup file' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^nail-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await download.saveAs(path)
}

async function deleteAll(page: Page): Promise<void> {
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Delete all data', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Type the word here').fill('DELETE')
  await dialog.getByRole('button', { name: 'Delete all data' }).click()
  await expect(page).toHaveURL(/#\/onboarding/)
  await skipOnboarding(page)
}

test('a backup round trip brings the turn back', async ({ page }, testInfo) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100', cash: '10' })
  const file = testInfo.outputPath('backup.json')
  await saveBackup(page, file)

  await deleteAll(page)
  await expect(page.getByText('Your turns today will show here.')).toBeVisible()

  await page.goto('./#/settings')
  await fileInput(page).setInputFiles(file)
  await expect(status(page)).toContainText('Restore finished')

  await page.goto('./')
  await expect(heroEarned(page)).toHaveText('$70.00')
})

test('a damaged backup file changes nothing', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings')

  await fileInput(page).setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('nope'),
  })

  await expect(status(page)).toContainText('This file is damaged or is not JSON.')
  await expect(status(page)).toContainText('Your current data was not changed.')
})

test('a backup from another app is refused', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings')

  await fileInput(page).setInputFiles({
    name: 'other.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"other","version":1}'),
  })

  await expect(status(page)).toContainText('This is not a Nail Tracker backup file.')
})

test('a restore that fails on the database changes nothing and says so', async ({ page }, testInfo) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100', cash: '10' })
  const file = testInfo.outputPath('db-failure.json')
  await saveBackup(page, file)

  // A valid file, but the database refuses the read that starts the merge.
  await page.evaluate(() => {
    IDBObjectStore.prototype.count = () => {
      throw new DOMException('The database could not be read.', 'UnknownError')
    }
  })
  await fileInput(page).setInputFiles(file)

  await expect(status(page)).toContainText('Your current data was not changed.')
  await expect(status(page).locator('span')).toHaveClass(/text-danger-text/)
  await expect(status(page)).not.toContainText('This file is damaged or is not JSON.')
})

test('the history CSV downloads', async ({ page }, testInfo) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await page.goto('./#/settings')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export history (CSV)' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^nail-tracker-turns-.*\.csv$/)
  const file = testInfo.outputPath('history.csv')
  await download.saveAs(file)

  expect(readFileSync(file, 'utf8')).toContain('100.00')
})

test('the delete word must be typed exactly', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Delete all data', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: 'Delete all data' })

  await expect(confirm).toBeDisabled()
  await dialog.getByLabel('Type the word here').fill('delete')
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel('Type the word here').fill('DELETE')
  await expect(confirm).toBeEnabled()
})

test('the Vietnamese delete word unlocks the dialog', async ({ page }) => {
  await seedSettings(page, { locale: 'vi' })
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Xóa toàn bộ dữ liệu', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: 'Xóa toàn bộ dữ liệu' })
  const input = dialog.getByLabel('Gõ từ đó vào đây')

  await input.fill(VI_DELETE_WORD)
  await expect(confirm).toBeEnabled()
  await input.fill(VI_OTHER_SPELLING)
  await expect(confirm).toBeEnabled()
  await input.fill(VI_SEPARATE_ACCENT)
  await expect(confirm).toBeEnabled()
  await input.fill(VI_DELETE_WORD.toLowerCase())
  await expect(confirm).toBeDisabled()
})

test('delete all data starts onboarding with no turns', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })

  await deleteAll(page)

  await expect(page.getByText('Your turns today will show here.')).toBeVisible()
})

test('the earnings CSV downloads the range', async ({ page }, testInfo) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await page.goto('./#/earnings')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export this range (CSV)' }).click(),
  ])
  const file = testInfo.outputPath('range.csv')
  await download.saveAs(file)

  expect(readFileSync(file, 'utf8')).toContain('100.00')
})

test('a double tap on delete all data deletes once', async ({ page }) => {
  await seedSettings(page)
  await countStoreClears(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Delete all data', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Type the word here').fill('DELETE')

  const before = await storeClears(page)
  await dialog.getByRole('button', { name: 'Delete all data' }).dblclick()

  await expect(page).toHaveURL(/#\/onboarding/)
  // Eleven tables are cleared once; a second delete would clear eleven more.
  expect(await storeClears(page)).toBe(before + 11)
  await skipOnboarding(page)
  await expect(page.getByText('Your turns today will show here.')).toBeVisible()
})

test('a double tap on restore opens one file picker and restores once', async ({ page }, testInfo) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  const file = testInfo.outputPath('restore.json')
  await saveBackup(page, file)

  const choosers: FileChooser[] = []
  page.on('filechooser', (chooser) => choosers.push(chooser))
  await page.getByRole('button', { name: 'Restore from backup file' }).dblclick()
  await expect.poll(() => choosers.length).toBe(1)

  await choosers[0].setFiles(file)
  await expect(status(page)).toContainText('Restore finished')
  await expect(fileInput(page)).toHaveValue('')
})

test('a dismissed picker does not leave restore dead', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings')
  const choosers: FileChooser[] = []
  page.on('filechooser', (chooser) => choosers.push(chooser))
  const restore = page.getByRole('button', { name: 'Restore from backup file' })

  await restore.click()
  await expect.poll(() => choosers.length).toBe(1)

  // The picker was dismissed without a file; the guard must expire on its own.
  await page.waitForTimeout(1100)
  await restore.click()
  await expect.poll(() => choosers.length).toBe(2)
})

test('picking the same backup file twice restores again', async ({ page }, testInfo) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  const file = testInfo.outputPath('same-file.json')
  await saveBackup(page, file)
  await deleteAll(page)

  await page.goto('./#/settings')
  await fileInput(page).setInputFiles(file)
  await expect(status(page)).toContainText('Restore finished')
  const first = (await status(page).textContent()) ?? ''
  await expect(fileInput(page)).toHaveValue('')

  await fileInput(page).setInputFiles(file)
  await expect(status(page)).not.toHaveText(first)
})
