import { expect, test, type Locator, type Page } from '@playwright/test'
import { addTurn, seedSettings, weeklyPay } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone.
const NOON = new Date('2026-11-04T12:00:00')

async function start(page: Page, settings: Record<string, unknown> = {}): Promise<void> {
  await seedSettings(page, settings)
  await page.clock.setFixedTime(NOON)
}

/** Opens the payday list and the November 1 to 7 period in it. */
async function openWeekPeriod(page: Page): Promise<void> {
  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Nov 1 – Nov 7/ }).click()
}

async function addAdjustment(page: Page, amount: string, category: string): Promise<void> {
  await page.goto('./#/adjustment/new')
  await page.getByLabel('Amount').fill(amount)
  await page.getByRole('button', { name: category, exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

/**
 * The amount on the period row whose label is exactly `label`, so a matching
 * amount on another row (commission often equals the payout) cannot pass.
 */
function rowAmount(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator('..').locator('span').last()
}

async function addCustomPeriod(page: Page, from: string, to: string): Promise<void> {
  await page.getByRole('button', { name: 'Add pay period' }).click()
  await page.getByLabel('From').fill(from)
  await page.getByLabel('To', { exact: true }).fill(to)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}

test('with no schedule it points at Settings', async ({ page }) => {
  await start(page)
  await page.goto('./#/payday')

  await expect(
    page.getByText('Set your payday schedule to see what the salon owes you.'),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Settings' })).toBeVisible()
})

test('the current period is listed with nothing in it yet', async ({ page }) => {
  await start(page, weeklyPay)
  await page.goto('./#/payday')

  await expect(page.getByText('Nov 1 – Nov 7')).toBeVisible()
  await expect(page.getByText('Current period')).toBeVisible()
  await expect(page.getByText('Nothing yet')).toBeVisible()
})

test('the period shows the spec example figures', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '2000', cash: '180', card: '240' })
  await openWeekPeriod(page)

  await expect(page.getByText('$1,200.00')).toBeVisible()
  await expect(page.getByText('$240.00')).toBeVisible()
  // Cash tips show as earned and again as already in hand.
  await expect(page.getByText('$180.00').first()).toBeVisible()
  await expect(page.getByText('$1,620.00')).toBeVisible()
  // Expected salon payout and outstanding are both $1,440.
  await expect(rowAmount(page, 'Expected salon payout')).toHaveText('$1,440.00')
  await expect(page.getByText('Outstanding')).toBeVisible()
})

test('a cash tip the salon holds is part of what it owes', async ({ page }) => {
  await start(page, weeklyPay)
  await page.goto('./#/add')
  await page.getByRole('button', { name: 'Manicure', exact: true }).click()
  await page.getByLabel('Service amount').fill('100')
  await page.getByLabel('Cash tip').fill('10')
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByLabel('Cash tip already in my hand').uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()

  await openWeekPeriod(page)
  await expect(rowAmount(page, 'Expected salon payout')).toHaveText('$70.00')
})

test('a card tip already in hand is not owed again', async ({ page }) => {
  await start(page, { ...weeklyPay, cardTipHandling: 'inHand' })
  await addTurn(page, { amount: '100', card: '15' })
  await openWeekPeriod(page)

  await expect(rowAmount(page, 'Expected salon payout')).toHaveText('$60.00')
})

test('a bookkeeping deduction lowers earned but not the salon payout', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '100' })
  await addAdjustment(page, '-10', 'Bookkeeping deduction')
  await openWeekPeriod(page)

  await expect(rowAmount(page, 'Total earned')).toHaveText('$50.00')
  await expect(rowAmount(page, 'Expected salon payout')).toHaveText('$60.00')
})

test('a period closes and reopens', async ({ page }) => {
  await start(page, weeklyPay)
  await openWeekPeriod(page)

  await page.getByRole('button', { name: 'Close period' }).click()
  await expect(page.getByText('Closed', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Reopen period' }).click()
  await expect(page.getByText('Open', { exact: true })).toBeVisible()
})

test('a custom period can be added by hand', async ({ page }) => {
  await start(page, { payPeriodType: 'custom' })
  await page.goto('./#/payday')
  await addCustomPeriod(page, '2026-11-01', '2026-11-10')

  await expect(page.getByText('Nov 1 – Nov 10')).toBeVisible()
})

test('a custom period that overlaps another one is refused', async ({ page }) => {
  await start(page, { payPeriodType: 'custom' })
  await page.goto('./#/payday')
  await addCustomPeriod(page, '2026-11-01', '2026-11-10')
  await expect(page.getByText('Nov 1 – Nov 10')).toBeVisible()

  await addCustomPeriod(page, '2026-11-05', '2026-11-12')

  await expect(page.getByText('These dates overlap another pay period.')).toBeVisible()
})

test('a quick double tap on Save adds the period once without an overlap error', async ({
  page,
}) => {
  await start(page, { payPeriodType: 'custom' })
  await page.goto('./#/payday')
  await page.getByRole('button', { name: 'Add pay period' }).click()
  await page.getByLabel('From').fill('2026-11-01')
  await page.getByLabel('To', { exact: true }).fill('2026-11-10')
  await page.getByRole('button', { name: 'Save', exact: true }).dblclick()

  await expect(page.getByText('Nov 1 – Nov 10')).toBeVisible()
  await expect(page.getByText('These dates overlap another pay period.')).toHaveCount(0)

  // Let a second save land before counting, so a duplicate cannot be missed.
  await page.waitForTimeout(500)
  await expect(page.getByText('Nov 1 – Nov 10')).toHaveCount(1)
})
