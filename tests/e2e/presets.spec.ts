import { expect, test } from '@playwright/test'
import { seedSettings } from './helpers.ts'

test('a new service shows on Add Turn and fills its usual price', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings/services')
  await page.getByRole('button', { name: 'Add a service' }).click()
  await page.getByLabel('Name in English').fill('Polish Change')
  await page.getByLabel('Usual price').fill('15')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Edit: Polish Change' })).toBeVisible()
  await page.goto('./#/add')
  await page.getByRole('button', { name: 'Polish Change', exact: true }).click()
  await expect(page.getByLabel('Service amount')).toHaveValue('15.00')
})

test('a service needs at least one name', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings/services')
  await page.getByRole('button', { name: 'Add a service' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Enter a service name.')).toBeVisible()
})

test('a removed service disappears from Add Turn', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings/services')
  await page.getByRole('button', { name: 'Edit: Removal' }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Edit: Removal' })).toHaveCount(0)
  await page.goto('./#/add')
  await expect(page.getByRole('button', { name: 'Removal', exact: true })).toHaveCount(0)
})

test('moving a service down puts it first on Add Turn', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings/services')
  await page.getByRole('button', { name: 'Move down: Manicure' }).click()

  await expect(page.getByRole('button', { name: 'Move up: Pedicure' })).toBeDisabled()
  await page.goto('./#/add')
  await expect(page.getByTestId('service-line').first().locator('button').first()).toHaveText(
    'Pedicure',
  )
})
