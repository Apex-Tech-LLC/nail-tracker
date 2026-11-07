import { expect, test } from '@playwright/test'
import { seedSettings } from './helpers.ts'

test('all five tabs open, and the language choice survives a reload', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./')
  const nav = page.getByRole('navigation')
  for (const [tab, heading] of [
    ['History', 'History'],
    ['Earnings', 'Earnings'],
    ['Payday', 'Payday'],
    ['Settings', 'Settings'],
    ['Home', 'Nail Tracker'],
  ]) {
    await nav.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  await page.getByRole('button', { name: /Switch to Vietnamese/ }).click()
  await expect(nav.getByRole('link', { name: 'Lịch sử' })).toBeVisible()
  await page.reload()
  await expect(nav.getByRole('link', { name: 'Lịch sử' })).toBeVisible()
})
