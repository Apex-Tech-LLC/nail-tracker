import { expect, test, type Locator, type Page } from '@playwright/test'
import { addTurn, seedSettings } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone.
const NOON = new Date('2026-11-04T12:00:00')

async function openSettings(page: Page): Promise<void> {
  await page.goto('./#/settings')
}

function settingsGroup(page: Page, name: string): Locator {
  return page.getByRole('group', { name })
}

/**
 * The Today figure whose label is exactly `label`. Scoping by the label keeps a
 * matching dollar amount elsewhere on the page from passing the check.
 */
function todayFigure(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator('..').locator('span').last()
}

test('the language choice survives a reload', async ({ page }) => {
  await seedSettings(page)
  await openSettings(page)

  await settingsGroup(page, 'Language').getByText('Tiếng Việt', { exact: true }).click()
  await page.reload()

  await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Hôm nay' })).toBeVisible()
})

test('50% becomes the default commission', async ({ page }) => {
  await seedSettings(page)
  await openSettings(page)

  await settingsGroup(page, 'Default commission').getByText('50%', { exact: true }).click()
  await page.goto('./#/add')

  await expect(page.getByLabel('Commission %')).toHaveValue('50')
})

test('a custom commission rate becomes the default', async ({ page }) => {
  await seedSettings(page)
  await openSettings(page)

  await settingsGroup(page, 'Default commission').getByText('Custom', { exact: true }).click()
  await page.getByLabel('Custom commission %').fill('62.5')
  await page.goto('./#/add')

  await expect(page.getByLabel('Commission %')).toHaveValue('62.5')
})

test('a custom commission rate that cannot be read is refused', async ({ page }) => {
  await seedSettings(page)
  await openSettings(page)

  await settingsGroup(page, 'Default commission').getByText('Custom', { exact: true }).click()
  await page.getByLabel('Custom commission %').fill('abc')

  await expect(
    page.getByText('Enter a percent from 0 to 100, like 60 or 62.5.'),
  ).toBeVisible()
})

test('changing the default leaves saved turns alone', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '100' })
  await openSettings(page)

  await settingsGroup(page, 'Default commission').getByText('50%', { exact: true }).click()
  await page.goto('./')

  await expect(todayFigure(page, 'Commission')).toHaveText('$60.00')
})

test('the week start changes the earnings range', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await openSettings(page)

  await settingsGroup(page, 'Week starts on').getByText('Monday', { exact: true }).click()
  await page.goto('./#/earnings')

  await expect(page.getByText('Nov 2 – Nov 8')).toBeVisible()
})

test('choosing a weekly schedule gives payday a period', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await openSettings(page)

  await settingsGroup(page, 'Payday schedule').getByText('Weekly', { exact: true }).click()
  await page.goto('./#/payday')

  await expect(
    page.getByText('Set your payday schedule to see what the salon owes you.'),
  ).toHaveCount(0)
  await expect(page.getByText('Nov 1 – Nov 7')).toBeVisible()
})

test('the anchor date sets where pay periods start', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await openSettings(page)

  await settingsGroup(page, 'Payday schedule').getByText('Weekly', { exact: true }).click()
  await page.getByLabel('First day of a pay period').fill('2026-11-03')
  await page.goto('./#/payday')

  await expect(page.getByText('Nov 3 – Nov 9')).toBeVisible()
})

test('cash tips paid on payday start unchecked on a new turn', async ({ page }) => {
  await seedSettings(page)
  await openSettings(page)

  await settingsGroup(page, 'Cash tips')
    .getByText('The salon pays them on payday', { exact: true })
    .click()
  await page.goto('./#/add')
  await page.getByRole('button', { name: 'More options' }).click()

  await expect(page.getByLabel('Cash tip already in my hand')).not.toBeChecked()
})

test('per-service rates move the rate box into each service line', async ({ page }) => {
  await seedSettings(page)
  await openSettings(page)

  await page.getByLabel('Different commission for each service').check()
  await page.goto('./#/add')

  await expect(page.getByTestId('service-line').getByLabel('Commission %')).toBeVisible()
  await expect(page.getByLabel('Commission %')).toHaveCount(1)
})
