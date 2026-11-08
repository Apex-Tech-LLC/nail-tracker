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
