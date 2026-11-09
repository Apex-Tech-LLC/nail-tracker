import { expect, test, type Page } from '@playwright/test'
import { addTurn, openEarningsToday, rowAmount, seedSettings } from './helpers.ts'

// Noon on 2026-11-04, the day every test records to.
const NOON = new Date('2026-11-04T12:00:00')

interface AdjustmentOptions {
  amount: string
  category?: string
  note?: string
}

/** Fills and saves the Add Adjustment form (English UI). */
async function addAdjustment(
  page: Page,
  { amount, category = 'Bonus', note }: AdjustmentOptions,
): Promise<void> {
  await page.goto('./#/adjustment/new')
  await page.getByLabel('Amount').fill(amount)
  await page.getByRole('group', { name: 'Type', exact: true }).getByRole('button', { name: category, exact: true }).click()
  if (note) await page.getByLabel('Note').fill(note)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

test('a negative adjustment shows on History and lowers the day total', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await addAdjustment(page, {
    amount: '-25',
    category: 'Commission correction',
    note: 'Wrong price',
  })
  await page.goto('./#/history')

  await expect(page.getByText('Commission correction')).toBeVisible()
  await expect(page.getByText('Wrong price')).toBeVisible()
  await expect(page.getByText('-$25')).toBeVisible()
  await expect(page.getByText('1 turn · $35')).toBeVisible()
})

test('an adjustment changes today’s earned money', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '100' })
  await addAdjustment(page, {
    amount: '-25',
    category: 'Commission correction',
    note: 'Wrong price',
  })
  await page.goto('./')

  // $60 commission plus the -$25 correction.
  await expect(page.getByTestId('hero-earned')).toHaveText('$35.00')
  await expect(page.getByText('Turns', { exact: true }).locator('..').locator('b')).toHaveText('1')

  await openEarningsToday(page)
  await expect(rowAmount(page, 'Adjustments')).toHaveText('-$25.00')
})

test('a zero amount shows an error and stays on the form', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/adjustment/new')
  await page.getByLabel('Amount').fill('0')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(
    page.getByText('Enter an amount that is not zero, like 25 or -25.'),
  ).toBeVisible()
  await expect(page).toHaveURL(/#\/adjustment\/new$/)
})

test('editing an adjustment saves the new amount', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addAdjustment(page, { amount: '10' })
  await page.goto('./#/history')

  await page.getByRole('link', { name: /Bonus/ }).click()
  await page.getByLabel('Amount').fill('20')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Bonus/ })).toContainText('$20')
})

test('deleting an adjustment removes it from History', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addAdjustment(page, { amount: '15' })
  await page.goto('./#/history')

  await page.getByRole('link', { name: /Bonus/ }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByText('Nothing recorded for these dates.')).toBeVisible()
})

test('a quick double tap on Save records the adjustment once', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/adjustment/new')
  await page.getByLabel('Amount').fill('15')
  await page.getByRole('button', { name: 'Save', exact: true }).dblclick()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()

  // Let a second save land before counting, so a duplicate cannot be missed.
  await page.goto('./#/history')
  await page.waitForTimeout(500)
  await expect(page.getByRole('link', { name: /Bonus/ })).toHaveCount(1)
})

interface SavedAdjustment {
  id: string
  amountCents: number
}

/** Every saved adjustment, read straight from the database the app writes to. */
async function savedAdjustments(page: Page): Promise<SavedAdjustment[]> {
  return page.evaluate(
    () =>
      new Promise<SavedAdjustment[]>((resolve, reject) => {
        const open = indexedDB.open('nail-tracker')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const request = database.transaction('adjustments').objectStore('adjustments').getAll()
          request.onsuccess = () => {
            database.close()
            resolve(request.result as SavedAdjustment[])
          }
          request.onerror = () => reject(request.error)
        }
      }),
  )
}

test('Bonus and Deduction pick the sign, a typed minus picks Deduction, and an edited deduction opens on it', async ({
  page,
}) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  const bonus = page.getByRole('group', { name: 'Bonus or deduction' }).getByRole('button', { name: 'Bonus' })
  const deduction = page.getByRole('button', { name: 'Deduction', exact: true })
  const save = page.getByRole('button', { name: 'Save', exact: true })
  // The browser clock is fixed, so saving order cannot be read back: compare sorted.
  const savedAmounts = async () =>
    (await savedAdjustments(page)).map((row) => row.amountCents).sort((a, b) => a - b)

  await page.goto('./#/adjustment/new')
  await expect(bonus).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Amount').fill('40')
  await save.click()
  await expect.poll(savedAmounts).toEqual([4000])

  await page.goto('./#/adjustment/new')
  await deduction.click()
  await expect(deduction).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Amount').fill('25')
  await save.click()
  await expect.poll(savedAmounts).toEqual([-2500, 4000])

  await page.goto('./#/adjustment/new')
  await page.getByLabel('Amount').fill('-10')
  await expect(deduction).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Amount')).toHaveValue('10')
  await save.click()
  await expect.poll(savedAmounts).toEqual([-2500, -1000, 4000])

  const saved = (await savedAdjustments(page)).find((row) => row.amountCents === -2500)
  await page.goto(`./#/adjustment/${saved?.id}`)
  await expect(deduction).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Amount')).toHaveValue('25.00')
  await bonus.click()
  await save.click()
  await expect.poll(savedAmounts).toEqual([-1000, 2500, 4000])
})
