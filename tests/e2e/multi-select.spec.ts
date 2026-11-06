import { expect, test } from '@playwright/test'
import { rowAmount, seedSettings, selectServices, servicePicker } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
})

test('three picked services become one turn with the right totals', async ({ page }) => {
  await page.goto('./#/add')
  const lines = page.getByTestId('service-line')

  await selectServices(page, ['Manicure', 'Pedicure', 'Gel-X'])
  await expect(lines).toHaveCount(3)
  await lines.nth(0).getByLabel('Service amount').fill('40')
  await lines.nth(1).getByLabel('Service amount').fill('50')
  await lines.nth(2).getByLabel('Service amount').fill('15')
  await page.getByLabel('Card tip').fill('15')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('$105.00 Service revenue', { exact: true })).toBeVisible()
  await expect(rowAmount(page, 'Commission')).toHaveText('$63.00')
  await expect(rowAmount(page, 'Total earned')).toHaveText('$78.00')

  await page.getByRole('link', { name: /Turn #1/ }).click()
  await expect(page.getByTestId('service-line')).toHaveCount(3)
})

test('untapping a service chip removes its line', async ({ page }) => {
  await page.goto('./#/add')
  const lines = page.getByTestId('service-line')

  await selectServices(page, ['Manicure', 'Pedicure'])
  await expect(lines).toHaveCount(2)

  const pedicure = servicePicker(page).getByRole('button', { name: 'Pedicure', exact: true })
  await pedicure.click()

  await expect(pedicure).toHaveAttribute('aria-pressed', 'false')
  await expect(lines).toHaveCount(1)
  await expect(lines.first().getByRole('heading', { name: 'Manicure' })).toBeVisible()
})

test('saving with every service removed shows the error and records nothing', async ({ page }) => {
  await page.goto('./#/add')
  await expect(page.getByTestId('service-line')).toHaveCount(1)

  await page.getByRole('button', { name: 'Remove this service' }).click()
  await expect(page.getByTestId('service-line')).toHaveCount(0)

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Pick at least one service.')).toBeVisible()
  await expect(page).toHaveURL(/#\/add$/)

  await page.goto('./')
  await expect(page.getByText('No turns yet')).toBeVisible()
})

test('editing a three-service turn and untapping one saves the smaller total', async ({ page }) => {
  await page.goto('./#/add')
  const lines = page.getByTestId('service-line')

  await selectServices(page, ['Manicure', 'Pedicure', 'Gel-X'])
  await lines.nth(0).getByLabel('Service amount').fill('40')
  await lines.nth(1).getByLabel('Service amount').fill('50')
  await lines.nth(2).getByLabel('Service amount').fill('15')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('$105.00 Service revenue', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: /Turn #1/ }).click()
  await expect(page.getByTestId('service-line')).toHaveCount(3)

  await servicePicker(page).getByRole('button', { name: 'Pedicure', exact: true }).click()
  await expect(page.getByTestId('service-line')).toHaveCount(2)

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Turn #1')).toBeVisible()
  await expect(page.getByText('$55.00 Service revenue', { exact: true })).toBeVisible()
})

test('the picker and its error speak Vietnamese', async ({ page }) => {
  await page.addInitScript(() => {
    const saved = JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}')
    localStorage.setItem('nail-tracker.settings', JSON.stringify({ ...saved, locale: 'vi' }))
  })
  await page.goto('./#/add')

  await expect(page.getByText('Dịch vụ (chọn một hoặc nhiều)')).toBeVisible()
  await page.getByRole('button', { name: 'Bỏ dịch vụ này' }).click()
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()

  await expect(page.getByText('Chọn ít nhất một dịch vụ.')).toBeVisible()
})
