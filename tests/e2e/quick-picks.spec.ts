import { expect, test, type Page } from '@playwright/test'
import { seedSettings, selectServices, serviceChip, servicePicker, turnRow } from './helpers.ts'

// Fixed times with an explicit offset, so a machine running in UTC sees the
// same work days and the same "most recent" order.
const DAY_ONE = new Date('2026-11-03T10:00:00-06:00')
const DAY_TWO = new Date('2026-11-04T10:00:00-06:00')

interface ServiceInput {
  name: string
  amount: string
}

/** Fills and saves one turn, then waits until Today has reloaded. */
async function saveTurn(page: Page, at: Date, services: readonly ServiceInput[]): Promise<void> {
  await page.clock.setFixedTime(at)
  await page.goto('./#/add')
  // Clear first so the lines keep the order they are asked for here.
  await selectServices(page, [])
  await selectServices(page, services.map((service) => service.name))
  for (const service of services) {
    await page
      .getByTestId('service-line')
      .filter({ has: page.getByRole('heading', { name: service.name, exact: true }) })
      .getByLabel('Service amount')
      .fill(service.amount)
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

/** The service line whose name is exactly this one. */
function lineFor(page: Page, name: string) {
  return page
    .getByTestId('service-line')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
}

test.beforeEach(async ({ page }) => {
  await seedSettings(page)
})

test('a repeated pair of services gets a one-tap repeat chip that fills both prices', async ({
  page,
}) => {
  const services = [
    { name: 'Gel Manicure', amount: '35' },
    { name: 'Nail Art / Design', amount: '10' },
  ]
  await saveTurn(page, DAY_ONE, services)
  await saveTurn(page, DAY_TWO, services)

  await page.goto('./#/add')
  const chip = page.getByRole('button', {
    name: /Gel Manicure \+ Nail Art \/ Design \$45/,
  })
  await expect(chip).toBeVisible()

  await chip.click()

  await expect(page.getByTestId('service-line')).toHaveCount(2)
  await expect(lineFor(page, 'Gel Manicure').getByLabel('Service amount')).toHaveValue('35.00')
  await expect(lineFor(page, 'Nail Art / Design').getByLabel('Service amount')).toHaveValue(
    '10.00',
  )
})

test('Same as last opens the copy screen of the latest turn', async ({ page }) => {
  await saveTurn(page, DAY_ONE, [{ name: 'Pedicure', amount: '50' }])

  await page.goto('./#/add')
  await page.getByRole('button', { name: /Same as last/ }).click()

  await expect(page).toHaveURL(/#\/copy\//)
  await expect(page.getByRole('heading', { name: 'Add Turn' })).toBeVisible()
  await expect(page.getByLabel('Service amount')).toHaveValue('50.00')
})

test('the service used most in the last 30 days is the first chip', async ({ page }) => {
  await saveTurn(page, DAY_ONE, [{ name: 'Pedicure', amount: '50' }])
  await saveTurn(page, DAY_TWO, [{ name: 'Pedicure', amount: '50' }])
  await saveTurn(page, DAY_TWO, [{ name: 'Gel-X', amount: '70' }])

  await page.goto('./#/add')
  await expect(servicePicker(page).getByRole('button').first()).toHaveAttribute(
    'data-service-name',
    'Pedicure',
  )
})

test('a service with no usual price shows its last price and fills it in', async ({ page }) => {
  await saveTurn(page, DAY_ONE, [{ name: 'Manicure', amount: '35' }])
  await saveTurn(page, DAY_TWO, [{ name: 'Pedicure', amount: '50' }])

  await page.goto('./#/add')
  const chip = serviceChip(page, 'Manicure')
  await expect(chip).toContainText('$35')

  await chip.click()
  await expect(lineFor(page, 'Manicure').getByLabel('Service amount')).toHaveValue('35.00')
})

test('tip buttons fill the chosen box and remember the Cash/Card switch', async ({ page }) => {
  await page.goto('./#/add')
  await page.getByLabel('Service amount').fill('60')

  const ten = page.getByRole('button', { name: '$10', exact: true })
  await ten.click()
  await expect(page.getByLabel('Cash tip')).toHaveValue('10.00')
  await expect(ten).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Card', exact: true }).click()
  await page.getByRole('button', { name: '18%', exact: true }).click()
  await expect(page.getByLabel('Card tip')).toHaveValue('10.80')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Card', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('saving shows the saved bar and Copy again opens a filled copy', async ({ page }) => {
  await page.goto('./#/add')
  await page.getByLabel('Service amount').fill('45')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('status').filter({ hasText: 'Saved · you earn' })).toBeVisible()

  await page.getByRole('button', { name: 'Copy again', exact: true }).click()

  await expect(page).toHaveURL(/#\/copy\//)
  await expect(page.getByRole('heading', { name: 'Add Turn' })).toBeVisible()
  await expect(page.getByLabel('Service amount')).toHaveValue('45.00')
})

test('Undo on the saved bar deletes the new turn', async ({ page }) => {
  await page.goto('./#/add')
  await page.getByLabel('Service amount').fill('45')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Saved · you earn' })).toBeVisible()
  await expect(turnRow(page, 1)).toBeVisible()

  await page.getByRole('button', { name: 'Undo', exact: true }).click()

  await expect(page.getByText('No turns yet')).toBeVisible()
  await expect(turnRow(page, 1)).toHaveCount(0)
})
