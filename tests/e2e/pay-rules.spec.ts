import { expect, test, type Page } from '@playwright/test'
import { seedSettings } from './helpers.ts'

// Noon on 2026-11-06 in Chicago, written with its offset so a UTC runner
// cannot move the day.
const NOON = new Date('2026-11-06T12:00:00-06:00')

/** Reads the saved pay rules straight from the database, not from the screen. */
function countPayRules(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('nail-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const count = database
            .transaction('payRules', 'readonly')
            .objectStore('payRules')
            .count()
          count.onsuccess = () => resolve(count.result)
          count.onerror = () => reject(count.error)
        }
      }),
  )
}

test('sets up commission, supply fee, card-tip fee and a 50/50 split', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)

  await page.goto('./#/settings')
  await page.getByRole('link', { name: /How I'm paid/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: "How I'm paid" })).toBeVisible()

  await page.getByRole('group', { name: 'Default commission' }).getByText('60%', { exact: true }).click()

  await page
    .getByRole('group', { name: 'How it is charged' })
    .getByText('Per service', { exact: true })
    .click()
  await page.getByLabel('Amount per service').fill('2')
  await page.getByLabel('Percent of card tips').fill('3')
  await page
    .getByRole('group', { name: 'When it is taken' })
    .getByText('Taken before the split', { exact: true })
    .click()

  await page.getByRole('group', { name: 'Split' }).getByText('50/50', { exact: true }).click()

  await expect(
    page.getByText('A $100 service: the salon keeps $2, you get 60% of $98 = $58.80.'),
  ).toBeVisible()
  await expect(page.getByText('$1,834 owed: $917 by check, $917 cash.')).toBeVisible()

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('When did this start?')).toBeVisible()
  await page.getByRole('button', { name: 'Save rules', exact: true }).click()
  // The live list shows the saved rule once the write has finished.
  await expect(page.getByText('Starts Nov 6, 2026')).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('group', { name: 'How it is charged' }).getByRole('radio', { name: 'Per service' }),
  ).toBeChecked()
  await expect(page.getByLabel('Amount per service')).toHaveValue('2.00')
  await expect(page.getByLabel('Percent of card tips')).toHaveValue('3')
  await expect(
    page.getByRole('group', { name: 'Split' }).getByRole('radio', { name: '50/50' }),
  ).toBeChecked()

  await page.goto('./#/settings')
  await expect(
    page.getByText('60% · $2 supply fee · 3% card-tip fee · 50/50 check/cash'),
  ).toBeVisible()
})

test('a rule saved with another day is replaced, not duplicated, on a later change', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await page.goto('./#/settings/pay')

  await page.getByLabel('Percent of card tips').fill('4')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('group', { name: 'Start date' }).getByText('Other day', { exact: true }).click()
  await page.getByLabel('Start date').fill('2026-11-04')
  await page.getByRole('button', { name: 'Save rules', exact: true }).click()

  await expect(page.getByText('Starts Nov 4, 2026')).toBeVisible()
  expect(await countPayRules(page)).toBe(2)

  await page.getByLabel('Percent of card tips').fill('5')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('group', { name: 'Start date' }).getByText('Other day', { exact: true }).click()
  await page.getByLabel('Start date').fill('2026-11-04')
  await page.getByRole('button', { name: 'Save rules', exact: true }).click()

  await expect(page.getByText('Starts Nov 4, 2026')).toBeVisible()
  await expect(page.getByText('Starts Jan 1, 2000')).toBeVisible()
  expect(await countPayRules(page)).toBe(2)
})
