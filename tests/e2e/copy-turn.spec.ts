import { expect, test } from '@playwright/test'
import {
  formSave,
  openDateChoices,
  openEarningsToday,
  rowAmount,
  seedSettings,
  selectServices,
  serviceChip,
  turnRow,
} from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
})

test('copying a turn saves a second turn today and leaves the original alone', async ({ page }) => {
  // One turn on November 2, with every extra option changed from its default.
  await page.goto('./#/add')
  await openDateChoices(page)
  await page.getByRole('button', { name: 'Other day' }).click()
  await page.getByLabel('Work date').fill('2026-11-02')
  await selectServices(page, ['Gel-X'])
  await page.getByLabel('Service amount').fill('75')
  await page.getByLabel('Cash tip').fill('10')
  await page.getByLabel('Card tip').fill('5')
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByLabel('Turn count').fill('2')
  await page.getByRole('button', { name: 'Walk-in', exact: true }).click()
  await page.getByLabel('Cash tip already in my hand').uncheck()
  await page.getByLabel('Note').fill('Owner requested')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('From').fill('2026-11-02')
  await page.getByLabel('To', { exact: true }).fill('2026-11-02')
  await turnRow(page, 2).click()
  await expect(page.getByRole('heading', { name: 'Edit Turn' })).toBeVisible()

  await page.getByRole('link', { name: 'Copy as a new turn' }).click()
  await expect(page).toHaveURL(/#\/copy\//)
  await expect(page.getByRole('heading', { name: 'Add Turn' })).toBeVisible()

  await expect(page.getByLabel('Service amount')).toHaveValue('75.00')
  await expect(page.getByRole('textbox', { name: 'Cash tip' })).toHaveValue('10.00')
  await expect(page.getByRole('textbox', { name: 'Card tip' })).toHaveValue('5.00')
  await openDateChoices(page)
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByLabel('Turn count')).toHaveValue('2')
  await expect(page.getByLabel('Time')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Walk-in', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByLabel('Cash tip already in my hand')).not.toBeChecked()
  await expect(page.getByLabel('Note')).toHaveValue('Owner requested')

  await formSave(page).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(turnRow(page, 2)).toBeVisible()
  await expect(page.getByTestId('hero-earned')).toHaveText('$60.00')

  await openEarningsToday(page)
  await expect(rowAmount(page, 'Service revenue')).toHaveText('$75.00')

  // The November 2 turn is still there, with the same values it started with.
  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('From').fill('2026-11-02')
  await page.getByLabel('To', { exact: true }).fill('2026-11-02')
  await turnRow(page, 2).click()
  await expect(page.getByLabel('Service amount')).toHaveValue('75.00')
  await expect(page.getByLabel('Note')).toHaveValue('Owner requested')
})

test('Home has no Repeat last turn, and Same as last opens the last turn', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('link', { name: 'Repeat last turn' })).toHaveCount(0)

  await page.goto('./#/add')
  await selectServices(page, ['Pedicure'])
  await page.getByLabel('Service amount').fill('50')
  await formSave(page).click()
  await expect(turnRow(page, 1)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Repeat last turn' })).toHaveCount(0)

  await page.goto('./#/add')
  await page.getByRole('button', { name: /Same as last/ }).click()

  await expect(page).toHaveURL(/#\/copy\//)
  await expect(page.getByRole('heading', { name: 'Add Turn' })).toBeVisible()
  await expect(page.getByLabel('Service amount')).toHaveValue('50.00')
  await expect(serviceChip(page, 'Pedicure')).toHaveAttribute('aria-pressed', 'true')
})

test('copying a turn that no longer exists says so', async ({ page }) => {
  await page.goto('./#/copy/nope')

  await expect(page.getByText('This entry no longer exists.')).toBeVisible()
})
