import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { addTurn, seedSettings, weeklyPay } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so the machine running the tests (UTC on GitHub) cannot move the day.
const NOW = new Date('2026-11-04T12:00:00-06:00')

interface SharedFile {
  name: string
  type: string
  size: number
}

declare global {
  interface Window {
    __sharedFiles?: SharedFile[]
  }
}

/** Stands in for the phone's share sheet, so a test can read what was handed over. */
async function stubShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shared: { name: string; type: string; size: number }[] = []
    window.__sharedFiles = shared
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: { files?: File[] }) => {
        for (const file of data.files ?? []) {
          shared.push({ name: file.name, type: file.type, size: file.size })
        }
      },
    })
  })
}

function sharedFiles(page: Page): Promise<SharedFile[]> {
  return page.evaluate(() => window.__sharedFiles ?? [])
}

async function start(page: Page): Promise<void> {
  await seedSettings(page, weeklyPay)
  await stubShare(page)
  await page.clock.setFixedTime(NOW)
}

async function addTurns(page: Page): Promise<void> {
  await addTurn(page, { amount: '100', cash: '10', card: '15' })
  await addTurn(page, { amount: '80', cash: '5' })
}

async function expectSharedPicture(page: Page, name: string): Promise<void> {
  await expect.poll(async () => (await sharedFiles(page)).length).toBe(1)
  const files = await sharedFiles(page)
  expect(files[0].name).toBe(name)
  expect(files[0].type).toBe('image/png')
  expect(files[0].size).toBeGreaterThan(3000)
}

/** Records every request the page makes, so the test can prove nothing left the app. */
function trackRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  return urls
}

function outsideRequests(urls: string[], origin: string): string[] {
  return urls.filter((url) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return false
    return new URL(url).origin !== origin
  })
}

test('Share statement hands the phone a PNG and sends nothing anywhere', async ({ page }) => {
  await start(page)
  await addTurns(page)
  const origin = new URL(page.url()).origin
  const requests = trackRequests(page)

  await page.goto('./#/payday')
  await page.getByRole('button', { name: 'Share statement', exact: true }).click()

  await expectSharedPicture(page, 'nail-tracker-statement-2026-11-04.png')
  expect(outsideRequests(requests, origin)).toEqual([])
})

test('Share summary makes a report picture in the technician language', async ({ page }) => {
  await start(page)
  await addTurns(page)
  const origin = new URL(page.url()).origin
  const requests = trackRequests(page)

  await page.goto('./#/earnings')
  await page.getByRole('button', { name: 'Share summary', exact: true }).click()

  await expectSharedPicture(page, 'nail-tracker-report-2026-11-04.png')
  expect(outsideRequests(requests, origin)).toEqual([])
})

test('the year summary shares a picture named after the year', async ({ page }) => {
  await start(page)
  await addTurns(page)
  const origin = new URL(page.url()).origin
  const requests = trackRequests(page)

  await page.goto('./#/earnings')
  await page.getByRole('button', { name: 'Year', exact: true }).click()
  await page.getByRole('link', { name: 'Taxes and year summary' }).click()
  await expect(page.getByRole('heading', { name: 'Taxes and year summary' })).toBeVisible()
  await page.getByRole('button', { name: 'Share', exact: true }).click()

  await expectSharedPicture(page, 'nail-tracker-year-2026.png')
  expect(outsideRequests(requests, origin)).toEqual([])
})

test('with no share sheet the picture downloads as a real PNG', async ({ page }, testInfo) => {
  await seedSettings(page, weeklyPay)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined })
  })
  await page.clock.setFixedTime(NOW)
  await addTurns(page)

  await page.goto('./#/payday')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Share statement', exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toBe('nail-tracker-statement-2026-11-04.png')

  const file = testInfo.outputPath('statement.png')
  await download.saveAs(file)
  const bytes = readFileSync(file)
  expect([...bytes.subarray(0, 4)]).toEqual([137, 80, 78, 71])
  expect(bytes.length).toBeGreaterThan(3000)
})
