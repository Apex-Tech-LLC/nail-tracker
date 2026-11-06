import { expect, test, type Page } from '@playwright/test'
import { addTurn, seedSettings } from './helpers.ts'

// Noon on Wednesday 2026-11-04 in Chicago. The offset is explicit so the
// machine running the tests (UTC on GitHub) cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

async function startEarnings(page: Page): Promise<void> {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
}

test('shows the week figures for a turn with cash and card tips', async ({ page }) => {
  await startEarnings(page)
  await addTurn(page, { amount: '100', cash: '10', card: '15' })
  await page.goto('./#/earnings')

  await expect(page.getByText('Nov 1 – Nov 7')).toBeVisible()
  await expect(page.getByText('$85.00').first()).toBeVisible()
  await expect(page.getByText('$100.00')).toBeVisible()
  await expect(page.getByText('$60.00')).toBeVisible()
  await expect(page.getByText('$25.00').first()).toBeVisible()
  // Commission $60 + card tip $15 still with the salon.
  await expect(page.getByText('$75.00')).toBeVisible()
})

test('previous period shows the week before with no money in it', async ({ page }) => {
  await startEarnings(page)
  await addTurn(page, { amount: '100', cash: '10', card: '15' })
  await page.goto('./#/earnings')

  await page.getByRole('button', { name: 'Previous period' }).click()

  await expect(page.getByText('Oct 25 – Oct 31')).toBeVisible()
  await expect(page.getByText('$0.00').first()).toBeVisible()
})

test('monthly names the month', async ({ page }) => {
  await startEarnings(page)
  await page.goto('./#/earnings')

  await page.getByRole('button', { name: 'Monthly' }).click()

  await expect(page.getByText('November 2026')).toBeVisible()
})

test('a custom range that ends before it starts shows an error', async ({ page }) => {
  await startEarnings(page)
  await page.goto('./#/earnings')

  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('From').fill('2026-11-05')
  await page.getByLabel('To', { exact: true }).fill('2026-11-01')

  await expect(page.getByText('The end date must be on or after the start date.')).toBeVisible()
})

test('with no data the page still shows zero', async ({ page }) => {
  await startEarnings(page)
  await page.goto('./#/earnings')

  await expect(page.getByRole('heading', { name: 'Earnings' })).toBeVisible()
  await expect(page.getByText('$0.00').first()).toBeVisible()
})

test('shows the daily chart with the highest day', async ({ page }) => {
  await startEarnings(page)
  await addTurn(page, { amount: '100' })
  await page.goto('./#/earnings')

  await expect(page.getByText('Earned each day')).toBeVisible()
  // Both charts share the same summary, so check the first one.
  await expect(page.getByRole('img', { name: /Highest day \$60\.00/ }).first()).toBeVisible()
})

test('says when there is not enough data for a chart yet', async ({ page }) => {
  await startEarnings(page)
  await page.goto('./#/earnings')

  await expect(page.getByText('Not enough data for a chart yet.')).toBeVisible()
})

test('the one-day view shows no chart', async ({ page }) => {
  await startEarnings(page)
  await addTurn(page, { amount: '100' })
  await page.goto('./#/earnings')

  await page.getByRole('button', { name: 'Daily' }).click()

  await expect(page.getByRole('img', { name: /Highest day/ })).toHaveCount(0)
})
