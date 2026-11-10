import { expect, test, type Page } from '@playwright/test'
import { formSave, openCommission, seedSettings } from './helpers.ts'

// 3pm on Wednesday 2026-11-04 in the browser's America/Chicago timezone, with
// the week starting on Sunday: this week is November 1 to 7.
const NOON = new Date('2026-11-04T15:00:00-06:00')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON)
})

/** Saves one turn on a chosen day with a 100% rate, so earned equals the amount. */
async function addEarnedOn(page: Page, date: string, amount: string): Promise<void> {
  await page.goto('./#/add')
  await page.getByLabel('Work date').fill(date)
  await page.getByLabel('Service amount').fill(amount)
  await openCommission(page)
  await page.getByLabel('Commission %').fill('100')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()
}

const chip = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const box = (page: Page) => page.getByTestId('pay-chart-box')
const hero = (page: Page) => page.getByTestId('hero-earned')
const toast = (page: Page) => page.locator('div[role=status]')

async function openPayPeriod(page: Page): Promise<void> {
  await page.goto('./')
  await chip(page, 'Pay period').click()
}

test('one tap on Every two weeks shows the period on Home, and Settings and Payday agree', async ({ page }) => {
  await seedSettings(page)
  await addEarnedOn(page, '2026-11-02', '100')
  await openPayPeriod(page)

  await expect(box(page).getByText('How often do you get paid?')).toBeVisible()
  await expect(hero(page)).toHaveText('$0.00')
  await expect(page.getByText(/last pay period|Nothing to compare/)).toHaveCount(0)

  await box(page).getByRole('button', { name: 'Every two weeks', exact: true }).click()

  await expect(box(page)).toContainText('Nov 1 – Nov 14')
  await expect(hero(page)).toHaveText('$100.00')
  await expect(page.getByText('You earned this pay period')).toBeVisible()

  await page.goto('./#/settings')
  await expect(page.getByRole('radio', { name: 'Every two weeks' })).toBeChecked()
  await expect(page.getByLabel('First day of a pay period')).toHaveValue('2026-11-01')

  await page.goto('./#/payday')
  await expect(page.getByText('Pay period: Nov 1 – Nov 14')).toBeVisible()
})

test('one tap on Weekly shows one row of seven days with no Move a week', async ({ page }) => {
  await seedSettings(page)
  await openPayPeriod(page)

  await box(page).getByRole('button', { name: 'Weekly', exact: true }).click()

  await expect(box(page)).toContainText('Nov 1 – Nov 7')
  await expect(box(page).getByTestId('month-day')).toHaveCount(7)
  await expect(box(page).getByRole('button', { name: 'Move a week' })).toHaveCount(0)
})

test('Move a week moves the period on Home and Payday, and Undo puts it back', async ({ page }) => {
  await seedSettings(page)
  await addEarnedOn(page, '2026-10-28', '40')
  await addEarnedOn(page, '2026-11-02', '100')
  await openPayPeriod(page)
  await box(page).getByRole('button', { name: 'Every two weeks', exact: true }).click()
  await expect(box(page)).toContainText('Nov 1 – Nov 14')
  await expect(hero(page)).toHaveText('$100.00')

  await box(page).getByRole('button', { name: 'Move a week', exact: true }).click()

  await expect(box(page)).toContainText('Oct 25 – Nov 7')
  await expect(hero(page)).toHaveText('$140.00')
  await expect(toast(page)).toContainText('Pay period moved a week back')

  await page.getByRole('link', { name: 'Paycheck' }).click()
  await expect(page.getByText('Pay period: Oct 25 – Nov 7')).toBeVisible()
  await expect(page.getByText('Pay period: Nov 1 – Nov 14')).toHaveCount(0)
  await page.getByRole('link', { name: 'Home' }).click()

  await toast(page).getByRole('button', { name: 'Undo' }).click()
  await expect(box(page)).toContainText('Nov 1 – Nov 14')
  await expect(hero(page)).toHaveText('$100.00')

  await page.getByRole('link', { name: 'Paycheck' }).click()
  await expect(page.getByText('Pay period: Nov 1 – Nov 14')).toBeVisible()
})

test('a period with a payment on it stays when the first day moves', async ({ page }) => {
  await seedSettings(page)
  await addEarnedOn(page, '2026-11-02', '100')
  await openPayPeriod(page)
  await box(page).getByRole('button', { name: 'Every two weeks', exact: true }).click()
  await expect(box(page)).toContainText('Nov 1 – Nov 14')

  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Nov 1 – Nov 14/ }).click()
  await page.getByRole('link', { name: 'Record payment', exact: true }).click()
  await page.getByLabel('Amount received').first().fill('50')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()

  await openPayPeriod(page)
  await box(page).getByRole('button', { name: 'Move a week', exact: true }).click()

  // Nov 1 to 14 has money paid on it, so it stays; Home, Payday and Salon owes still agree on it.
  await expect(box(page)).toContainText('Nov 1 – Nov 14')
  await page.goto('./#/payday')
  await expect(page.getByText('Pay period: Nov 1 – Nov 14')).toBeVisible()
})

