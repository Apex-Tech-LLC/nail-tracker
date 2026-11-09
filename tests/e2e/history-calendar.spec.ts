import { expect, test, type Page } from '@playwright/test'
import { addTurn, formSave, seedSettings, selectServices, skipOnboarding, turnRow } from './helpers.ts'

/** Records a turn on the day locked in the browser clock, with an explicit offset. */
async function addTurnOn(
  page: Page,
  moment: Date,
  options: Parameters<typeof addTurn>[1],
): Promise<void> {
  await page.clock.setFixedTime(moment)
  await addTurn(page, options)
}

/** A turn whose client type chip is picked on the form. */
async function addTurnWithClient(
  page: Page,
  moment: Date,
  client: 'Request' | 'Walk-in',
  amount: string,
): Promise<void> {
  await page.clock.setFixedTime(moment)
  await page.goto('./#/add')
  await page.getByRole('button', { name: client, exact: true }).click()
  await selectServices(page, ['Manicure'])
  await page.getByLabel('Service amount').fill(amount)
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
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
    page.getByRole('button', { name: 'Day off for Wednesday, November 4' }),
  ).toHaveAttribute('aria-pressed', 'true')

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
  await skipOnboarding(page)

  await page.goto('./#/settings')
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.locator('p[role=status]')).toContainText('Restore finished')

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Calendar', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Wednesday, November 4 · .*Off/ })).toBeVisible()
})

test('the Request filter lists just those turns and just their total', async ({ page }) => {
  await seedSettings(page)
  await addTurnWithClient(page, new Date('2026-11-04T12:00:00-06:00'), 'Request', '100')
  await addTurnWithClient(page, new Date('2026-11-04T12:30:00-06:00'), 'Walk-in', '50')
  await page.goto('./#/history')

  await expect(turnRow(page, 1)).toBeVisible()
  await expect(turnRow(page, 2)).toBeVisible()
  await expect(page.getByTestId('history-total')).toHaveText('$90 from 2 turns')

  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Request', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()

  await expect(turnRow(page, 1)).toBeVisible()
  await expect(turnRow(page, 2)).toHaveCount(0)
  await expect(page.getByTestId('history-total')).toHaveText('$60 from 1 turn')

  await page.getByRole('button', { name: 'Clear', exact: true }).click()

  await expect(turnRow(page, 1)).toBeVisible()
  await expect(turnRow(page, 2)).toBeVisible()
  await expect(page.getByTestId('history-total')).toHaveText('$90 from 2 turns')
})
