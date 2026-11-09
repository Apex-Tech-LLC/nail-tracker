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
  }, { locale: 'en', onboardingDone: true, sayHowToSeen: true, ...overrides })
}

/**
 * Pins the app's calendar day without Playwright's clock API: that API also
 * replaces the User Timing timeline, which the speed marks need intact.
 * `new Date()` returns the fixed moment; `new Date(value)` still works.
 */
export async function fixNow(page: Page, date: Date): Promise<void> {
  await page.addInitScript((millis) => {
    const RealDate = Date
    class FixedDate extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(millis)
        else super(...(args as [number]))
      }
      static now(): number {
        return millis
      }
    }
    window.Date = FixedDate as DateConstructor
  }, date.getTime())
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

/**
 * Opens Reports on today alone, so a turn saved on another day in the same
 * week cannot move the figure, then opens Details. Read a figure with
 * `rowAmount(page, label)`.
 */
export async function openEarningsToday(page: Page): Promise<void> {
  await page.goto('./#/earnings')
  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await page.getByRole('button', { name: 'Details', exact: true }).click()
}

/** The edit link of the row whose second line shows that turn number. */
export function turnRow(page: Page, number: number | string): Locator {
  return page.getByTestId('turn-row').filter({ hasText: new RegExp(`#${number}(?!\\d)`) })
}

/** The service chips above the service lines. */
export function servicePicker(page: Page): Locator {
  return page.getByRole('group', { name: 'Services (pick one or more)' })
}

/**
 * One service chip by its service name. A chip may also show a price, which
 * would make its accessible name more than the name, so the name is matched
 * through the chip's own attribute instead.
 */
export function serviceChip(page: Page, name: string): Locator {
  return servicePicker(page).locator(`button[data-service-name="${name}"]`)
}

/** The commission pill at the top of the Add turn form. */
export function commissionPill(page: Page): Locator {
  return page.getByRole('button', { name: /^Commission:/ })
}

/** Opens the commission pill so the shared rate box can be read or filled. */
export async function openCommission(page: Page): Promise<void> {
  await commissionPill(page).click()
}

/** The date pill at the top of the Add turn form. */
export function datePill(page: Page): Locator {
  return page.getByRole('button', { name: /^Date:/ })
}

/** Opens the date pill so Today, Yesterday and Other day can be picked. */
export async function openDateChoices(page: Page): Promise<void> {
  await datePill(page).click()
}

/**
 * The form's own Save button. The number pad has a Save key too, so the form
 * is scoped to keep the two apart.
 */
export function formSave(page: Page): Locator {
  return page.locator('form').getByRole('button', { name: 'Save', exact: true })
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
    const label = (await chip.getAttribute('data-service-name')) ?? ''
    if (!wanted.has(label)) await chip.click()
  }

  for (const name of names) {
    const chip = serviceChip(page, name)
    if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click()
  }

  // On a new turn the first chip tapped replaces the starting service, which
  // may have been a wanted one: then start over from no services.
  const pressed = picker.locator('button[aria-pressed="true"]')
  if ((await pressed.count()) === names.length) return
  while ((await pressed.count()) > 0) await pressed.first().click()
  for (const name of names) await serviceChip(page, name).click()
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
  if (rate) {
    await openCommission(page)
    await page.getByLabel('Commission %').fill(rate)
  }
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}
