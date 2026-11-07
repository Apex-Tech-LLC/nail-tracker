import { expect, test } from '@playwright/test'
import { addTurn, installApp, seedSettings, turnRow } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await seedSettings(page)
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

test('shows the offline badge only while offline', async ({ page, context }) => {
  const badge = page.locator('header [role=status] > span')
  await expect(badge).toBeHidden()

  await context.setOffline(true)
  await expect(badge).toBeVisible()
  await expect(badge).toContainText('Offline')

  await context.setOffline(false)
  await expect(badge).toBeHidden()
})

test('works from start to finish with no connection', async ({ page, context }) => {
  await addTurn(page, { amount: '100', cash: '10', card: '15' })

  await context.setOffline(true)
  await page.reload()
  await expect(turnRow(page, 1)).toBeVisible()

  await addTurn(page, { amount: '50', service: 'Pedicure' })
  await expect(turnRow(page, 2)).toBeVisible()

  const nav = page.getByRole('navigation')
  await nav.getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible()
  await expect(turnRow(page, 2)).toBeVisible()

  await nav.getByRole('link', { name: 'Earnings' }).click()
  // The amount on the card labelled "Total earned", never a matching amount elsewhere.
  await expect(page.getByText('Total earned', { exact: true }).locator('..')).toContainText('$115.00')

  // The font comes from the cache too, not a fallback.
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)
  })
  expect(fonts.join()).toContain('Be Vietnam Pro')
})

test('data is still there after the app is closed and opened again', async ({ page, context }) => {
  await addTurn(page, { amount: '100' })
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('./')
  await expect(turnRow(reopened, 1)).toBeVisible()
})

test('makes no requests outside this app', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  await page.reload()

  await addTurn(page, { amount: '40', service: 'Pedicure' })

  const nav = page.getByRole('navigation')
  for (const [tab, heading] of [
    ['History', 'History'],
    ['Earnings', 'Earnings'],
    ['Payday', 'Payday'],
    ['Settings', 'Settings'],
    ['Today', 'Nail Tracker'],
  ] as const) {
    await nav.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }

  expect(urls.length).toBeGreaterThan(0)
  for (const url of urls) expect(url, url).toMatch(/^http:\/\/localhost:4173\/|^blob:|^data:/)
})

test('warns that the browser can delete saved data', async ({ page }) => {
  await page.goto('./#/settings')
  await expect(page.getByText(/The browser can delete it/)).toBeVisible()
})
