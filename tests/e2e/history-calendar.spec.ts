import { expect, test, type Page } from '@playwright/test'
import { addTurn, seedSettings, turnRow } from './helpers.ts'

/** Records a turn on the day locked in the browser clock, with an explicit offset. */
async function addTurnOn(
  page: Page,
  moment: Date,
  options: Parameters<typeof addTurn>[1],
): Promise<void> {
  await page.clock.setFixedTime(moment)
  await addTurn(page, options)
}

test('November shows each worked day’s earned total and a tap opens the day', async ({ page }) => {
  await seedSettings(page)
  await addTurnOn(page, new Date('2026-11-02T12:00:00-06:00'), { amount: '100' })
  await addTurnOn(page, new Date('2026-11-04T12:00:00-06:00'), { amount: '200' })
  await addTurnOn(page, new Date('2026-11-06T12:00:00-06:00'), { amount: '500' })
  await page.goto('./#/history')

  await page.getByRole('button', { name: 'Calendar', exact: true }).click()

  await expect(page.getByRole('button', { name: /^Monday, November 2 · / })).toContainText('$60')
  await expect(page.getByRole('button', { name: /^Wednesday, November 4 · / })).toContainText(
    '$120',
  )
  await expect(page.getByRole('button', { name: /^Friday, November 6 · / })).toContainText('$300')

  await page.getByRole('button', { name: /^Wednesday, November 4 · / }).click()

  await expect(page.getByRole('heading', { name: 'Wednesday, November 4' })).toBeVisible()
  await expect(turnRow(page, 1)).toBeVisible()
  await expect(page).toHaveURL(/day=2026-11-04/)
})

test('a day off shows on the calendar, survives a reload and a backup', async ({
  page,
}, testInfo) => {
  await seedSettings(page)
  await addTurnOn(page, new Date('2026-11-04T12:00:00-06:00'), { amount: '100' })
  await page.goto('./#/history')

  await page.getByRole('button', { name: 'Actions for Wednesday, November 4' }).click()
  await page.getByRole('button', { name: 'Mark as day off' }).click()

  // The list still shows the turn and now shows the day off too.
  await expect(turnRow(page, 1)).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Wednesday, November 4' }).locator('..').getByText('Off'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Calendar', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Wednesday, November 4 · .*Off/ })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Calendar', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Wednesday, November 4 · .*Off/ })).toBeVisible()

  // Save the backup, delete everything, then restore: the file brings the day off back.
  const file = testInfo.outputPath('day-off.json')
  await page.goto('./#/settings')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save backup file' }).click(),
  ])
  await download.saveAs(file)

  await page.getByRole('button', { name: 'Delete all data', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Type the word here').fill('DELETE')
  await dialog.getByRole('button', { name: 'Delete all data' }).click()
  await expect(page).toHaveURL(/#\/onboarding/)
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
  }

  await page.goto('./#/settings')
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.locator('p[role=status]')).toContainText('Restore finished')

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Calendar', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Wednesday, November 4 · .*Off/ })).toBeVisible()
})
