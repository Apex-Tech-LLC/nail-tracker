import { expect, test, type Page } from '@playwright/test'
import { seedSettings } from './helpers.ts'

// 3pm on Wednesday 2026-11-04 in the browser's America/Chicago timezone. The
// offset is explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T15:00:00-06:00')

const pad = (page: Page) => page.getByTestId('number-pad')

async function typeOnPad(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    await pad(page).getByRole('button', { name: key, exact: true }).click()
  }
}

test('a goal set on the Goals sheet shows in Settings and survives a reload', async ({
  page,
}) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/settings')

  const goalsRow = page.getByRole('link', { name: /Goals/ })
  await expect(goalsRow).toContainText('Not set')
  await goalsRow.click()
  await expect(page.getByRole('heading', { name: 'Goals', exact: true })).toBeVisible()

  await page.getByLabel('Weekly goal').click()
  await typeOnPad(page, ['1', '0', '0', '0'])
  await pad(page).getByRole('button', { name: 'Next', exact: true }).click()
  await typeOnPad(page, ['4', '0', '0', '0'])
  await pad(page).getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Goals/ })).toContainText(
    '$1,000 a week · $4,000 a month',
  )

  await page.reload()
  await expect(page.getByRole('link', { name: /Goals/ })).toContainText(
    '$1,000 a week · $4,000 a month',
  )
})