test('a two-week period shows 14 days with the right money on each and the right total', async ({ page }) => {
  await seedSettings(page, { payPeriodType: 'biweekly', payPeriodAnchorDate: '2026-11-01' })
  await addEarnedOn(page, '2026-11-02', '100')
  await addEarnedOn(page, '2026-11-04', '45')
  await addEarnedOn(page, '2026-11-04', '5')
  await openPayPeriod(page)

  await expect(box(page)).toContainText('Nov 1 – Nov 14')
  const days = box(page).getByTestId('month-day')
  await expect(days).toHaveCount(14)
  await expect(hero(page)).toHaveText('$150.00')

  const shown = await days.allInnerTexts()
  expect(shown).toHaveLength(14)
  expect(shown[0]).toContain('1')
  expect(shown[1]).toContain('$100')
  expect(shown[3]).toContain('$50')
  expect(shown.filter((text) => text.includes('$'))).toHaveLength(2)
  // Two rows of seven, the first starting on the period's first day, a Sunday.
  const header = await box(page).locator('.grid-cols-7').first().innerText()
  expect(header.replace(/\s+/g, ' ').trim().startsWith('Sun Mon')).toBe(true)
})

test('the pill compares with the same stretch of the pay period before', async ({ page }) => {
  await seedSettings(page, { payPeriodType: 'biweekly', payPeriodAnchorDate: '2026-11-01' })
  // Last period is Oct 18 to 31. Today is its fourth day, so Oct 18 to 21 count.
  await addEarnedOn(page, '2026-10-20', '50')
  await addEarnedOn(page, '2026-10-28', '300')
  await addEarnedOn(page, '2026-11-02', '120')
  await openPayPeriod(page)

  await expect(hero(page)).toHaveText('$120.00')
  await expect(page.getByText('▲ $70 more than this time last pay period')).toBeVisible()
})

test('with no earlier pay period the pill has nothing to compare', async ({ page }) => {
  await seedSettings(page, { payPeriodType: 'biweekly', payPeriodAnchorDate: '2026-11-01' })
  await addEarnedOn(page, '2026-11-02', '120')
  await openPayPeriod(page)

  await expect(page.getByText('Nothing to compare yet')).toBeVisible()
})

test('a custom schedule says no pay period covers today, then shows the period once one is added', async ({ page }) => {
  await seedSettings(page, { payPeriodType: 'custom' })
  await addEarnedOn(page, '2026-11-03', '80')
  await openPayPeriod(page)

  await expect(box(page).getByText('No pay period covers today')).toBeVisible()
  await expect(hero(page)).toHaveText('$0.00')

  await box(page).getByRole('link', { name: 'Add pay period' }).click()
  await expect(page).toHaveURL(/#\/payday$/)
  await page.getByRole('button', { name: 'Add pay period', exact: true }).click()
  await page.getByLabel('From', { exact: true }).fill('2026-11-02')
  await page.getByLabel('To', { exact: true }).fill('2026-11-11')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Pay period: Nov 2 – Nov 11')).toBeVisible()

  await openPayPeriod(page)
  await expect(box(page)).toContainText('Nov 2 – Nov 11')
  await expect(box(page).getByTestId('month-day')).toHaveCount(10)
  await expect(hero(page)).toHaveText('$80.00')
})

test('a custom period longer than six weeks shows the six rows that include today', async ({ page }) => {
  await seedSettings(page, { payPeriodType: 'custom' })
  await page.goto('./#/payday')
  await page.getByRole('button', { name: 'Add pay period', exact: true }).click()
  await page.getByLabel('From', { exact: true }).fill('2026-09-01')
  await page.getByLabel('To', { exact: true }).fill('2026-12-31')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Pay period: Sep 1 – Dec 31')).toBeVisible()

  await openPayPeriod(page)
  await expect(box(page).getByTestId('month-day')).toHaveCount(42)
  await expect(box(page).locator('[data-testid="month-day"].border-brand-ink')).toHaveText(/4/)
})

test('changing the first day on Settings replaces the old periods on Payday and Home', async ({ page }) => {
  await seedSettings(page, { payPeriodType: 'weekly', payPeriodAnchorDate: '2026-11-01' })
  await page.goto('./#/payday')
  await expect(page.getByText('Pay period: Nov 1 – Nov 7')).toBeVisible()

  await page.goto('./#/settings')
  await page.getByLabel('First day of a pay period').fill('2026-11-03')

  await page.goto('./#/payday')
  await expect(page.getByText('Pay period: Nov 3 – Nov 9')).toBeVisible()
  await expect(page.getByText('Pay period: Nov 1 – Nov 7')).toHaveCount(0)
  await openPayPeriod(page)
  await expect(box(page)).toContainText('Nov 3 – Nov 9')
})

test('Week start and Payday schedule come first on Settings, above Language', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings')

  const top = async (name: string) => (await page.getByText(name, { exact: true }).first().boundingBox())!.y
  const weekStart = await top('Week starts on')
  const schedule = await top('Payday schedule')
  const language = await top('Language')
  expect(weekStart).toBeLessThan(schedule)
  expect(schedule).toBeLessThan(language)
})
