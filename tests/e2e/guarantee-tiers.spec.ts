import { expect, test, type Page } from '@playwright/test'
import { formSave, rowAmount, seedSettings, skipOnboarding, weeklyPay } from './helpers.ts'

// Noon on 2026-11-04 in Chicago, with its offset written down so a UTC runner
// cannot move the day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

const status = (page: Page) => page.locator('p[role=status]')
const fileInput = (page: Page) => page.locator('input[type=file]')

async function start(page: Page): Promise<void> {
  await seedSettings(page, weeklyPay)
  await page.clock.setFixedTime(NOON)
}

/** Saves the rule form, starting the rule today (the form starts from the pay period by default). */
async function saveRules(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await page.getByRole('button', { name: 'Save rules', exact: true }).click()
}

/** Saves one turn at the default 60% commission on a chosen day. */
async function addTurnOn(page: Page, date: string, amount: string): Promise<void> {
  await page.goto('./#/add')
  await page.getByLabel('Work date').fill(date)
  await page.getByLabel('Service amount').fill(amount)
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

async function saveBackup(page: Page, path: string): Promise<void> {
  await page.goto('./#/settings')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save backup file' }).click(),
  ])
  await download.saveAs(path)
}

async function deleteAll(page: Page): Promise<void> {
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Delete all data', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Type the word here').fill('DELETE')
  await dialog.getByRole('button', { name: 'Delete all data' }).click()
  await expect(page).toHaveURL(/#\/onboarding/)
  await skipOnboarding(page)
}

test('a $150 daily guarantee tops a slow week up to $900', async ({ page }, testInfo) => {
  await start(page)
  await page.goto('./#/settings/pay')
  await page.getByLabel('Set a guaranteed minimum').check()
  await page.getByLabel('Guarantee amount').fill('150')
  await saveRules(page)

  for (const date of [
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05',
    '2026-11-06',
  ]) {
    await addTurnOn(page, date, '200')
  }

  // Six $200 services at 60% pay $720, so the guarantee adds $180.
  await page.goto('./#/payday')
  const guaranteeRow = 'Guarantee top-up ($150 × 6 days = $900)'
  await expect(rowAmount(page, guaranteeRow)).toHaveText('$180.00')
  await expect(rowAmount(page, 'Salon should pay you')).toHaveText('$900.00')

  await page.reload()
  await expect(rowAmount(page, guaranteeRow)).toHaveText('$180.00')
  await expect(rowAmount(page, 'Salon should pay you')).toHaveText('$900.00')

  const file = testInfo.outputPath('guarantee.json')
  await saveBackup(page, file)
  await deleteAll(page)
  await page.goto('./#/settings')
  await fileInput(page).setInputFiles(file)
  await expect(status(page)).toContainText('Restore finished')

  await page.goto('./#/payday')
  await expect(rowAmount(page, guaranteeRow)).toHaveText('$180.00')
  await expect(rowAmount(page, 'Salon should pay you')).toHaveText('$900.00')

  await page.goto('./#/settings')
  await expect(page.getByText('guarantee $150/day')).toBeVisible()
})

test('tiers replace the one rate and show the $655 share on $1,200', async ({ page }, testInfo) => {
  await start(page)
  await page.goto('./#/settings/pay')
  await page.getByLabel('Use a rate that rises with sales').check()

  const rates = page.getByLabel('Rate', { exact: true })
  await rates.nth(0).fill('50')
  await page.getByLabel('From', { exact: true }).fill('500')
  await rates.nth(1).fill('55')
  await page.getByRole('button', { name: 'Add a level' }).click()
  await page.getByLabel('From', { exact: true }).nth(1).fill('1000')
  await rates.nth(2).fill('65')

  await expect(page.getByText('$1,200 in sales: $655')).toBeVisible()
  await saveRules(page)

  await addTurnOn(page, '2026-11-04', '1200')

  await page.goto('./#/payday')
  const tierRow = 'Your share (tiers 50% / 55% / 65% of $1,200.00)'
  await expect(rowAmount(page, tierRow)).toHaveText('$655.00')

  await page.reload()
  await expect(rowAmount(page, tierRow)).toHaveText('$655.00')

  const file = testInfo.outputPath('tiers.json')
  await saveBackup(page, file)
  await deleteAll(page)
  await page.goto('./#/settings')
  await fileInput(page).setInputFiles(file)
  await expect(status(page)).toContainText('Restore finished')

  await page.goto('./#/payday')
  await expect(rowAmount(page, tierRow)).toHaveText('$655.00')

  await page.goto('./#/settings')
  await expect(page.getByText('tiers 50% / 55% / 65%')).toBeVisible()
})
