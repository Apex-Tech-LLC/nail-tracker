import { expect, test } from '@playwright/test'
import { addTurn, seedSettings, selectServices } from './helpers.ts'

test('the preview shows commission and earnings before saving', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await selectServices(page, ['Gel-X'])
  await page.getByLabel('Service amount').fill('100')
  await page.getByLabel('Cash tip').fill('10')
  await page.getByLabel('Card tip').fill('15')

  await expect(page.getByText('$60.00')).toBeVisible()
  await expect(page.getByText('$85.00')).toBeVisible()
})

test('the commission rate starts from settings', async ({ page }) => {
  await seedSettings(page, { defaultCommissionRateBp: 5000 })
  await page.goto('./#/add')

  await expect(page.getByLabel('Commission %')).toHaveValue('50')
})

test('saving with no amount shows an error and stays on the form', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Enter an amount like 45 or 45.50.')).toBeVisible()
  await expect(page).toHaveURL(/#\/add$/)
})

test('an Other service needs a name', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await selectServices(page, ['Other'])
  await page.getByLabel('Service amount').fill('30')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Enter a service name.')).toBeVisible()
})

test('saving a turn returns to Today', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '45' })
})

test('the next visit remembers the last service used', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { service: 'Pedicure', amount: '50' })
  await page.goto('./#/add')

  await expect(page.getByRole('button', { name: 'Pedicure', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('three services add up on one turn', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  const lines = page.getByTestId('service-line')
  await selectServices(page, ['Gel Manicure', 'Pedicure', 'Nail Art / Design'])

  await lines.nth(0).getByLabel('Service amount').fill('40')
  await lines.nth(1).getByLabel('Service amount').fill('50')
  await lines.nth(2).getByLabel('Service amount').fill('15')
  await page.getByLabel('Card tip').fill('15')

  await expect(page.getByText('$105.00')).toBeVisible()
  await expect(page.getByText('$63.00')).toBeVisible()
  await expect(page.getByText('$78.00')).toBeVisible()

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('$78.00').first()).toBeVisible()
  await expect(page.locator('p.text-3xl')).toHaveText('1')
  await expect(page.getByText('Turn #1')).toBeVisible()
})

test('each service can have its own commission rate', async ({ page }) => {
  await seedSettings(page, { perServiceRates: true })
  await page.goto('./#/add')
  const lines = page.getByTestId('service-line')
  await selectServices(page, ['Gel-X', 'Nail Art / Design'])

  await lines.nth(0).getByLabel('Service amount').fill('75')
  await lines.nth(0).getByLabel('Commission %').fill('60')
  await lines.nth(1).getByLabel('Service amount').fill('20')
  await lines.nth(1).getByLabel('Commission %').fill('70')

  await expect(page.getByText('$59.00').first()).toBeVisible()
})

test('a service can be removed', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')

  await page.getByRole('button', { name: 'Add service' }).click()
  await expect(page.getByTestId('service-line')).toHaveCount(2)
  await page.getByRole('button', { name: 'Remove this service' }).first().click()

  await expect(page.getByTestId('service-line')).toHaveCount(1)
})

test('a zero turn count saves the turn without a number', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await page.getByLabel('Service amount').fill('20')
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByLabel('Turn count').fill('0')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('No turn')).toBeVisible()
})

test('a bad turn count shows an error', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByLabel('Turn count').fill('abc')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Enter a whole number from 0 to 99.')).toBeVisible()
})

test('Save & Add Another keeps the form open for the next turn', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await page.getByLabel('Service amount').fill('30')
  await page.getByRole('button', { name: 'Save & Add Another' }).click()

  await expect(page).toHaveURL(/#\/add$/)
  await expect(page.getByText('Saved. Add the next turn.')).toBeVisible()
  await expect(page.getByLabel('Service amount')).toHaveValue('')

  await page.getByLabel('Service amount').fill('40')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Turn #2')).toBeVisible()
})

test('a double tap on Save records the turn once', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await page.getByLabel('Service amount').fill('30')
  await page.getByRole('button', { name: 'Save', exact: true }).dblclick()

  await expect(page.getByText('Turn #1')).toBeVisible()
  await expect(page.getByText('Turn #2')).toHaveCount(0)
})
