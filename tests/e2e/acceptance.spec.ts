import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  addTurn,
  formSave,
  openDateChoices,
  openEarningsToday,
  rowAmount,
  seedSettings,
  turnRow,
  weeklyPay,
} from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone.
const NOON = new Date('2026-11-04T12:00:00')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page, weeklyPay)
})

/** The turn count on Home's stats strip. */
function todayTurns(page: Page): Locator {
  return page.getByText('Turns', { exact: true }).locator('..').locator('b')
}

/** One value in Home's stats strip, found by its label. */
function statValue(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator('..').locator('b')
}

/** The big earned number on Home. */
function heroEarned(page: Page): Locator {
  return page.getByTestId('hero-earned')
}

/** The big Total earned figure on Earnings. */
function earningsTotal(page: Page): Locator {
  return page.getByText('Total earned', { exact: true }).locator('..').locator('p.text-3xl')
}

/** Saves one turn on a chosen past day through the form's Other day choice. */
async function addTurnOn(page: Page, date: string, amount: string): Promise<void> {
  await page.goto('./#/add')
  await openDateChoices(page)
  await page.getByRole('button', { name: 'Other day' }).click()
  await page.getByLabel('Work date').fill(date)
  await page.getByLabel('Service amount').fill(amount)
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

test('full day', async ({ page }) => {
  await addTurn(page, { service: 'Gel Manicure', amount: '40', cash: '5' })
  await addTurn(page, { service: 'Pedicure', amount: '50', card: '10' })
  await addTurn(page, { service: 'Manicure', amount: '30' })

  await expect(todayTurns(page)).toHaveText('3')
  await expect(heroEarned(page)).toHaveText('$87.00')
  await expect(statValue(page, 'Tips')).toHaveText('$15')
  await expect(turnRow(page, 3)).toBeVisible()

  await openEarningsToday(page)
  await expect(rowAmount(page, 'Service revenue')).toHaveText('$120.00')
  await expect(rowAmount(page, 'Commission')).toHaveText('$72.00')
  await expect(rowAmount(page, 'Cash tips')).toHaveText('$5.00')
  await expect(rowAmount(page, 'Card tips')).toHaveText('$10.00')
})

test('combined ticket', async ({ page }) => {
  await page.goto('./#/add')
  await page.getByLabel('Service amount').fill('80')
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByLabel('Turn count').fill('2')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()

  // A minute later, so the two turns cannot share a timestamp and their
  // numbers stay in the order they were saved.
  await page.clock.setFixedTime(new Date(NOON.getTime() + 60_000))
  await addTurn(page, { amount: '30' })

  await expect(turnRow(page, 2)).toBeVisible()
  await expect(turnRow(page, 3)).toBeVisible()
  await expect(todayTurns(page)).toHaveText('3')
  // Two rows: the combined ticket and the second turn.
  await expect(page.getByTestId('turn-row')).toHaveCount(2)

  await openEarningsToday(page)
  await expect(rowAmount(page, 'Customers')).toHaveText('2')
})

test('no tip', async ({ page }) => {
  await addTurn(page, { amount: '25' })

  await expect(heroEarned(page)).toHaveText('$15.00')
})

test('tip with no commission', async ({ page }) => {
  await addTurn(page, { amount: '50', cash: '5', rate: '0' })

  await expect(heroEarned(page)).toHaveText('$5.00')
  await expect(statValue(page, 'Tips')).toHaveText('$5')

  await openEarningsToday(page)
  await expect(rowAmount(page, 'Commission')).toHaveText('$0.00')
})

test('zero dollar service', async ({ page }) => {
  await addTurn(page, { amount: '0', cash: '5' })

  await expect(turnRow(page, 1)).toBeVisible()
  await expect(heroEarned(page)).toHaveText('$5.00')
})

test('old date', async ({ page }) => {
  await addTurnOn(page, '2026-10-20', '100')

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('From').fill('2026-10-20')
  await page.getByLabel('To', { exact: true }).fill('2026-10-20')

  await expect(page.getByRole('heading', { name: 'Tuesday, October 20' })).toBeVisible()

  await page.goto('./')
  await expect(page.getByText('Your turns today will show here.')).toBeVisible()

  await page.goto('./#/payday')
  await expect(page.getByText('Oct 18 – Oct 24')).toBeVisible()
})

test('shift past midnight', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-05T00:30:00-06:00'))
  await page.goto('./#/add')
  await openDateChoices(page)
  await page.getByRole('button', { name: 'Yesterday' }).click()
  await page.getByLabel('Service amount').fill('100')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()

  await page.goto('./')
  await expect(page.getByText('Your turns today will show here.')).toBeVisible()

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Yesterday' }).click()
  await expect(page.getByRole('heading', { name: 'Wednesday, November 4' })).toBeVisible()
  await expect(turnRow(page, 1)).toBeVisible()
})

