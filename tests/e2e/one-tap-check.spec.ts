import { expect, test, type Locator, type Page } from '@playwright/test'
import { seedSettings, selectServices } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

type Row = Record<string, unknown>

/** Every row of one table, read straight from the database the app writes to. */
async function rows(page: Page, store: 'turns' | 'turnServices'): Promise<Row[]> {
  return page.evaluate(
    (name) =>
      new Promise<Row[]>((resolve, reject) => {
        const open = indexedDB.open('nail-tracker')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const request = database.transaction(name).objectStore(name).getAll()
          request.onsuccess = () => {
            database.close()
            resolve(request.result as Row[])
          }
          request.onerror = () => reject(request.error)
        }
      }),
    store,
  )
}

async function sayText(page: Page, text: string): Promise<void> {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await page.goto('./#/say')
  await page.locator('textarea').first().fill(text)
  await page.getByRole('button', { name: 'Make turns', exact: true }).click()
  await expect(page.getByTestId('draft-card').first()).toBeVisible()
}

const card = (page: Page): Locator => page.getByTestId('draft-card').first()
const quickFixes = (page: Page): Locator => card(page).getByRole('group', { name: 'Quick fixes' })
const pad = (page: Page): Locator => page.getByTestId('number-pad')

async function typeOnPad(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) await pad(page).getByRole('button', { name: key, exact: true }).click()
}

async function expectTapSize(buttons: Locator): Promise<void> {
  for (const button of await buttons.all()) {
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
}

test('Looks right clears the flag in one tap and the turn saves', async ({ page }) => {
  await sayText(page, 'Joe X 65 tip 10 cash')
  await expect(card(page)).toContainText('Check this')

  const looksRight = quickFixes(page).getByRole('button', { name: 'Looks right', exact: true })
  await expectTapSize(quickFixes(page).getByRole('button'))
  await looksRight.click()

  // Still on the Check screen: the tap did not open the edit screen.
  await expect(page.getByRole('heading', { level: 1, name: 'Check 1 turn' })).toBeVisible()
  await expect(card(page)).not.toContainText('Check this')
  await expect(quickFixes(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Save 1 turn' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved 1 turn' })).toBeVisible()
  expect(await rows(page, 'turns')).toHaveLength(1)
  expect(await rows(page, 'turnServices')).toMatchObject([{ servicePriceCents: 6500 }])
})

test('a line with no price gets its price from the pad, and Cancel leaves it alone', async ({ page }) => {
  await sayText(page, 'Pedicure')
  await expect(card(page)).toContainText('No price')
  await expect(page.getByRole('button', { name: 'Save 1 turn' })).toBeDisabled()
  await expect(quickFixes(page).getByRole('button', { name: 'Looks right' })).toHaveCount(0)

  const setPrice = quickFixes(page).getByRole('button', { name: 'Set price', exact: true })
  await expectTapSize(quickFixes(page).getByRole('button'))
  await setPrice.click()
  await expect(pad(page)).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Price: Pedicure' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fix this turn' })).toHaveCount(0)

  await typeOnPad(page, ['3', '5'])
  await pad(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(pad(page)).toHaveCount(0)
  await expect(card(page)).toContainText('No price')
  await expect(page.getByRole('button', { name: 'Save 1 turn' })).toBeDisabled()

  await setPrice.click()
  await typeOnPad(page, ['3', '5'])
  await pad(page).getByRole('button', { name: 'Save', exact: true }).click()
  await expect(pad(page)).toHaveCount(0)

  await expect(card(page)).toContainText('$35')
  await expect(card(page)).not.toContainText('Check this')
  await expect(quickFixes(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Save 1 turn' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved 1 turn' })).toBeVisible()
  expect(await rows(page, 'turnServices')).toMatchObject([{ servicePriceCents: 3500 }])
})

