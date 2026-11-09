import { expect, test } from '@playwright/test'
import { openCommission, skipOnboarding } from './helpers.ts'

// Onboarding must be exercised on a clean phone: no seedSettings here.
test.use({ locale: 'en-US' })

test('first launch opens setup on one screen with all four choices and no Next', async ({ page }) => {
  await page.goto('./')

  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1, name: 'Quick setup' })).toBeAttached()
  for (const group of ['Language', 'Default commission', 'Total tips', 'Payday schedule']) {
    await expect(page.getByRole('group', { name: group })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: group })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start tracking' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('the whole flow lands on Today with its answers saved', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('group', { name: 'Language' }).getByText('English', { exact: true }).click()
  await page.getByText('50% commission', { exact: true }).click()
  await page.getByText('Cash tips right away, card tips on payday', { exact: true }).click()
  await page.getByText('Weekly', { exact: true }).click()
  await page.getByRole('button', { name: 'Start tracking' }).click()

  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()

  await page.goto('./#/add')
  await openCommission(page)
  await expect(page.getByLabel('Commission %')).toHaveValue('50')

  await page.goto('./#/payday')
  await expect(page.getByText('Set your payday schedule to see what the salon owes you.')).toHaveCount(0)
})

test('choosing Vietnamese changes the screen at once', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('group', { name: 'Language' }).getByText('Tiếng Việt', { exact: true }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt nhanh' })).toBeAttached()
  await expect(page.getByRole('group', { name: 'Tỷ lệ chia mặc định' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bắt đầu', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bỏ qua', exact: true })).toBeVisible()
})

test('one Skip keeps the defaults', async ({ page }) => {
  await page.goto('./')

  await skipOnboarding(page)

  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()

  await page.goto('./#/add')
  await openCommission(page)
  await expect(page.getByLabel('Commission %')).toHaveValue('60')
})

test('onboarding shows only once', async ({ page }) => {
  await page.goto('./')

  await skipOnboarding(page)
  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()

  await page.reload()

  await expect(page).not.toHaveURL(/#\/onboarding/)
  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()
})

test('a custom rate that cannot be read stops Start tracking', async ({ page }) => {
  await page.goto('./')

  await page.getByText('Custom commission', { exact: true }).click()
  await page.getByLabel('Custom commission %').fill('abc')
  await page.getByRole('button', { name: 'Start tracking' }).click()

  await expect(page.getByText('Enter a percent from 0 to 100, like 60 or 62.5.')).toBeVisible()
  await expect(page).toHaveURL(/#\/onboarding$/)

  await page.getByLabel('Custom commission %').fill('63.5')
  await page.getByRole('button', { name: 'Start tracking' }).click()

  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()
  await page.goto('./#/add')
  await openCommission(page)
  await expect(page.getByLabel('Commission %')).toHaveValue('63.5')
})

test('all tips on payday unchecks the cash tip box on a new turn', async ({ page }) => {
  await page.goto('./')

  await page.getByText('All tips on payday', { exact: true }).click()
  await page.getByRole('button', { name: 'Start tracking' }).click()

  await page.goto('./#/add')
  await page.getByRole('button', { name: 'More options' }).click()

  await expect(page.getByLabel('Cash tip already in my hand')).not.toBeChecked()
})

test('custom tips shows a hint to use Settings instead of the tip fields', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('group', { name: 'Total tips' }).getByText('Custom', { exact: true }).click()

  await expect(page.getByText('You can set this in Settings.')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Cash tips' })).toHaveCount(0)
})

test('the screen has no Back button and no step counter', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByText(/Step \d of 4/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
})
