import { expect, test, type Locator, type Page } from '@playwright/test'
import { addTurn, rowAmount, seedSettings, selectServices, weeklyPay } from './helpers.ts'

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

/** The payment rows listed under the period's Payments heading. */
function paymentRows(page: Page): Locator {
  return page
    .getByRole('heading', { name: 'Payments', exact: true })
    .locator('..')
    .getByRole('link')
}

/** Opens the payment form from the period page. */
async function openPaymentForm(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Record payment', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Record payment', exact: true }),
  ).toBeVisible()
}

/** Records one payment for the whole suggested amount, then waits for the period page. */
async function recordPayment(page: Page, amount: string): Promise<void> {
  await openPaymentForm(page)
  await page.getByLabel('Amount received').first().fill(amount)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()
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
  await selectServices(page, ['Manicure'])
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

test('a short payment leaves the rest outstanding', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '2000', cash: '180', card: '240' })
  await openWeekPeriod(page)
  await recordPayment(page, '1400')

  await expect(rowAmount(page, 'Salon paid', 'Money already received')).toHaveText('$1,400.00')
  await expect(rowAmount(page, 'Outstanding')).toHaveText('$40.00')
  await expect(page.getByText('Still owed', { exact: true })).toBeVisible()
})

test('paying the payout in full clears what is owed', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '2000', cash: '180', card: '240' })
  await openWeekPeriod(page)
  await recordPayment(page, '1440')

  await expect(page.getByText('Paid in full', { exact: true })).toBeVisible()
  await expect(rowAmount(page, 'Outstanding')).toHaveText('$0.00')
})

test('paying more than the payout shows the overpaid amount', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '2000', cash: '180', card: '240' })
  await openWeekPeriod(page)
  await recordPayment(page, '1500')

  await expect(page.getByText('Overpaid by $60.00', { exact: true })).toBeVisible()
})

test('two partial payments add up to paid in full', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '2000', cash: '180', card: '240' })
  await openWeekPeriod(page)
  await recordPayment(page, '1000')
  await recordPayment(page, '440')

  await expect(page.getByText('Paid in full', { exact: true })).toBeVisible()
  await expect(paymentRows(page)).toHaveCount(2)
})

test('one payment splits across two pay periods', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '100' })
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00'))
  await addTurn(page, { amount: '100' })

  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Nov 8 – Nov 14/ }).click()
  await openPaymentForm(page)
  await page.getByLabel('Amount received').first().fill('120')

  const lines = page.getByTestId('allocation-line')
  await expect(lines).toHaveCount(2)
  await expect(lines.nth(0).locator('option:checked')).toHaveText('Nov 1 – Nov 7')
  await expect(lines.nth(0).getByLabel('Amount received')).toHaveValue('60.00')
  await expect(lines.nth(1).locator('option:checked')).toHaveText('Nov 8 – Nov 14')
  await expect(lines.nth(1).getByLabel('Amount received')).toHaveValue('60.00')

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()

  await page.goto('./#/payday')
  await expect(page.getByRole('link', { name: /Nov 1 – Nov 7/ })).toContainText('Paid in full')
  await expect(page.getByRole('link', { name: /Nov 8 – Nov 14/ })).toContainText('Paid in full')
})

test('a payment whose lines do not add up is refused', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '100' })
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00'))
  await addTurn(page, { amount: '100' })

  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Nov 8 – Nov 14/ }).click()
  await openPaymentForm(page)
  await page.getByLabel('Amount received').first().fill('120')
  await page
    .getByTestId('allocation-line')
    .nth(0)
    .getByLabel('Amount received')
    .fill('10')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(
    page.getByText('The amounts below must add up to the payment.', { exact: true }),
  ).toBeVisible()
})

test('a payment can be deleted', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '2000', cash: '180', card: '240' })
  await openWeekPeriod(page)
  await recordPayment(page, '1000')

  await paymentRows(page).first().click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()

  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()
  await expect(rowAmount(page, 'Salon paid', 'Money already received')).toHaveText('$0.00')
  await expect(paymentRows(page)).toHaveCount(0)
})

test('editing a payment changes what the salon paid', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '2000', cash: '180', card: '240' })
  await openWeekPeriod(page)
  await recordPayment(page, '1000')

  await paymentRows(page).first().click()
  await expect(page.getByRole('heading', { name: 'Edit payment' })).toBeVisible()
  await page.getByLabel('Amount received').first().fill('1100')
  await page.getByTestId('allocation-line').getByLabel('Amount received').fill('1100')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()
  await expect(rowAmount(page, 'Salon paid', 'Money already received')).toHaveText('$1,100.00')
})

test('a payment of zero is refused', async ({ page }) => {
  await start(page, weeklyPay)
  await openWeekPeriod(page)
  await openPaymentForm(page)
  await page.getByLabel('Amount received').first().fill('0')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Enter an amount above zero.', { exact: true })).toBeVisible()
})

test('a cleared payment date is refused instead of moved to today', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '100' })
  await openWeekPeriod(page)
  await openPaymentForm(page)
  await page.getByLabel('Amount received').first().fill('60')

  const dateBox = page.getByLabel('Payment date')
  await dateBox.fill('')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Pick a date.', { exact: true })).toBeVisible()
  await expect(dateBox).toHaveAttribute('aria-invalid', 'true')
  await expect(dateBox).toHaveAccessibleDescription('Pick a date.')

  // Choosing a date clears the error.
  await dateBox.fill('2026-11-04')
  await expect(page.getByText('Pick a date.', { exact: true })).toHaveCount(0)

  // Clearing it again still refuses rather than saving under today.
  await dateBox.fill('')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Pick a date.', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()
  await expect(paymentRows(page)).toHaveCount(0)
  await expect(rowAmount(page, 'Salon paid', 'Money already received')).toHaveText('$0.00')
})

test('paying a period that no longer exists shows not found with no Save button', async ({
  page,
}) => {
  await start(page, weeklyPay)
  await page.goto('./#/payday/period-nope/pay')

  await expect(page.getByText('This entry no longer exists.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Payday', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
})

test('a quick double tap on Save records one payment', async ({ page }) => {
  await start(page, weeklyPay)
  await addTurn(page, { amount: '2000', cash: '180', card: '240' })
  await openWeekPeriod(page)
  await openPaymentForm(page)
  await page.getByLabel('Amount received').first().fill('1000')
  await page.getByRole('button', { name: 'Save', exact: true }).dblclick()

  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()
  await expect(paymentRows(page)).toHaveCount(1)
  await expect(rowAmount(page, 'Salon paid', 'Money already received')).toHaveText('$1,000.00')
})
