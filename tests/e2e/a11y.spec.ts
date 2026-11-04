import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addExpense } from './helpers.ts'

// Every screen, in both languages, checked against WCAG 2.1 A and AA plus
// axe best practices. Any violation fails, not only serious ones, so small
// problems can't pile up below the bar.
async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze()
  const found = violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)
  expect(found).toEqual([])
}

for (const locale of ['fa', 'en'] as const) {
  test.describe(locale, () => {
    // The add helper speaks Persian, so data goes in first, then the language switches.
    async function open(page: Page, withData: boolean) {
      await page.goto('./')
      if (withData) {
        await addExpense(page, '320000', 'خوراک', 'میوه')
        await addExpense(page, '85000', 'رفت‌وآمد')
      }
      if (locale === 'en') await page.getByRole('button', { name: 'Switch to English' }).click()
    }

    test('welcome screen', async ({ page }) => {
      await open(page, false)
      await audit(page)
    })

    test('list, summary and settings', async ({ page }) => {
      await open(page, true)
      await audit(page)
      await page.goto('./#/summary')
      await audit(page)
      await page.goto('./#/settings')
      await audit(page)
    })

    test('new expense form, empty and with errors', async ({ page }) => {
      await open(page, false)
      await page.goto('./#/add')
      await audit(page)
      await page.getByRole('button', { name: locale === 'fa' ? 'ذخیره' : 'Save' }).click()
      await audit(page)
    })

    test('edit form and undo toast', async ({ page }) => {
      await open(page, true)
      await page.getByRole('button', { name: locale === 'fa' ? /میوه/ : /Groceries/ }).click()
      await audit(page)
      await page.getByRole('button', { name: locale === 'fa' ? 'حذف' : 'Delete' }).click()
      await expect(page.getByRole('button', { name: locale === 'fa' ? 'برگرداندن' : 'Undo' })).toBeVisible()
      await audit(page)
    })
  })
}
