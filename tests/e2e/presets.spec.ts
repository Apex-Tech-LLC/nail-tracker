import { expect, test } from '@playwright/test'
import { seedSettings, selectServices, serviceChip } from './helpers.ts'

test('a new service shows on Add Turn and fills its usual price', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings/services')
  await page.getByRole('button', { name: 'Add a service' }).click()
  await page.getByLabel('Name in English').fill('Polish Change')
  await page.getByLabel('Usual price').fill('15')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Edit: Polish Change' })).toBeVisible()
  await page.goto('./#/add')
  await selectServices(page, ['Polish Change'])
  await expect(page.getByLabel('Service amount')).toHaveValue('15.00')
})

test('a quick double tap on Save adds the service once', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings/services')
  await page.getByRole('button', { name: 'Add a service' }).click()
  await page.getByLabel('Name in English').fill('Polish Change')
  await page.getByRole('button', { name: 'Save', exact: true }).dblclick()

  // Let a second save land before counting, so a duplicate cannot be missed.
  await expect(page.getByRole('button', { name: 'Add a service' })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.getByRole('button', { name: 'Edit: Polish Change' })).toHaveCount(1)
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
  await expect(serviceChip(page, 'Removal')).toHaveCount(0)
})

test('moving a service down puts it first on Add Turn', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings/services')
  await page.getByRole('button', { name: 'Move down: Manicure' }).click()

  await expect(page.getByRole('button', { name: 'Move up: Pedicure' })).toBeDisabled()
  await page.goto('./#/add')
  await expect(
    page.getByTestId('service-line').first().getByRole('heading', { name: 'Pedicure' }),
  ).toBeVisible()
})
