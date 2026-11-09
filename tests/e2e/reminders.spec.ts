import { expect, test, type Page } from '@playwright/test'
import {
  addTurn,
  formSave,
  seedSettings,
} from './helpers.ts'

// 3pm on Wednesday 2026-11-18 in the browser's America/Chicago timezone. The
// offset is explicit so a machine running in UTC cannot move the fixed day.
const NOW = new Date('2026-11-18T15:00:00-06:00')

const fixClock = (page: Page) => page.clock.setFixedTime(NOW)

const noBackupCard = "You have no backup yet. Save one in case you lose your phone."

/** Saves one turn on a chosen past day through the form's date pill. */
async function addTurnOn(page: Page, date: string): Promise<void> {
  await page.goto('./#/add')
  await page.getByLabel('Work date').fill(date)
  await page.getByLabel('Service amount').fill('100')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await seedSettings(page)
})

test('a turn 15 days ago with no backup shows the backup card', async ({ page }) => {
  await fixClock(page)
  await addTurnOn(page, '2026-11-03')
  await page.goto('./')

  await expect(page.getByText(noBackupCard)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back up now' })).toBeVisible()
})

test('Back up now downloads a backup, clears the card and records the date', async ({ page }) => {
  await fixClock(page)
  await addTurnOn(page, '2026-11-03')
  await page.goto('./')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Back up now' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('nail-tracker-backup-2026-11-18.json')

  await expect(page.getByText(noBackupCard)).toHaveCount(0)

  await page.goto('./#/settings')
  await expect(page.getByText('Last backup: Nov 18')).toBeVisible()
  await expect(page.getByLabel('Remind me to back up')).toHaveValue('14')
})

test('dismissing the card keeps it gone after a reload', async ({ page }) => {
  await fixClock(page)
  await addTurnOn(page, '2026-11-03')
  await page.goto('./')

  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByText(noBackupCard)).toHaveCount(0)

  await page.reload()
  await expect(page.getByText(noBackupCard)).toHaveCount(0)
})

test('an old backup says how many days it has been', async ({ page }) => {
  await fixClock(page)
  await page.addInitScript(() => {
    const saved = JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}')
    localStorage.setItem(
      'nail-tracker.settings',
      JSON.stringify({ ...saved, lastBackupDate: '2026-11-01' }),
    )
  })
  await addTurn(page, { amount: '100' })
  await page.goto('./')

  await expect(page.getByText("It's been 17 days since your last backup.")).toBeVisible()
})
