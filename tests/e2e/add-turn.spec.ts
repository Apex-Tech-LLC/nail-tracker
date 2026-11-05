import { expect, test } from '@playwright/test'
import { addTurn, seedSettings } from './helpers.ts'

test('the preview shows commission and earnings before saving', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await page.getByRole('button', { name: 'Gel-X', exact: true }).click()
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
  await page.getByRole('button', { name: 'Other', exact: true }).click()
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
