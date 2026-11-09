import { expect, test } from '@playwright/test'
import { datePill, fixNow, seedSettings } from './helpers.ts'

// Monday noon in Chicago, written with its offset so a UTC runner keeps the day.
const MONDAY = new Date('2026-11-09T12:00:00-06:00')

const SCREENS = [
  ['Add turn', './#/add'],
  ['Say', './#/say'],
  ['adjustment', './#/adjustment/new'],
] as const

test.beforeEach(async ({ page }) => {
  await fixNow(page, MONDAY)
})

test('Yesterday changes the shown date in one tap on Add turn, Say and adjustments', async ({
  page,
}) => {
  await seedSettings(page)
  for (const [screen, path] of SCREENS) {
    await page.goto(path)
    const today = page.getByRole('button', { name: 'Today', exact: true })
    const yesterday = page.getByRole('button', { name: 'Yesterday', exact: true })
    await expect(datePill(page), screen).toContainText('Mon 11/9')
    await expect(today, screen).toHaveAttribute('aria-pressed', 'true')

    await yesterday.click()
    await expect(datePill(page), screen).toContainText('Sun 11/8')
    await expect(yesterday, screen).toHaveAttribute('aria-pressed', 'true')
    await expect(today, screen).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByLabel('Work date'), screen).toHaveValue('2026-11-08')

    await today.click()
    await expect(datePill(page), screen).toContainText('Mon 11/9')
  }
})

test('the date pill picks another day and neither chip stays highlighted', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')

  const input = page.getByLabel('Work date')
  await input.fill('2026-11-04')
  await expect(datePill(page)).toContainText('Wed 11/4')
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByRole('button', { name: 'Yesterday', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  // One tap anywhere on the pill lands on the real date input, so the phone's picker opens.
  const hit = await datePill(page).evaluate((pill) => {
    const box = pill.getBoundingClientRect()
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return top instanceof HTMLInputElement && top.type === 'date'
  })
  expect(hit).toBe(true)
})

test('Vietnamese shows the date as T2 9/11', async ({ page }) => {
  await seedSettings(page, { locale: 'vi' })
  await page.goto('./#/add')

  await expect(datePill(page)).toContainText('T2 9/11')
  await page.getByRole('button', { name: 'Hôm qua', exact: true }).click()
  await expect(datePill(page)).toContainText('CN 8/11')
})

for (const [language, settings] of [
  ['English', {}],
  ['Vietnamese', { locale: 'vi' }],
] as const) {
  test(`Add turn fits at 375 by 740 in ${language} without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 })
    await seedSettings(page, settings)
    await page.goto('./#/add')

    // The header is two lines at most: Say and commission, then the date row.
    const header = page.locator('form header')
    await expect(datePill(page)).toBeVisible()
    const lines = await header
      .locator('a, button[aria-pressed], [data-date-pill], button[aria-expanded]')
      .evaluateAll((items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size)
    expect(lines).toBe(2)

    // Tapping the amount puts the box above the number pad, and Save is on the pad.
    const amount = page.locator('[data-pad-target^="line:"]').first()
    await amount.click()
    const pad = page.locator('[data-number-pad]')
    await expect(pad).toBeVisible()
    const amountBox = await amount.boundingBox()
    const padBox = await pad.boundingBox()
    const saveBox = await pad.getByRole('button', { name: /^(Save|Lưu)$/ }).boundingBox()
    expect(amountBox && padBox && amountBox.y + amountBox.height).toBeLessThanOrEqual(padBox?.y ?? 0)
    expect(padBox && padBox.y + padBox.height).toBeLessThanOrEqual(740)
    expect(saveBox && saveBox.y + saveBox.height).toBeLessThanOrEqual(740)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
}
