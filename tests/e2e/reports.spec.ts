import { expect, test, type Page } from '@playwright/test'
import {
  addTurn,
  formSave,
  seedSettings,
  selectServices,
} from './helpers.ts'

// Noon on Wednesday 2026-11-04 in Chicago. The offset is explicit so the
// machine running the tests (UTC on GitHub) cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

async function startReports(page: Page): Promise<void> {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
}

interface Tips {
  cash?: string
  card?: string
}

/** Saves one turn on a chosen past day through the form's date pill. */
async function addTurnOn(
  page: Page,
  date: string,
  amount: string,
  tips: Tips = {},
): Promise<void> {
  await page.goto('./#/add')
  await page.getByLabel('Work date').fill(date)
  await page.getByLabel('Service amount').fill(amount)
  if (tips.cash) await page.getByLabel('Cash tip').fill(tips.cash)
  if (tips.card) await page.getByLabel('Card tip').fill(tips.card)
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

async function openMonth(page: Page): Promise<void> {
  await page.goto('./#/earnings')
  await page.getByRole('button', { name: 'Month', exact: true }).click()
}

test('shows the week figures for a turn with cash and card tips', async ({ page }) => {
  await startReports(page)
  await addTurn(page, { amount: '100', cash: '10', card: '15' })
  await page.goto('./#/earnings')

  await expect(page.getByText('Nov 1 – Nov 7')).toBeVisible()
  await expect(page.getByText('$85.00').first()).toBeVisible()

  // The four pay rows are open with no tap.
  await expect(page.getByText('$100.00', { exact: true })).toBeVisible()
  await expect(page.getByText('$60.00', { exact: true })).toBeVisible()
  await expect(page.getByText('$25.00', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'More', exact: true }).click()
  // Commission $60 + card tip $15 still with the salon.
  await expect(page.getByText('$75.00', { exact: true })).toBeVisible()
})

test('previous period shows the week before with no money in it', async ({ page }) => {
  await startReports(page)
  await addTurn(page, { amount: '100', cash: '10', card: '15' })
  await page.goto('./#/earnings')

  await page.getByRole('button', { name: 'Previous period' }).click()

  await expect(page.getByText('Oct 25 – Oct 31')).toBeVisible()
  await expect(page.getByText('$0.00').first()).toBeVisible()
})

test('month names the month', async ({ page }) => {
  await startReports(page)
  await page.goto('./#/earnings')

  await page.getByRole('button', { name: 'Month', exact: true }).click()

  await expect(page.getByText('November 2026')).toBeVisible()
})

test('a custom range that ends before it starts shows an error', async ({ page }) => {
  await startReports(page)
  await page.goto('./#/earnings')

  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('From').fill('2026-11-05')
  await page.getByLabel('To', { exact: true }).fill('2026-11-01')

  await expect(page.getByText('The end date must be on or after the start date.')).toBeVisible()
})

test('with no data the page still shows zero', async ({ page }) => {
  await startReports(page)
  await page.goto('./#/earnings')

  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
  await expect(page.getByText('$0.00').first()).toBeVisible()
})

test('October compares with September in dollars and percent', async ({ page }) => {
  await startReports(page)
  // October: $7,000 of services at 60% is $4,200, plus a $10 cash tip.
  await addTurnOn(page, '2026-10-15', '7000', { cash: '10' })
  // September: $6,500 at 60% is $3,900.
  await addTurnOn(page, '2026-09-15', '6500')

  await openMonth(page)
  await page.getByRole('button', { name: 'Previous period' }).click()

  await expect(page.getByText('October 2026', { exact: true })).toBeVisible()
  await expect(page.getByText('$4,210.00').first()).toBeVisible()
  const change = page.getByTestId('report-change')
  await expect(change).toContainText('$310.00')
  await expect(change).toContainText('(8%)')
  await expect(change).toContainText('last month')
})

test('a previous month at zero shows dollars only, never a percent or NaN', async ({ page }) => {
  await startReports(page)
  await addTurnOn(page, '2026-10-15', '70')

  await openMonth(page)
  await page.getByRole('button', { name: 'Previous period' }).click()

  const change = page.getByTestId('report-change')
  await expect(change).toContainText('$42.00')
  await expect(change).toContainText('last month')
  await expect(change).not.toContainText('%')
  await expect(page.getByText(/Infinity|NaN/)).toHaveCount(0)
})

test('a turn with three services gives three By service lines and one turn', async ({ page }) => {
  await startReports(page)
  await page.goto('./#/add')
  const lines = page.getByTestId('service-line')

  await selectServices(page, ['Manicure', 'Pedicure', 'Gel-X'])
  await expect(lines).toHaveCount(3)
  await lines.nth(0).getByLabel('Service amount').fill('40')
  await lines.nth(1).getByLabel('Service amount').fill('50')
  await lines.nth(2).getByLabel('Service amount').fill('15')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()

  await page.goto('./#/earnings')

  await expect(page.getByRole('heading', { name: 'By service' })).toBeVisible()
  await expect(page.getByTestId('service-line')).toHaveCount(3)
  await expect(page.getByTestId('report-stat-turns')).toHaveText('1')
})

test('tapping a trend bar shows its numbers, and Open moves the picker', async ({ page }) => {
  await startReports(page)
  await addTurnOn(page, '2026-10-28', '100')
  await addTurn(page, { amount: '50' })

  await page.goto('./#/earnings')

  await page.getByRole('button', { name: /^Oct 25 – Oct 31:/ }).click()
  const detail = page.getByTestId('trend-detail')
  await expect(detail).toContainText('Oct 25 – Oct 31')
  await expect(detail).toContainText('$60.00')

  await detail.getByRole('button', { name: 'Open', exact: true }).click()

  await expect(page.getByText('Oct 25 – Oct 31', { exact: true })).toBeVisible()
  await expect(page.getByTestId('trend-detail')).toHaveCount(0)
})

test('the trend follows the period: days for Day, months for Year', async ({ page }) => {
  await startReports(page)
  await addTurn(page, { amount: '100' })
  await page.goto('./#/earnings')

  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await expect(page.getByText('Earned each day')).toBeVisible()
  await expect(page.getByTestId('trend-bar')).toHaveCount(14)

  await page.getByRole('button', { name: 'Year', exact: true }).click()
  await expect(page.getByText('Earned each month')).toBeVisible()
  await expect(page.getByTestId('trend-bar')).toHaveCount(12)
})

test('says when there is not enough data for a chart yet', async ({ page }) => {
  await startReports(page)
  await page.goto('./#/earnings')

  await expect(page.getByText('Not enough data for a chart yet.')).toBeVisible()
})

test('Records stay hidden with three weeks of data and appear with five', async ({ page }) => {
  await startReports(page)

  // 20 days before today: not four weeks of history yet.
  await addTurnOn(page, '2026-10-15', '100')
  await page.goto('./#/earnings')
  await expect(page.getByRole('heading', { name: 'Records' })).toHaveCount(0)

  // 35 days before today: four whole weeks have passed.
  await addTurnOn(page, '2026-09-30', '100')
  await page.goto('./#/earnings')
  await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible()
  await expect(page.getByText('Best day', { exact: true })).toBeVisible()
})

test('By weekday appears for a month and marks the best and slowest day', async ({ page }) => {
  await startReports(page)
  // Two different weekdays in October: Tuesday Oct 6 and Saturday Oct 3.
  await addTurnOn(page, '2026-10-06', '100')
  await addTurnOn(page, '2026-10-03', '50')

  await openMonth(page)
  await page.getByRole('button', { name: 'Previous period' }).click()

  await expect(page.getByRole('heading', { name: 'By weekday' })).toBeVisible()
  await expect(page.getByText('Best', { exact: true })).toBeVisible()
  await expect(page.getByText('Slowest', { exact: true })).toBeVisible()
})
