import { expect, test, type Page } from '@playwright/test'
import { addTurn, seedSettings, weeklyPay } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so the machine running the tests (UTC on GitHub) cannot move the day.
const NOON = new Date('2026-11-04T12:00:00-06:00')
const AFTER_PERIOD = new Date('2026-11-10T12:00:00-06:00')

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

/** Five $100 services: $40 of card tips the salon holds. The statement pays $332.80, 50/50. */
async function logSpecTurns(page: Page): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await addTurn(page, { amount: '100', card: '8' })
  }
  await addTurn(page, { amount: '100', card: '8' })
}

async function openRecordForm(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Record what you got', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Record what you got', exact: true }),
  ).toBeVisible()
}

interface Got {
  check?: string
  cash?: string
  stubServices?: string
}

async function recordGot(page: Page, got: Got): Promise<void> {
  await openRecordForm(page)
  if (got.check) await page.getByLabel('Check amount').fill(got.check)
  if (got.cash) await page.getByLabel('Cash amount').fill(got.cash)
  if (got.stubServices) {
    await page.getByRole('button', { name: "What the salon's stub says", exact: true }).click()
    await page.getByLabel('Services total').fill(got.stubServices)
  }
  await page.locator('form').getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Record what you got', exact: true })).toBeVisible()
}

test('a check and cash that add up show Matches', async ({ page }) => {
  await start(page)
  await seedPayRules(page, SPEC_RULES)
  await logSpecTurns(page)

  await page.goto('./#/payday')
  await recordGot(page, { check: '166.40', cash: '166.40' })

  await expect(page.getByText('Matches', { exact: true })).toBeVisible()
})

test('a cash part $20 short names the cash part and says the check part matches', async ({
  page,
}) => {
  await start(page)
  await seedPayRules(page, SPEC_RULES)
  await logSpecTurns(page)

  await page.goto('./#/payday')
  await recordGot(page, { check: '166.40', cash: '146.40' })

  await expect(page.getByText('Short $20.00', { exact: true })).toBeVisible()
  await expect(
    page.getByText('The cash part is $20.00 short; the check part matches.', { exact: true }),
  ).toBeVisible()
})

test('the stub services total adds a plain-language reason', async ({ page }) => {
  await start(page)
  await seedPayRules(page, SPEC_RULES)
  await logSpecTurns(page)

  await page.goto('./#/payday')
  await recordGot(page, { check: '166.40', cash: '166.40', stubServices: '480' })

  await expect(page.getByText('Matches', { exact: true })).toBeVisible()
  await expect(
    page.getByText('The salon counted $20.00 less in services than you logged.', {
      exact: true,
    }),
  ).toBeVisible()
})

test('marking a period checked shows its result in the past periods list', async ({ page }) => {
  await start(page)
  await seedPayRules(page, SPEC_RULES)
  await logSpecTurns(page)

  await page.goto('./#/payday')
  await recordGot(page, { check: '166.40', cash: '166.40' })

  await page.getByRole('button', { name: 'Mark as checked', exact: true }).click()
  await expect(page.getByText('Checked Nov 4', { exact: true })).toBeVisible()

  await page.clock.setFixedTime(AFTER_PERIOD)
  await page.reload()

  const pastPeriod = page.getByRole('link', { name: /Nov 1 – Nov 7/ })
  await expect(pastPeriod).toContainText('Matches')
})
