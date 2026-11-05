import { expect, test } from '@playwright/test'
import { addTurn, seedSettings } from './helpers.ts'

test('editing a turn saves the change and updates Today', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '100', cash: '10' })

  await page.getByRole('link', { name: /Turn #1/ }).click()
  await expect(page.getByRole('heading', { name: 'Edit Turn' })).toBeVisible()

  await page.getByLabel('Service amount').fill('200')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('$130.00').first()).toBeVisible()
})

test('a saved turn keeps the rate it was recorded with', async ({ page }) => {
  await seedSettings(page, { defaultCommissionRateBp: 6000 })
  await addTurn(page, { amount: '100' })

  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('nail-tracker.settings')!)
    s.defaultCommissionRateBp = 5000
    localStorage.setItem('nail-tracker.settings', JSON.stringify(s))
  })
  await page.reload()

  await page.getByRole('link', { name: /Turn #1/ }).click()
  await expect(page.getByLabel('Commission %')).toHaveValue('60')

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('$60.00').first()).toBeVisible()
})

test('cancelling the delete keeps the turn', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '100' })

  await page.getByRole('link', { name: /Turn #1/ }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByRole('heading', { name: 'Edit Turn' })).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByLabel('Service amount')).toHaveValue('100.00')
})

test('confirming the delete removes the turn', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '100' })

  await page.getByRole('link', { name: /Turn #1/ }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByText('No turns yet')).toBeVisible()
})

test('an unknown turn shows that it no longer exists', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/edit/nope')

  await expect(page.getByText('This entry no longer exists.')).toBeVisible()
})
