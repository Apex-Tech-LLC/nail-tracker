import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Opens the app and waits until the service worker has precached it and
 * controls the page, the state a user is in after their first visit.
 */
export async function installApp(page: Page): Promise<void> {
  await page.goto('./')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

/** Call before the first page.goto(). Sets starting settings unless the app has already saved some. */
export async function seedSettings(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((settings) => {
    if (!localStorage.getItem('nail-tracker.settings')) localStorage.setItem('nail-tracker.settings', JSON.stringify(settings))
  }, { locale: 'en', onboardingDone: true, ...overrides })
}

/** Pay period settings used by the payday tests: weekly, November 1 to 7 contains the fixed test date. */
export const weeklyPay = { payPeriodType: 'weekly', payPeriodAnchorDate: '2026-11-01' }

/**
 * The amount on the row whose label is exactly `label`, so a matching amount
 * elsewhere on the screen cannot pass. Pass `section` when the same label
 * appears in more than one card; the period's received and owed cards both
 * show "Salon paid".
 */
export function rowAmount(page: Page, label: string, section?: string): Locator {
  const root = section
    ? page.getByRole('heading', { name: section, exact: true }).locator('..')
    : page
  return root.getByText(label, { exact: true }).locator('..').locator('span').last()
}

/** The service chips above the service lines. */
export function servicePicker(page: Page): Locator {
  return page.getByRole('group', { name: 'Services (pick one or more)' })
}

/**
 * Leaves exactly the named service chips on. Chips that are on but not wanted
 * are turned off, then any wanted chip that is off is turned on.
 */
export async function selectServices(page: Page, names: readonly string[]): Promise<void> {
  const picker = servicePicker(page)
  const wanted = new Set(names)
  // Wait for the form's chips before reading them: .all() does not wait.
  await picker.getByRole('button').first().waitFor()

  for (const chip of await picker.locator('button[aria-pressed="true"]').all()) {
    const label = ((await chip.textContent()) ?? '').trim()
    if (!wanted.has(label)) await chip.click()
  }

  for (const name of names) {
    const chip = picker.getByRole('button', { name, exact: true })
    if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click()
  }
}

interface TurnOptions {
  service?: string
  amount: string
  cash?: string
  card?: string
  rate?: string
}

/** Fills and saves the Add Turn form (English UI), and waits for Today. */
export async function addTurn(
  page: Page,
  { service = 'Manicure', amount, cash, card, rate }: TurnOptions,
): Promise<void> {
  await page.goto('./#/add')
  await selectServices(page, [service])
  await page.getByLabel('Service amount').fill(amount)
  if (cash) await page.getByLabel('Cash tip').fill(cash)
  if (card) await page.getByLabel('Card tip').fill(card)
  if (rate) await page.getByLabel('Commission %').fill(rate)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}
