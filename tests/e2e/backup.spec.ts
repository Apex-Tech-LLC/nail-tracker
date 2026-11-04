import { expect, test } from '@playwright/test'
import { addExpense, monthTotal } from './helpers.ts'

test('a JSON backup restores into a fresh browser', async ({ page, browser }, testInfo) => {
  await page.goto('./')
  await addExpense(page, '320000', 'خوراک', 'میوه')
  await addExpense(page, '85000', 'رفت‌وآمد')

  await page.goto('./#/settings')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /ذخیره فایل پشتیبان/ }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^daftar-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const file = testInfo.outputPath('backup.json')
  await download.saveAs(file)

  // A second, empty browser profile stands in for a new phone. A context
  // made by hand does not inherit the config, so pass the base URL along.
  const fresh = await browser.newContext({ locale: 'fa-IR', baseURL: testInfo.project.use.baseURL })
  const other = await fresh.newPage()
  await other.goto('./#/settings')
  await other.locator('input[type=file]').setInputFiles(file)
  await expect(other.locator('p[role=status]')).toContainText('۲ جدید')

  await other.goto('./')
  await expect(other.getByText('میوه')).toBeVisible()
  await expect(monthTotal(other)).toHaveText('۴۰۵٬۰۰۰ تومان')
  await fresh.close()
})

test('a damaged backup file changes nothing', async ({ page }) => {
  await page.goto('./')
  await addExpense(page, '50000', 'سلامت')
  await page.goto('./#/settings')
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"daftar","exp'),
  })
  await expect(page.locator('p[role=status]')).toContainText('دست نخورده')

  await page.goto('./')
  await expect(monthTotal(page)).toHaveText('۵۰٬۰۰۰ تومان')
})
