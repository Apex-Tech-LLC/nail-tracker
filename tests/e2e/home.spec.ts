import { expect, test, type Page } from '@playwright/test'
import {
  addTurn,
  formSave,
  openCommission,
  openDateChoices,
  seedSettings,
  turnRow,
} from './helpers.ts'

// 3pm on Wednesday 2026-11-04 in the browser's America/Chicago timezone. The
// offset is explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T15:00:00-06:00')

const fixClock = (page: Page) => page.clock.setFixedTime(NOON)

test.beforeEach(async ({ page }) => {
  await seedSettings(page)
})

const hero = (page: Page) => page.getByTestId('hero-earned')
const stat = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator('..').locator('b')

/** Saves one turn on a chosen day with a 100% rate, so earned equals the amount. */
async function addEarnedOn(page: Page, date: string, amount: string): Promise<void> {
  await page.goto('./#/add')
  await openDateChoices(page)
  await page.getByRole('button', { name: 'Other day' }).click()
  await page.getByLabel('Work date').fill(date)
  await page.getByLabel('Service amount').fill(amount)
  await openCommission(page)
  await page.getByLabel('Commission %').fill('100')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()
}

test('an empty day says where today’s turns will show', async ({ page }) => {
  await fixClock(page)
  await page.goto('./')

  await expect(hero(page)).toHaveText('$0.00')
  await expect(page.getByText('Your turns today will show here.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()
  await expect(stat(page, 'Turns')).toHaveText('0')
})

test('a turn shows its earned money and its row', async ({ page }) => {
  await fixClock(page)
  await addTurn(page, { amount: '100', cash: '10', card: '15' })

  await expect(hero(page)).toHaveText('$85.00')
  await expect(stat(page, 'Turns')).toHaveText('1')
  await expect(stat(page, 'Tips')).toHaveText('$25')
  await expect(turnRow(page, 1)).toBeVisible()
})

test('two turns add up', async ({ page }) => {
  await fixClock(page)
  await addTurn(page, { amount: '40' })
  await addTurn(page, { service: 'Pedicure', amount: '50' })

  await expect(turnRow(page, 2)).toBeVisible()
  await expect(hero(page)).toHaveText('$54.00')
  await expect(stat(page, 'Turns')).toHaveText('2')
})

test('a saved turn survives a reload', async ({ page }) => {
  await fixClock(page)
  await addTurn(page, { amount: '45' })
  await page.reload()

  await expect(turnRow(page, 1)).toBeVisible()
})

test('today’s hero moves from $0 to $37 after a $45 pedicure with a $10 tip', async ({ page }) => {
  await fixClock(page)
  await page.goto('./')
  await expect(hero(page)).toHaveText('$0.00')

  await addTurn(page, { service: 'Pedicure', amount: '45', cash: '10' })

  await expect(hero(page)).toHaveText('$37.00')
})

test('this week compares with the same point last week', async ({ page }) => {
  await fixClock(page)
  await addEarnedOn(page, '2026-11-02', '640')
  await addEarnedOn(page, '2026-10-27', '498')

  await page.goto('./')
  await page.getByRole('button', { name: 'This week', exact: true }).click()

  await expect(hero(page)).toHaveText('$640.00')
  await expect(page.getByText('▲ $142 more than this time last week')).toBeVisible()
})

test('with no turns last week there is nothing to compare yet', async ({ page }) => {
  await fixClock(page)
  await addTurn(page, { amount: '45' })

  await expect(page.getByText('Nothing to compare yet')).toBeVisible()
})

test('the week shows seven bottles and Wednesday opens History on that day', async ({ page }) => {
  await fixClock(page)
  await addTurn(page, { amount: '45', cash: '10' })

  await expect(page.getByTestId('week-bottle')).toHaveCount(7)
  const wednesday = page.getByRole('link', { name: /^Wednesday, \$\d+ earned$/ })
  await expect(wednesday).toBeVisible()

  await wednesday.click()

  await expect(page).toHaveURL(/day=2026-11-04.*#\/history/)
  await expect(page.getByRole('heading', { name: 'Wednesday, November 4' })).toBeVisible()
})

test('the page rolls over to the new day at midnight', async ({ page }) => {
  // 23:59:30 in the browser's America/Chicago timezone.
  await page.clock.install({ time: new Date('2026-11-04T23:59:30-06:00') })
  await seedSettings(page)
  await addTurn(page, { amount: '45' })

  await page.clock.runFor('01:00')

  await expect(page.getByText(/Thursday, November 5/)).toBeVisible()
  await expect(hero(page)).toHaveText('$0.00')
})

for (const size of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
]) {
  test(`the Add turn button is visible without scrolling at ${size.width} × ${size.height}`, async ({
    page,
  }) => {
    await fixClock(page)
    await page.setViewportSize(size)
    await page.goto('./')

    await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeInViewport()
  })
}
