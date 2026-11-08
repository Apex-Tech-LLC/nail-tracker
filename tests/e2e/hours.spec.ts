import { expect, test, type Page } from '@playwright/test'
import { addTurn, seedSettings } from './helpers.ts'

// Times carry an explicit offset so GitHub's UTC clock cannot move the day.
function moment(time: string): Date {
  return new Date(`2026-11-04T${time}:00-06:00`)
}

/** Turns hours tracking on from Settings, and types a minimum wage when given. */
async function enableHours(page: Page, minimum?: string): Promise<void> {
  await page.goto('./#/settings')
  await page.getByLabel('Track my hours').check()
  if (minimum !== undefined) {
    await page.getByLabel('Minimum wage where I work').fill(minimum)
  }
}

test('hours stay hidden everywhere while tracking is off', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(moment('12:00'))
  await addTurn(page, { amount: '100' })

  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Start day' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'End day' })).toHaveCount(0)

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Actions for Wednesday, November 4' }).click()
  await expect(page.getByRole('button', { name: 'Add hours' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.goto('./#/earnings')
  await expect(page.getByRole('heading', { name: 'Per hour' })).toHaveCount(0)
  await expect(page.getByTestId('report-stat-hours')).toHaveCount(0)
})

test('Start day and End day record today and Reports shows pay per hour', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(moment('09:00'))
  await enableHours(page)
  // $200.00 commission plus a $40.00 tip: $240.00 earned over 8 hours.
  await addTurn(page, { amount: '333.33', cash: '40' })

  await page.goto('./')
  await page.getByRole('button', { name: 'Start day' }).click()
  await page.clock.setFixedTime(moment('17:00'))
  await page.getByRole('button', { name: 'End day' }).click()

  await expect(page.getByText('8 h', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()

  await page.goto('./#/earnings')
  await expect(page.getByTestId('report-stat-hours')).toHaveText('8 h')
  const perHour = page.getByRole('heading', { name: 'Per hour' }).locator('..')
  await expect(perHour.getByText('With tips', { exact: true })).toBeVisible()
  await expect(perHour.getByText('$30.00', { exact: true })).toBeVisible()
  await expect(perHour.getByText('Salon pay, without tips', { exact: true })).toBeVisible()
  await expect(perHour.getByText('$25.00', { exact: true })).toBeVisible()
})

test('History fills in the suggestion and saves only when Save is tapped', async ({ page }) => {
  await seedSettings(page)
  await enableHours(page)
  await page.clock.setFixedTime(moment('10:05'))
  await addTurn(page, { amount: '100' })
  await page.clock.setFixedTime(moment('18:40'))
  await addTurn(page, { service: 'Pedicure', amount: '50' })

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Actions for Wednesday, November 4' }).click()
  await page.getByRole('button', { name: 'Add hours', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByText(
      'First turn 10:05 AM, last turn 6:40 PM. Use 9:45 AM to 7:00 PM?',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(dialog.getByLabel('Start', { exact: true })).toHaveValue('09:45')
  await expect(dialog.getByLabel('End', { exact: true })).toHaveValue('19:00')

  await dialog.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(
    page.getByText('Hours 9:45 AM – 7:00 PM · 9 h 15 min', { exact: true }),
  ).toBeVisible()
})

test('a week below the minimum wage shows the calm note', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(moment('09:00'))
  await enableHours(page, '16.50')
  // $78.40 commission over 8 hours is $9.80 an hour.
  await addTurn(page, { amount: '130.67' })

  await page.goto('./')
  await page.getByRole('button', { name: 'Start day' }).click()
  await page.clock.setFixedTime(moment('17:00'))
  await page.getByRole('button', { name: 'End day' }).click()

  await page.goto('./#/earnings')
  await expect(
    page.getByText(
      'Your salon pay this week was $9.80 an hour, below the $16.50 you entered. You can ask your state labor office about this.',
      { exact: true },
    ),
  ).toBeVisible()
})

test('hours survive a reload and a backup round trip', async ({ page }, testInfo) => {
  await seedSettings(page)
  await page.clock.setFixedTime(moment('09:00'))
  await enableHours(page)

  await page.goto('./')
  await page.getByRole('button', { name: 'Start day' }).click()
  await page.clock.setFixedTime(moment('17:00'))
  await page.getByRole('button', { name: 'End day' }).click()
  await expect(page.getByText('8 h', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByText('8 h', { exact: true })).toBeVisible()

  const file = testInfo.outputPath('hours.json')
  await page.goto('./#/settings')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save backup file' }).click(),
  ])
  await download.saveAs(file)

  await page.getByRole('button', { name: 'Delete all data', exact: true }).click()
  const confirm = page.getByRole('dialog')
  await confirm.getByLabel('Type the word here').fill('DELETE')
  await confirm.getByRole('button', { name: 'Delete all data' }).click()
  await expect(page).toHaveURL(/#\/onboarding/)
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
  }

  await page.goto('./#/settings')
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.locator('p[role=status]')).toContainText('Restore finished')

  await page.goto('./')
  await expect(page.getByText('8 h', { exact: true })).toBeVisible()
})
