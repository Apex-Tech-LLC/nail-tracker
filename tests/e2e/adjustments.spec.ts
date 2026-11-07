import { expect, test, type Page } from '@playwright/test'
import { addTurn, seedSettings } from './helpers.ts'

// Noon on 2026-11-04, the day every test records to.
const NOON = new Date('2026-11-04T12:00:00')

interface AdjustmentOptions {
  amount: string
  category?: string
  note?: string
}

/** Fills and saves the Add Adjustment form (English UI). */
async function addAdjustment(
  page: Page,
  { amount, category = 'Bonus', note }: AdjustmentOptions,
): Promise<void> {
  await page.goto('./#/adjustment/new')
  await page.getByLabel('Amount').fill(amount)
  await page.getByRole('button', { name: category, exact: true }).click()
  if (note) await page.getByLabel('Note').fill(note)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

test('a negative adjustment shows on History and lowers the day total', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await addAdjustment(page, {
    amount: '-25',
    category: 'Commission correction',
    note: 'Wrong price',
  })
  await page.goto('./#/history')

  await expect(page.getByText('Commission correction')).toBeVisible()
  await expect(page.getByText('Wrong price')).toBeVisible()
  await expect(page.getByText('-$25')).toBeVisible()
  await expect(page.getByText('1 turn · $35')).toBeVisible()
})

test('an adjustment changes today’s earned money', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await addAdjustment(page, {
    amount: '-25',
    category: 'Commission correction',
    note: 'Wrong price',
  })
  await page.goto('./')

  // $60 commission plus the -$25 correction.
  await expect(page.getByTestId('hero-earned')).toHaveText('$35.00')
  await expect(page.getByText('Turns', { exact: true }).locator('..').locator('b')).toHaveText('1')
})

test('a zero amount shows an error and stays on the form', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/adjustment/new')
  await page.getByLabel('Amount').fill('0')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(
    page.getByText('Enter an amount that is not zero, like 25 or -25.'),
  ).toBeVisible()
  await expect(page).toHaveURL(/#\/adjustment\/new$/)
})

test('editing an adjustment saves the new amount', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addAdjustment(page, { amount: '10' })
  await page.goto('./#/history')

  await page.getByRole('link', { name: /Bonus/ }).click()
  await page.getByLabel('Amount').fill('20')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Bonus/ })).toContainText('$20')
})

test('deleting an adjustment removes it from History', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addAdjustment(page, { amount: '15' })
  await page.goto('./#/history')

  await page.getByRole('link', { name: /Bonus/ }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByText('Nothing recorded for these dates.')).toBeVisible()
})

test('a quick double tap on Save records the adjustment once', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/adjustment/new')
  await page.getByLabel('Amount').fill('15')
  await page.getByRole('button', { name: 'Save', exact: true }).dblclick()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()

  // Let a second save land before counting, so a duplicate cannot be missed.
  await page.goto('./#/history')
  await page.waitForTimeout(500)
  await expect(page.getByRole('link', { name: /Bonus/ })).toHaveCount(1)
})
