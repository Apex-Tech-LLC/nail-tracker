import { expect, type Page } from '@playwright/test'

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
  await page.getByRole('button', { name: service, exact: true }).click()
  await page.getByLabel('Service amount').fill(amount)
  if (cash) await page.getByLabel('Cash tip').fill(cash)
  if (card) await page.getByLabel('Card tip').fill(card)
  if (rate) await page.getByLabel('Commission %').fill(rate)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Add Turn' })).toBeVisible()
}
