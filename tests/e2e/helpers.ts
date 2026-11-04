import { expect, type Page } from '@playwright/test'

/**
 * Opens the app and waits until the service worker has precached it and
 * controls the page, the state a user is in after their first visit.
 */
export async function installApp(page: Page): Promise<void> {
  await page.goto('./')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

/** Fills and saves the new-expense form (Persian UI). */
export async function addExpense(page: Page, amount: string, category: string, note?: string): Promise<void> {
  await page.goto('./#/add')
  await page.getByLabel(/مبلغ/).fill(amount)
  await page.getByText(category, { exact: true }).click()
  if (note) await page.getByLabel(/یادداشت/).fill(note)
  await page.getByRole('button', { name: 'ذخیره' }).click()
  await expect(page.getByRole('heading', { name: 'دفتر' })).toBeVisible()
}

/** The month-total card on the list or summary page. */
export const monthTotal = (page: Page) => page.locator('section.bg-brand-50 p.text-2xl')
