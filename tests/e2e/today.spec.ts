import { expect, test } from '@playwright/test'
import { addTurn, seedSettings } from './helpers.ts'

test('an empty day says there are no turns yet', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./')

  await expect(page.getByText('No turns yet')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add your first turn' })).toBeVisible()
  await expect(page.getByText('$0.00').first()).toBeVisible()
})

test('a turn shows the spec example numbers', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '100', cash: '10', card: '15' })

  await expect(page.getByText('$100.00').first()).toBeVisible()
  await expect(page.getByText('$60.00').first()).toBeVisible()
  await expect(page.getByText('$10.00').first()).toBeVisible()
  await expect(page.getByText('$15.00').first()).toBeVisible()
  await expect(page.getByText('$85.00').first()).toBeVisible()
  await expect(page.getByText('Turn #1')).toBeVisible()
})

test('two turns add up', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '40' })
  await addTurn(page, { service: 'Pedicure', amount: '50' })

  await expect(page.getByText('Turn #2')).toBeVisible()
  await expect(page.getByText('$54.00').first()).toBeVisible()
})

test('a saved turn survives a reload', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '45' })
  await page.reload()

  await expect(page.getByText('Turn #1')).toBeVisible()
})

test('another day can be viewed and left', async ({ page }) => {
  await seedSettings(page)
  // Noon in the browser's America/Chicago timezone, so the day is 2026-11-04.
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00-06:00'))
  await addTurn(page, { amount: '45' })

  await page.getByLabel('View another day').fill('2026-11-03')
  await expect(page.getByText('No turns yet')).toBeVisible()

  const back = page.getByRole('button', { name: 'Go to today' })
  await expect(back).toBeVisible()
  await back.click()
  await expect(page.getByText('Turn #1')).toBeVisible()
})

test('the page rolls over to the new day at midnight', async ({ page }) => {
  // 23:59:30 in the browser's America/Chicago timezone.
  await page.clock.install({ time: new Date('2026-11-04T23:59:30-06:00') })
  await seedSettings(page)
  await addTurn(page, { amount: '45' })

  await page.clock.runFor('01:00')

  await expect(page.getByText(/Thursday, November 5/)).toBeVisible()
  await expect(page.getByText('$0.00').first()).toBeVisible()
})
