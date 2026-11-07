import { expect, test } from '@playwright/test'
import { openCommission } from './helpers.ts'

// Onboarding must be exercised on a clean phone: no seedSettings here.
test.use({ locale: 'en-US' })

test('first launch opens onboarding', async ({ page }) => {
  await page.goto('./')

  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Choose your language' })).toBeVisible()
  await expect(page.getByText('Step 1 of 4')).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('the whole flow lands on Today with its answers saved', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('group', { name: 'Language' }).getByText('English', { exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await page.getByText('50% commission', { exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await page.getByText('Cash tips right away, card tips on payday', { exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await page.getByText('Weekly', { exact: true }).click()
  await page.getByRole('button', { name: 'Start tracking' }).click()

  await expect(page.getByRole('link', { name: 'Add your first turn' })).toBeVisible()

  await page.goto('./#/add')
  await openCommission(page)
  await expect(page.getByLabel('Commission %')).toHaveValue('50')

  await page.goto('./#/payday')
  await expect(page.getByText('Set your payday schedule to see what the salon owes you.')).toHaveCount(0)
})

test('choosing Vietnamese changes the question at once', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('group', { name: 'Language' }).getByText('Tiếng Việt', { exact: true }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Chọn ngôn ngữ' })).toBeVisible()
})

test('skipping every step keeps the defaults', async ({ page }) => {
  await page.goto('./')

  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
  }

  await expect(page.getByRole('link', { name: 'Add your first turn' })).toBeVisible()

  await page.goto('./#/add')
  await openCommission(page)
  await expect(page.getByLabel('Commission %')).toHaveValue('60')
})

test('onboarding shows only once', async ({ page }) => {
  await page.goto('./')

  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
  }
  await expect(page.getByRole('link', { name: 'Add your first turn' })).toBeVisible()

  await page.reload()

  await expect(page).not.toHaveURL(/#\/onboarding/)
  await expect(page.getByRole('link', { name: 'Add your first turn' })).toBeVisible()
})

test('a custom rate that cannot be read stops Next', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByText('Custom commission', { exact: true }).click()
  await page.getByLabel('Custom commission %').fill('abc')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByText('Enter a percent from 0 to 100, like 60 or 62.5.')).toBeVisible()
})

test('all tips on payday unchecks the cash tip box on a new turn', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByText('All tips on payday', { exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Start tracking' }).click()

  await page.goto('./#/add')
  await page.getByRole('button', { name: 'More options' }).click()

  await expect(page.getByLabel('Cash tip already in my hand')).not.toBeChecked()
})

test('step 1 has no Back button', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByText('Step 1 of 4')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
})

test('Back returns to step 2 with the chosen commission still selected', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByText('50% commission', { exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Step 3 of 4')).toBeVisible()

  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await expect(page.getByText('Step 2 of 4')).toBeVisible()
  await expect(page.getByRole('radio', { name: '50% commission' })).toBeChecked()
})

test('Back keeps the typed custom commission rate', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByText('Custom commission', { exact: true }).click()
  await page.getByLabel('Custom commission %').fill('63.5')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await expect(page.getByLabel('Custom commission %')).toHaveValue('63.5')
})

test('Back from step 4 reaches step 3 and the flow still finishes on Today', async ({ page }) => {
  await page.goto('./')

  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Next', exact: true }).click()
  }
  await expect(page.getByText('Step 4 of 4')).toBeVisible()

  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await expect(page.getByText('Step 3 of 4')).toBeVisible()

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Start tracking' }).click()

  await expect(page.getByRole('link', { name: 'Add your first turn' })).toBeVisible()
})

test('the Back button reads Quay lại in Vietnamese', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('group', { name: 'Language' }).getByText('Tiếng Việt', { exact: true }).click()
  await page.getByRole('button', { name: 'Tiếp', exact: true }).click()

  await expect(page.getByText('Bước 2/4')).toBeVisible()
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Chọn ngôn ngữ' })).toBeVisible()
  await expect(page.getByText('Bước 1/4')).toBeVisible()
})
