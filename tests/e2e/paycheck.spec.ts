import { expect, test, type Page } from '@playwright/test'
import { addTurn, rowAmount, seedSettings, weeklyPay } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so the machine running the tests (UTC on GitHub) cannot move the day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

// 60%, a $2 supply fee per service taken before the split, a 3% card-tip fee
// and a 50/50 check/cash split.
const SPEC_RULES = {
  id: 'default',
  startDate: '2000-01-01',
  supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' },
  cardTipFeeBp: 300,
  checkBp: 5000,
  cardTipsPaidIn: 'split',
  createdAt: 1,
  updatedAt: 1,
}

async function start(page: Page): Promise<void> {
  await seedSettings(page, weeklyPay)
  await page.clock.setFixedTime(NOON)
}

/**
 * Writes the pay rules straight into the database, because the How I'm paid
 * page is a separate task. The app must have opened the database once first.
 */
async function seedPayRules(page: Page, rules: Record<string, unknown>): Promise<void> {
  await page.goto('./')
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
  await page.evaluate(async (record) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('nail-tracker')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('payRules', 'readwrite')
        transaction.objectStore('payRules').put(record)
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      }
    })
  }, rules)
  await page.reload()
}

/** Five $100 services: $40 of card tips the salon holds and $20 of cash tips in hand. */
async function logSpecTurns(page: Page): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await addTurn(page, { amount: '100', card: '8' })
  }
  await addTurn(page, { amount: '100', card: '8', cash: '20' })
}

test('the statement adds up the spec pay rules line by line', async ({ page }) => {
  await start(page)
  await seedPayRules(page, SPEC_RULES)
  await logSpecTurns(page)

  await page.goto('./#/payday')

  await expect(rowAmount(page, 'Services you did (5 services, 5 turns)')).toHaveText('$500.00')
  await expect(rowAmount(page, 'Supply fee ($2 × 5 services)')).toHaveText('− $10.00')
  await expect(rowAmount(page, 'Your share (60% of $490.00)')).toHaveText('$294.00')
  await expect(rowAmount(page, 'Card tips')).toHaveText('$40.00')
  await expect(rowAmount(page, 'Card-tip fee (3%)')).toHaveText('− $1.20')
  await expect(rowAmount(page, 'Salon should pay you')).toHaveText('$332.80')
  await expect(rowAmount(page, 'as check (50%)')).toHaveText('$166.40')
  await expect(rowAmount(page, 'as cash (50%)')).toHaveText('$166.40')
  await expect(rowAmount(page, 'Cash tips you already have')).toHaveText('$20.00')
  await expect(rowAmount(page, 'You earned in total')).toHaveText('$352.80')
})

test('Show by day totals match the card lines', async ({ page }) => {
  await start(page)
  await seedPayRules(page, SPEC_RULES)
  await logSpecTurns(page)

  await page.goto('./#/payday')
  await page.getByRole('button', { name: 'Show by day' }).click()
  await expect(page.getByRole('button', { name: 'Show by day' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  const table = page.getByRole('table')
  await expect(table).toBeVisible()

  const dayRow = table.locator('tbody tr')
  await expect(dayRow).toHaveCount(1)
  await expect(dayRow.locator('th')).toHaveText('Nov 4')
  await expect(dayRow.locator('td').nth(0)).toHaveText('$500.00')
  await expect(dayRow.locator('td').nth(1)).toHaveText('$294.00')
  await expect(dayRow.locator('td').nth(2)).toHaveText('$40.00')

  const totalRow = table.locator('tfoot tr')
  await expect(totalRow.locator('td').nth(1)).toHaveText('$500.00')
  await expect(totalRow.locator('td').nth(2)).toHaveText('$294.00')
  await expect(totalRow.locator('td').nth(3)).toHaveText('$40.00')
})

test('with no fees and no split the card shows only four lines and the earned total', async ({
  page,
}) => {
  await start(page)
  await addTurn(page, { amount: '100' })

  await page.goto('./#/payday')

  await expect(rowAmount(page, 'Services you did (1 service, 1 turn)')).toHaveText('$100.00')
  await expect(rowAmount(page, 'Your share (60% of $100.00)')).toHaveText('$60.00')
  await expect(rowAmount(page, 'Card tips')).toHaveText('$0.00')
  await expect(rowAmount(page, 'Salon should pay you')).toHaveText('$60.00')
  await expect(rowAmount(page, 'You earned in total')).toHaveText('$60.00')

  await expect(page.getByText(/Supply fee/)).toHaveCount(0)
  await expect(page.getByText(/Card-tip fee/)).toHaveCount(0)
  await expect(page.getByText(/^as check/)).toHaveCount(0)
  await expect(page.getByText(/^as cash/)).toHaveCount(0)
  await expect(page.getByText('Cash tips you already have')).toHaveCount(0)
  await expect(page.getByText('Adjustments', { exact: true })).toHaveCount(0)
})
