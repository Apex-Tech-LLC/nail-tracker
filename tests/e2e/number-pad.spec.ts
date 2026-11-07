import { expect, test, type Page } from '@playwright/test'
import {
  datePill,
  formSave,
  openDateChoices,
  seedSettings,
  selectServices,
  turnRow,
} from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')
const MORNING = new Date('2026-11-04T09:00:00-06:00')
const MID_MORNING = new Date('2026-11-04T10:00:00-06:00')

function pad(page: Page) {
  return page.getByTestId('number-pad')
}

/** Saves one turn at a fixed time, so later ones have a usual price to fill. */
async function saveTurnAt(
  page: Page,
  at: Date,
  service: string,
  amount: string,
): Promise<void> {
  await page.clock.setFixedTime(at)
  await page.goto('./#/add')
  await selectServices(page, [service])
  await page.getByLabel('Service amount').fill(amount)
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

test('focusing the service amount shows the pad and its keys type', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')

  await expect(pad(page)).toBeVisible()
  await pad(page).getByRole('button', { name: '3', exact: true }).click()
  await pad(page).getByRole('button', { name: '5', exact: true }).click()
  await expect(page.getByLabel('Service amount')).toHaveValue('35')

  await pad(page).getByRole('button', { name: 'Delete last digit' }).click()
  await expect(page.getByLabel('Service amount')).toHaveValue('3')
})

test('the pad allows cents but refuses a third decimal digit', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')

  await pad(page).getByRole('button', { name: '3', exact: true }).click()
  await pad(page).getByRole('button', { name: 'Decimal point' }).click()
  await pad(page).getByRole('button', { name: '5', exact: true }).click()
  await pad(page).getByRole('button', { name: '0', exact: true }).click()
  await pad(page).getByRole('button', { name: '0', exact: true }).click()

  await expect(page.getByLabel('Service amount')).toHaveValue('3.50')
})

test('Next moves to the cash tip and the pad Save saves the turn', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await page.goto('./#/add')

  await pad(page).getByRole('button', { name: '3', exact: true }).click()
  await pad(page).getByRole('button', { name: '5', exact: true }).click()
  await pad(page).getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByLabel('Cash tip')).toBeFocused()
  await expect(pad(page)).toBeVisible()

  await pad(page).getByRole('button', { name: 'Save', exact: true }).click()
  await expect(turnRow(page, 1)).toBeVisible()
  await expect(page).toHaveURL(/#\/$/)
})

test('the amount box asks for no phone keyboard only while the setting is on', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await expect(page.getByLabel('Service amount')).toHaveAttribute('inputmode', 'none')

  await page.goto('./#/settings')
  await page.getByLabel("Use the app's number pad").uncheck()

  await page.goto('./#/add')
  await expect(page.getByLabel('Service amount')).toHaveAttribute('inputmode', 'decimal')
})

test('the date pill opens the day choices and Yesterday saves on that day', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await page.goto('./#/add')

  await expect(datePill(page)).toContainText('Today')

  await openDateChoices(page)
  await page.getByRole('button', { name: 'Yesterday', exact: true }).click()
  await expect(datePill(page)).toContainText('Yesterday')

  await page.getByLabel('Service amount').fill('35')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Yesterday', exact: true }).click()
  await expect(turnRow(page, 1)).toBeVisible()
})

test('the first key after tapping a filled price box replaces its value', async ({ page }) => {
  await seedSettings(page)
  // Two earlier turns give Manicure a usual price of $35 and leave Pedicure
  // picked, so tapping the Manicure chip fills a brand new box with $35.00.
  await saveTurnAt(page, MORNING, 'Manicure', '35')
  await saveTurnAt(page, MID_MORNING, 'Pedicure', '50')

  await page.clock.setFixedTime(NOON)
  await page.goto('./#/add')
  await selectServices(page, ['Manicure'])

  const amount = page.getByLabel('Service amount')
  await expect(amount).toHaveValue('35.00')

  await amount.click()
  await pad(page).getByRole('button', { name: '4', exact: true }).click()
  await pad(page).getByRole('button', { name: '0', exact: true }).click()
  await expect(amount).toHaveValue('40')

  await formSave(page).click()
  await expect(turnRow(page, 3)).toBeVisible()

  await turnRow(page, 3).click()
  await expect(page.getByLabel('Service amount')).toHaveValue('40.00')
})
