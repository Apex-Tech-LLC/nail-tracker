import { expect, test, type Locator, type Page } from '@playwright/test'
import { addTurn, formSave, openCommission, openDateChoices, seedSettings } from './helpers.ts'

// 3pm on Wednesday 2026-11-04 in the browser's America/Chicago timezone. The
// offset is explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T15:00:00-06:00')

const pad = (page: Page) => page.getByTestId('number-pad')
const status = (page: Page) => page.locator('p[role=status]')
const fileInput = (page: Page) => page.locator('input[type=file]')
const goalsRow = (page: Page): Locator => page.getByRole('link', { name: /Goals/ })

async function typeOnPad(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    await pad(page).getByRole('button', { name: key, exact: true }).click()
  }
}

/** Saves one turn on a chosen day with a 100% rate, so earned equals the amount. */
async function addEarnedOn(page: Page, date: string, amount: string): Promise<void> {
  await page.goto('./#/add')
  await openDateChoices(page)
  await page.getByRole('button', { name: 'Other day' }).click()
  await page.getByLabel('Work date').fill(date)
  await page.getByLabel('Service amount').fill(amount)
  await openCommission(page)
  await page.getByLabel('Commission %').fill('100')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()
}

async function saveBackup(page: Page, path: string): Promise<void> {
  await page.goto('./#/settings')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save backup file' }).click(),
  ])
  await download.saveAs(path)
}

/** Wipes every record and setting, then skips the first-launch questions. */
async function deleteAll(page: Page): Promise<void> {
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Delete all data', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Type the word here').fill('DELETE')
  await dialog.getByRole('button', { name: 'Delete all data' }).click()
  await expect(page).toHaveURL(/#\/onboarding/)
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
  }
}

test('a goal set on the Goals sheet shows in Settings and survives a reload', async ({
  page,
}) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/settings')

  const goals = goalsRow(page)
  await expect(goals).toContainText('Not set')
  await goals.click()
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

test('Home shows how close the week is to a $1,000 goal', async ({ page }) => {
  await seedSettings(page, { weeklyGoalCents: 100_000 })
  await page.clock.setFixedTime(NOON)
  await addEarnedOn(page, '2026-11-02', '640')

  await page.goto('./')
  // Today has no goal bar of its own.
  await expect(page.getByTestId('goal-progress')).toHaveCount(0)

  await page.getByRole('button', { name: 'This week', exact: true }).click()
  await expect(page.getByTestId('goal-progress-text')).toHaveText(
    '$640 of $1,000 · $360 to go',
  )
  await expect(page.getByTestId('goal-progress')).toHaveAttribute('data-fill', '64')

  // A month with no monthly goal only offers to set one.
  await page.getByRole('button', { name: 'This month', exact: true }).click()
  await expect(page.getByTestId('goal-progress')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Set a goal' })).toBeVisible()
})

test('passing the goal shows the message once and keeps the bar full', async ({ page }) => {
  await seedSettings(page, { weeklyGoalCents: 100_000 })
  await page.clock.setFixedTime(NOON)
  await addEarnedOn(page, '2026-11-02', '640')
  await addEarnedOn(page, '2026-11-03', '500')

  await page.goto('./')
  await page.getByRole('button', { name: 'This week', exact: true }).click()

  await expect(page.getByTestId('goal-progress-text')).toHaveText('$1,140 of $1,000')
  await expect(page.getByTestId('goal-progress')).toHaveAttribute('data-fill', '100')
  await expect(page.getByText('You hit your goal for this week.')).toBeVisible()

  await page.goto('./#/history')
  await page.goto('./')
  await page.getByRole('button', { name: 'This week', exact: true }).click()

  await expect(page.getByTestId('goal-progress-text')).toHaveText('$1,140 of $1,000')
  await expect(page.getByText('You hit your goal for this week.')).toHaveCount(0)
})

test('Reports draws the weekly goal line and other modes draw none', async ({ page }) => {
  await seedSettings(page, { weeklyGoalCents: 100_000 })
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })

  await page.goto('./#/earnings')
  await expect(page.getByTestId('goal-line')).toContainText('Goal $1,000')

  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page.getByTestId('goal-line')).toHaveCount(0)

  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await expect(page.getByTestId('goal-line')).toHaveCount(0)
})

test('a goal survives a reload and a backup round trip', async ({ page }, testInfo) => {
  await seedSettings(page, { weeklyGoalCents: 100_000 })
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/settings')
  await expect(goalsRow(page)).toContainText('$1,000 a week')

  await page.reload()
  await expect(goalsRow(page)).toContainText('$1,000 a week')

  const file = testInfo.outputPath('goals-backup.json')
  await saveBackup(page, file)
  await deleteAll(page)
  await page.goto('./#/settings')
  await expect(goalsRow(page)).toContainText('Not set')

  await fileInput(page).setInputFiles(file)
  await expect(status(page)).toContainText('Restore finished')
  await expect(goalsRow(page)).toContainText('$1,000 a week')
})
