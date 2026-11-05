import { expect, test, type Page } from '@playwright/test'
import { addTurn, seedSettings } from './helpers.ts'

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
  await expect(page.getByText('Turn #1')).toBeVisible()
  await expect(page.getByText('Turn #2')).toBeVisible()
  await expect(page.getByText('$90.00')).toBeVisible()
})

test('search narrows the turns to a service', async ({ page }) => {
  await seedTwoTurns(page)
  await page.goto('./#/history')

  await page.getByLabel('Search services').fill('pedi')

  await expect(page.getByText('Turn #2')).toBeVisible()
  await expect(page.getByText('Turn #1')).toHaveCount(0)
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

test('a custom range that ends before it starts shows an error', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/history')

  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('From').fill('2026-11-05')
  await page.getByLabel('To', { exact: true }).fill('2026-11-01')

  await expect(page.getByText('The end date must be on or after the start date.')).toBeVisible()
})

test('deleting a turn updates History', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await page.goto('./#/history')

  await page.getByRole('link', { name: /Turn #1/ }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No turns yet')).toBeVisible()

  await page.goto('./#/history')
  await expect(page.getByText('Nothing recorded for these dates.')).toBeVisible()
})
