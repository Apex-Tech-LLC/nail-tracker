import { expect, test, type Locator, type Page } from '@playwright/test'
import { addTurn, seedSettings, turnRow } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

/** Drags a row left by `distance` pixels with the mouse, in small steps. */
async function swipeLeft(page: Page, row: Locator, distance: number): Promise<void> {
  const box = await row.boundingBox()
  if (!box) throw new Error('The row is not visible')
  const y = box.y + box.height / 2
  const startX = box.x + box.width - 16

  await page.mouse.move(startX, y)
  await page.mouse.down()
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(startX - (distance / 6) * step, y)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
}

test('the copy button on a Today row opens a filled copy form', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { service: 'Gel-X', amount: '75', cash: '5' })

  await page.getByRole('link', { name: 'Copy turn #1' }).click()
  await expect(page).toHaveURL(/#\/copy\//)
  await expect(page.getByRole('heading', { name: 'Add Turn' })).toBeVisible()
  await expect(page.getByLabel('Service amount')).toHaveValue('75.00')
  await expect(
    page.getByRole('group', { name: 'Services (pick one or more)' }).getByRole('button', {
      name: 'Gel-X',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page).toHaveURL(/#\/$/)
  await expect(turnRow(page, 2)).toBeVisible()
  await expect(page.getByText('$150.00 Service revenue', { exact: true })).toBeVisible()
})

test('swiping a History row left deletes with undo', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '50' })
  await page.goto('./#/history')

  await swipeLeft(page, turnRow(page, 1), 120)

  const copyAction = page.getByRole('link', { name: 'Copy', exact: true })
  const deleteAction = page.getByRole('button', { name: 'Delete', exact: true })
  await expect(copyAction).toBeVisible()
  await expect(deleteAction).toBeVisible()

  await deleteAction.click()

  await expect(page.getByRole('status').filter({ hasText: 'Turn deleted' })).toBeVisible()
  await expect(turnRow(page, 1)).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo', exact: true }).click()

  await expect(turnRow(page, 1)).toBeVisible()
  await expect(turnRow(page, 1).locator('..')).toContainText('$30')
})

test('a short swipe neither opens the row nor the edit screen', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '50' })
  await page.goto('./#/history')

  await swipeLeft(page, turnRow(page, 1), 30)

  await expect(page).toHaveURL(/#\/history$/)
  await expect(turnRow(page, 1)).toBeVisible()
  // aria-hidden action buttons drop out of the accessibility tree while closed.
  await expect(page.getByRole('link', { name: 'Copy', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
})

test('a long-press opens Copy, Edit and Delete, and Escape closes it', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '50' })

  const row = turnRow(page, 1)
  const box = await row.boundingBox()
  if (!box) throw new Error('The row is not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(600)
  await page.mouse.up()

  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Copy', exact: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/#\/$/)
})

test('delete on the Edit turn screen shows Turn deleted and Undo restores it', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '75' })

  await turnRow(page, 1).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByText('No turns yet')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Turn deleted' })).toBeVisible()

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(turnRow(page, 1)).toBeVisible()
  await expect(page.getByText('$75.00 Service revenue', { exact: true })).toBeVisible()
})

test('a turn row is no taller than 72 pixels', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await addTurn(page, { amount: '50', cash: '5' })

  const box = await turnRow(page, 1).locator('..').boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeLessThanOrEqual(72)
})
