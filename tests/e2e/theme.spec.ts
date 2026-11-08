import { expect, test, type Page } from '@playwright/test'
import { addTurn, seedSettings, weeklyPay } from './helpers.ts'

// Noon in Chicago. The offset is explicit so the machine running the tests
// (UTC on GitHub) cannot move the fixed day.
const NOW = new Date('2026-11-04T12:00:00-06:00')

const PAGE = {
  light: 'rgb(247, 244, 248)',
  dark: 'rgb(23, 19, 31)',
} as const

declare global {
  interface Window {
    __sharedPixels?: number[][]
  }
}

// The reload test blocks the app bundle on purpose, and a cached service
// worker could answer it, so every test here runs without one.
test.use({ serviceWorkers: 'block' })

async function bodyColor(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor)
}

async function start(page: Page): Promise<void> {
  await page.clock.setFixedTime(NOW)
  await seedSettings(page, weeklyPay)
}

/** Stands in for the phone's share sheet and records the top-left pixel of each picture. */
async function stubShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pixels: number[][] = []
    window.__sharedPixels = pixels
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: { files?: File[] }) => {
        for (const file of data.files ?? []) {
          const bitmap = await createImageBitmap(file)
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          const context = canvas.getContext('2d')
          if (!context) return
          context.drawImage(bitmap, 0, 0)
          const pixel = context.getImageData(0, 0, 1, 1).data
          pixels.push([pixel[0], pixel[1], pixel[2], pixel[3]])
        }
      },
    })
  })
}

test.describe('phone in dark mode', () => {
  test.use({ colorScheme: 'dark' })

  test('with no choice, Home is dark', async ({ page }) => {
    await start(page)
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await bodyColor(page)).toBe(PAGE.dark)
  })

  test('choosing Light makes the app light and keeps it after a reload', async ({ page }) => {
    await start(page)
    await page.goto('./#/settings')
    await page.getByRole('group', { name: 'Appearance', exact: true }).getByText('Light', { exact: true }).click()
    expect(await bodyColor(page)).toBe(PAGE.light)

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')
    expect(await bodyColor(page)).toBe(PAGE.light)
  })

  test('a share picture made in dark mode has a light background', async ({ page }) => {
    await start(page)
    await stubShare(page)
    await addTurn(page, { amount: '100', cash: '10', card: '15' })

    await page.goto('./#/payday')
    await page.getByRole('button', { name: 'Share statement', exact: true }).click()

    await expect.poll(async () => (await page.evaluate(() => window.__sharedPixels ?? [])).length).toBe(1)
    const [pixel] = await page.evaluate(() => window.__sharedPixels ?? [])
    expect(pixel[0]).toBeGreaterThan(240)
    expect(pixel[1]).toBeGreaterThan(240)
    expect(pixel[2]).toBeGreaterThan(240)
  })

  test('the Taxes page prints light', async ({ page }) => {
    await start(page)
    await page.goto('./#/taxes/2026')
    await expect(page.getByRole('heading', { name: 'Taxes and year summary' })).toBeVisible()

    await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
    expect(await bodyColor(page)).toBe(PAGE.light)
    await page.emulateMedia({ media: 'screen', colorScheme: 'dark' })
  })
})

test.describe('phone in light mode', () => {
  test.use({ colorScheme: 'light' })

  test('choosing Dark makes the app dark, and the inline script paints it before the app loads', async ({ page }) => {
    await start(page)
    await page.goto('./#/settings')
    await page.getByRole('group', { name: 'Appearance', exact: true }).getByText('Dark', { exact: true }).click()
    expect(await bodyColor(page)).toBe(PAGE.dark)

    // With the app bundle gone only index.html, the stylesheet and its inline
    // script can paint the page, which is the first-paint case.
    await page.route('**/assets/index-*.js', (route) => route.abort())
    await page.reload()

    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')
    expect(await bodyColor(page)).toBe(PAGE.dark)
  })
})
