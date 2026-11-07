import { expect, test } from '@playwright/test'
import { addTurn, formSave, openCommission, seedSettings, turnRow } from './helpers.ts'

test('editing a turn saves the change and updates Today', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '100', cash: '10' })

  await turnRow(page, 1).click()
  await expect(page.getByRole('heading', { name: 'Edit Turn' })).toBeVisible()

  await page.getByLabel('Service amount').fill('200')
  await formSave(page).click()

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

  await turnRow(page, 1).click()
  await openCommission(page)
  await expect(page.getByLabel('Commission %')).toHaveValue('60')

  await formSave(page).click()
  await expect(page.getByText('$60.00').first()).toBeVisible()
})

test('undo after a delete brings the turn back', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '100' })

  await turnRow(page, 1).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  // Deleting closes the screen at once and offers Undo instead of a dialog.
  await expect(page.getByRole('status').filter({ hasText: 'Turn deleted' })).toBeVisible()
  await expect(page.getByText('Your turns today will show here.')).toBeVisible()

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(turnRow(page, 1)).toBeVisible()
  await expect(page.getByTestId('hero-earned')).toHaveText('$60.00')
})

test('deleting removes the turn at once', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '100' })

  await turnRow(page, 1).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByText('Your turns today will show here.')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Turn deleted' })).toBeVisible()
})

test('an unknown turn shows that it no longer exists', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/edit/nope')

  await expect(page.getByText('This entry no longer exists.')).toBeVisible()
})
