import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { addTurn, formSave, openDateChoices, rowAmount, seedSettings } from './helpers.ts'

// Noon on Wednesday 2026-11-04 in Chicago. The offset is explicit so UTC on
// another machine cannot move the fixed day.
const NOW = new Date('2026-11-04T12:00:00-06:00')

async function start(page: Page, settings: Record<string, unknown> = {}): Promise<void> {
  await seedSettings(page, settings)
  await page.clock.setFixedTime(NOW)
}

/** Saves one turn on a chosen past day through the form's Other day choice. */
async function addTurnOn(
  page: Page,
  date: string,
  amount: string,
  tips: { cash?: string; card?: string } = {},
): Promise<void> {
  await page.goto('./#/add')
  await openDateChoices(page)
  await page.getByRole('button', { name: 'Other day' }).click()
  await page.getByLabel('Work date').fill(date)
  await page.getByLabel('Service amount').fill(amount)
  if (tips.cash) await page.getByLabel('Cash tip').fill(tips.cash)
  if (tips.card) await page.getByLabel('Card tip').fill(tips.card)
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

async function openTaxesFromReports(page: Page): Promise<void> {
  await page.goto('./#/earnings')
  await page.getByRole('button', { name: 'Year', exact: true }).click()
  await page.getByRole('link', { name: 'Taxes and year summary' }).click()
  await expect(page.getByRole('heading', { name: 'Taxes and year summary' })).toBeVisible()
}

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

test('opens from Reports in Year mode and shows the year totals', async ({ page }) => {
  await start(page)
  // $100 at 60% is $60, plus a $10 cash tip and a $15 card tip.
  await addTurn(page, { amount: '100', cash: '10', card: '15' })

  await openTaxesFromReports(page)

  await expect(
    page.getByText('This is a record to help with your taxes, not tax advice.'),
  ).toBeVisible()
  await expect(page.getByTestId('tax-tips')).toHaveText('$25.00')
  await expect(rowAmount(page, 'Cash tips')).toHaveText('$10.00')
  await expect(rowAmount(page, 'Card tips')).toHaveText('$15.00')
  await expect(rowAmount(page, 'Total earned')).toHaveText('$85.00')

  // The page has no tabs, so Close is the way back.
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
})

test('setting 20 percent shows the set-aside and the quarter amounts', async ({ page }) => {
  await start(page)
  await addTurnOn(page, '2026-11-04', '100', { cash: '10', card: '15' })
  await openTaxesFromReports(page)

  await expect(page.getByTestId('tax-set-aside')).toHaveCount(0)
  await page.getByLabel('Percent to set aside').fill('20')

  // 20% of $85 earned is $17.
  await expect(page.getByTestId('tax-set-aside')).toHaveText('Set aside so far this year: $17.00')
  await expect(page.getByText('Due Jan 15')).toBeVisible()
})

test('the CSV has the English terms with the Vietnamese beside them', async ({ page }, testInfo) => {
  await start(page)
  await addTurnOn(page, '2026-11-04', '100', { cash: '10', card: '15' })
  await openTaxesFromReports(page)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save CSV' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('nail-tracker-taxes-2026.csv')
  const file = testInfo.outputPath('taxes.csv')
  await download.saveAs(file)
  const csv = readFileSync(file, 'utf8')

  expect(csv).toContain('Card tips (Tip thẻ)')
  expect(csv).toContain('Total earned (Tổng tiền kiếm được)')
  expect(csv).toContain('Other payments (Các khoản trả khác)')
  expect(csv).toContain('Month (Tháng)')
  expect(csv).toContain('25.00')
})

test('the percent survives a reload and a backup round trip', async ({ page }, testInfo) => {
  await start(page)
  await addTurnOn(page, '2026-11-04', '100', { cash: '10', card: '15' })
  await openTaxesFromReports(page)
  await page.getByLabel('Percent to set aside').fill('20')

  await page.reload()
  await expect(page.getByTestId('tax-set-aside')).toHaveText('Set aside so far this year: $17.00')

  await page.goto('./#/settings')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save backup file' }).click(),
  ])
  const file = testInfo.outputPath('backup.json')
  await download.saveAs(file)

  await deleteAll(page)
  await page.goto('./#/settings')
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.locator('p[role=status]')).toContainText('Restore finished')

  await page.goto('./#/settings')
  await expect(page.getByText('Set aside 20%')).toBeVisible()
})

test('the tax reminder shows on Home with its own words', async ({ page }) => {
  // January 5 2027: the January 15 deadline for September to December 2026.
  await seedSettings(page, {
    taxSetAsideBp: 2000,
    lastBackupDate: '2027-01-05',
  })
  await page.clock.setFixedTime(new Date('2027-01-05T12:00:00-06:00'))
  await addTurnOn(page, '2026-11-03', '100', { cash: '10' })

  await page.goto('./')
  // $70 earned times 20% is $14 to set aside.
  await expect(page.getByTestId('tax-reminder')).toHaveText(
    'Estimated tax is due Jan 15: about $14 for Sep–Dec.',
  )
  await expect(page.getByRole('link', { name: 'Taxes', exact: true })).toBeVisible()
})
