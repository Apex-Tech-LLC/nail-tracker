import { expect, test } from '@playwright/test'

test('the manifest is valid and every icon loads', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel=manifest]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifestUrl = new URL(href!, page.url()).href
  const response = await request.get(manifestUrl)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()

  expect(manifest).toMatchObject({
    lang: 'en',
    dir: 'ltr',
    display: 'standalone',
    start_url: './',
    scope: './',
  })
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true)

  for (const icon of manifest.icons as { src: string }[]) {
    const iconResponse = await request.get(new URL(icon.src, manifestUrl).href)
    expect(iconResponse.ok(), icon.src).toBe(true)
    expect(iconResponse.headers()['content-type']).toBe('image/png')
  }
})

test('Chromium sees no installability problems', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
  expect(installabilityErrors).toEqual([])
})

test('the document direction and language follow the UI language', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