test('a card with several reasons stays flagged until the last one is fixed', async ({ page }) => {
  // A guessed service and no price: two reasons.
  await sayText(page, 'peddy cure')
  await expect(card(page)).toContainText('No price')
  await expect(card(page)).toContainText('"peddy cure"')
  await expect(quickFixes(page).getByRole('button', { name: 'Looks right' })).toHaveCount(0)

  await quickFixes(page).getByRole('button', { name: 'Set price', exact: true }).click()
  await typeOnPad(page, ['4', '0'])
  await pad(page).getByRole('button', { name: 'Save', exact: true }).click()

  // The price is in, but the guessed service still wants a look.
  await expect(card(page)).toContainText('$40')
  await expect(card(page)).toContainText('Check this')
  await expect(page.getByRole('button', { name: 'Save 1 turn' })).toBeEnabled()

  await quickFixes(page).getByRole('button', { name: 'Looks right', exact: true }).click()
  await expect(card(page)).not.toContainText('Check this')
  await expect(quickFixes(page)).toHaveCount(0)
})

test('Looks right is not offered when the service is missing or unclear', async ({ page }) => {
  await sayText(page, 'gel 45')
  await expect(card(page)).toContainText('No service')
  await expect(card(page)).toContainText('Check this')
  await expect(page.getByRole('button', { name: 'Looks right' })).toHaveCount(0)
  await expect(quickFixes(page)).toHaveCount(0)

  await page.goto('./#/say')
  await page.locator('textarea').first().fill('Manicure 30. blah blah')
  await page.getByRole('button', { name: 'Make turns', exact: true }).click()
  await page.getByRole('button', { name: 'Add as a turn' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('draft-card').nth(1)).toContainText('No service')
  await expect(page.getByRole('button', { name: 'Looks right' })).toHaveCount(0)
})

test('a tip with no amount gets its tip from a chip, to cash or card as the switch says', async ({ page }) => {
  await sayText(page, 'Gel manicure 45 tip')
  await expect(card(page)).toContainText('A tip was mentioned without an amount')
  await expectTapSize(quickFixes(page).getByRole('button'))
  await expect(quickFixes(page).getByRole('button', { name: 'Looks right' })).toHaveCount(0)

  const chip = (name: string) => quickFixes(page).getByRole('button', { name, exact: true })
  await chip('$10').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Check 1 turn' })).toBeVisible()
  await expect(card(page)).toContainText('+$10 cash tip')
  await expect(card(page)).not.toContainText('Check this')
  await expect(chip('$10')).toHaveAttribute('aria-pressed', 'true')

  // The pressed chip taken again clears the tip and the doubt comes back.
  await chip('$10').click()
  await expect(card(page)).not.toContainText('cash tip')
  await expect(card(page)).toContainText('A tip was mentioned without an amount')

  // The Card switch sends the next tip to the card; 18% of $45 is $8.10.
  await chip('Card').click()
  await chip('18%').click()
  await expect(card(page)).toContainText('+$8.10 card tip')
  await expect(card(page)).not.toContainText('cash tip')
  await expect(card(page)).not.toContainText('Check this')

  await page.getByRole('button', { name: 'Save 1 turn' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved 1 turn' })).toBeVisible()
  expect(await rows(page, 'turns')).toMatchObject([{ cashTipCents: 0, cardTipCents: 810 }])
})

test('tapping the card itself still opens the edit screen', async ({ page }) => {
  await sayText(page, 'Joe X 65')
  await card(page).getByRole('button').first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fix this turn' })).toBeVisible()
})

test('Add turn tip chips still fill the tip, switch to card and clear', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/add')
  await selectServices(page, ['Manicure'])
  await page.getByLabel('Service amount').fill('45')

  await page.getByRole('button', { name: '$10', exact: true }).click()
  await expect(page.getByLabel('Cash tip')).toHaveValue('10.00')
  await page.getByRole('button', { name: '$10', exact: true }).click()
  await expect(page.getByLabel('Cash tip')).toHaveValue('')

  await page.getByRole('button', { name: 'Card', exact: true }).click()
  await page.getByRole('button', { name: '18%', exact: true }).click()
  await expect(page.getByLabel('Card tip')).toHaveValue('8.10')
})