test('edit an old turn', async ({ page }) => {
  await addTurnOn(page, '2026-10-20', '100')

  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Oct 18 – Oct 24/ }).click()
  await expect(rowAmount(page, 'Expected salon payout')).toHaveText('$60.00')

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('From').fill('2026-10-20')
  await page.getByLabel('To', { exact: true }).fill('2026-10-20')
  await turnRow(page, 1).click()
  await page.getByLabel('Service amount').fill('200')
  await formSave(page).click()
  // Wait for the save to close the form before leaving, so its back step
  // cannot land after the next page is opened.
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()

  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Oct 18 – Oct 24/ }).click()
  await expect(rowAmount(page, 'Expected salon payout')).toHaveText('$120.00')
})

test('delete a turn in a report', async ({ page }) => {
  await addTurn(page, { amount: '100' })
  // A minute later, so Turn #2 is always the $50 pedicure.
  await page.clock.setFixedTime(new Date(NOON.getTime() + 60_000))
  await addTurn(page, { service: 'Pedicure', amount: '50' })

  await page.goto('./#/earnings')
  await expect(earningsTotal(page)).toHaveText('$90.00')

  await page.goto('./#/history')
  await turnRow(page, 2).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()

  await page.goto('./#/earnings')
  await expect(earningsTotal(page)).toHaveText('$60.00')
})

test('odd price, odd rate', async ({ page }) => {
  await addTurn(page, { amount: '19.99', rate: '62.5' })

  await expect(heroEarned(page)).toHaveText('$12.49')

  await openEarningsToday(page)
  await expect(rowAmount(page, 'Commission')).toHaveText('$12.49')
})

test('language changes nothing', async ({ page }) => {
  await addTurn(page, { amount: '100' })

  await page.goto('./#/earnings')
  await expect(earningsTotal(page)).toHaveText('$60.00')

  await page.goto('./#/settings')
  await page
    .getByRole('group', { name: 'Language' })
    .getByText('Tiếng Việt', { exact: true })
    .click()
  await page.goto('./#/earnings')

  await expect(rowAmount(page, 'Tiền chia')).toHaveText('$60.00')
  await expect(
    page.getByText('Tổng tiền kiếm được', { exact: true }).locator('..').locator('p.text-3xl'),
  ).toHaveText('$60.00')
})

test('daylight saving', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-06:00'))
  await addTurn(page, { amount: '100' })

  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-06:00'))
  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Yesterday' }).click()

  await expect(page.getByRole('heading', { name: 'Sunday, November 1' })).toBeVisible()
  await expect(turnRow(page, 1)).toBeVisible()
})

test('no account', async ({ page }) => {
  const accountWords = /sign in|log in|password|email/i

  await page.goto('./')
  await expect(page.getByText(accountWords)).toHaveCount(0)

  await page.goto('./#/settings')
  await expect(page.getByText(accountWords)).toHaveCount(0)

  await page.goto('./#/payday')
  await expect(page.getByText(accountWords)).toHaveCount(0)
})
