import { expect, test, type Page } from '@playwright/test'
import { addTurn, formSave, seedSettings, turnRow } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone.
const NOON = new Date('2026-11-04T12:00:00-06:00')

/** A $100 manicure and a $50 pedicure, both on Wednesday November 4. */
async function seedTwoTurns(page: Page): Promise<void> {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  // A minute later, so turn numbers cannot depend on two equal timestamps.
  await page.clock.setFixedTime(new Date(NOON.getTime() + 60_000))
  await addTurn(page, { service: 'Pedicure', amount: '50' })
}

test('shows this week with each day total', async ({ page }) => {
  await seedTwoTurns(page)
  await page.goto('./#/history')

  await expect(page.getByRole('heading', { name: 'Wednesday, November 4' })).toBeVisible()
  await expect(turnRow(page, 1)).toBeVisible()
  await expect(turnRow(page, 2)).toBeVisible()
  await expect(page.getByText('2 turns · $90')).toBeVisible()
})

test('search narrows the turns to a service', async ({ page }) => {
  await seedTwoTurns(page)
  await page.goto('./#/history')

  await page.getByLabel('Search services').fill('pedi')

  await expect(turnRow(page, 2)).toBeVisible()
  await expect(turnRow(page, 1)).toHaveCount(0)
})

test('a search with no match says so', async ({ page }) => {
  await seedTwoTurns(page)
  await page.goto('./#/history')

  await page.getByLabel('Search services').fill('zzz')

  await expect(page.getByText('No turns match this search.')).toBeVisible()
})

test('yesterday with nothing recorded says so', async ({ page }) => {
  await seedTwoTurns(page)
  await page.goto('./#/history')

  await page.getByRole('button', { name: 'Yesterday' }).click()

  await expect(page.getByText('Nothing recorded for these dates.')).toBeVisible()
})

test('a custom range that ends before it starts shows an error and keeps the inputs', async ({
  page,
}) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/history')

  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('From').fill('2026-11-05')
  await page.getByLabel('To', { exact: true }).fill('2026-11-01')

  const rangeError = page.getByText('The end date must be on or after the start date.')
  await expect(rangeError).toBeVisible()
  await expect(page.getByLabel('From')).toHaveValue('2026-11-05')
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('2026-11-01')
  await expect(page.getByText('Nothing recorded for these dates.')).toHaveCount(0)

  // Correcting the range must not unmount the box being typed in.
  await page.getByLabel('To', { exact: true }).fill('2026-11-06')
  await expect(page.getByLabel('To', { exact: true })).toBeFocused()
  await expect(rangeError).toHaveCount(0)
  await expect(page.getByText('Nothing recorded for these dates.')).toBeVisible()
})

test('deleting a turn updates History', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await page.goto('./#/history')

  await turnRow(page, 1).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
  await expect(page.getByText('Nothing recorded for these dates.')).toBeVisible()
  await expect(page).toHaveURL(/#\/history$/)
})

test('saving a turn opened from History goes back to History', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await page.goto('./#/history')

  await turnRow(page, 1).click()
  await formSave(page).click()

  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Wednesday, November 4' })).toBeVisible()
  await expect(page).toHaveURL(/#\/history$/)
})

test('a day opened from Home lets Back return to Home and does not stick to the History tab', async ({
  page,
}) => {
  await seedTwoTurns(page)
  await page.goto('./')

  // Monday has no turns, so History shows only that day.
  await page.locator('a[href$="day=2026-11-02"]').click()
  await expect(page.getByRole('heading', { name: 'Wednesday, November 4' })).toHaveCount(0)

  await page.goBack()
  await expect(page.getByRole('list', { name: 'This week' })).toBeVisible()

  await page.getByRole('navigation').getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('heading', { name: 'Wednesday, November 4' })).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
})
