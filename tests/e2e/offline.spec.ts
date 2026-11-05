import { expect, test } from '@playwright/test'
import { addExpense, installApp, monthTotal } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await installApp(page)
})

test('precaches the app shell, including the font', async ({ page }) => {
  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const key of await caches.keys()) {
      // Workbox adds a ?__WB_REVISION__ query, so keep only the path.
      for (const request of await (await caches.open(key)).keys()) urls.push(new URL(request.url).pathname)
    }
    return urls
  })
  expect(cached.some((url) => url.endsWith('/index.html'))).toBe(true)
  expect(cached.some((url) => url.endsWith('.woff2'))).toBe(true)
  expect(cached.some((url) => /\/assets\/index-.*\.js$/.test(url))).toBe(true)
})

test('reloads, adds an expense and shows it in the list and summary while offline', async ({ page, context }) => {
  await addExpense(page, '85000', 'رفت‌وآمد', 'اسنپ')

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('اسنپ')).toBeVisible()

  await addExpense(page, '120000', 'خوراک')
  await expect(page.getByText('۱۲۰٬۰۰۰').first()).toBeVisible()
  await expect(monthTotal(page)).toHaveText('۲۰۵٬۰۰۰ تومان')

  await page.getByRole('link', { name: 'خلاصه' }).click()
  await expect(monthTotal(page)).toHaveText('۲۰۵٬۰۰۰ تومان')
  await expect(page.getByRole('listitem').filter({ hasText: 'خوراک' })).toContainText('۱۲۰٬۰۰۰')
  await expect(page.getByRole('listitem').filter({ hasText: 'رفت‌وآمد' })).toContainText('۸۵٬۰۰۰')
})

test('shows the offline badge only while offline', async ({ page, context }) => {
  const badge = page.locator('header [role=status] > span')
  await expect(badge).toBeHidden()

  await context.setOffline(true)
  await expect(badge).toBeVisible()
  await expect(badge).toContainText('آفلاین')

  await context.setOffline(false)
  await expect(badge).toBeHidden()
})

test('keeps data after the app is closed and reopened offline', async ({ page, context }) => {
  await addExpense(page, '320000', 'خوراک', 'میوه')
  await page.close()

  await context.setOffline(true)
  const reopened = await context.newPage()
  await reopened.goto('./')
  await expect(reopened.getByText('میوه')).toBeVisible()
  await expect(monthTotal(reopened)).toHaveText('۳۲۰٬۰۰۰ تومان')
})
