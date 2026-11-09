import { expect, test, type Page } from '@playwright/test'
import { seedSettings, selectServices } from './helpers.ts'

// 3pm on Wednesday 2026-11-04 in the browser's America/Chicago timezone.
const NOON = new Date('2026-11-04T15:00:00-06:00')

const pad = (page: Page) => page.getByTestId('number-pad')
const settingsOf = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}'))
const taxChips = (page: Page) => page.getByRole('group', { name: 'Set aside for taxes' })

async function typeOnPad(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    await pad(page).getByRole('button', { name: key, exact: true }).click()
  }
}

test('goals set on Settings show on Home', async ({ page }) => {
  await seedSettings(page)
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/settings')

  await page.getByLabel('Weekly goal').click()
  await typeOnPad(page, ['8', '0', '0'])
  await pad(page).getByRole('button', { name: 'Next', exact: true }).click()
  // The monthly box saves when it loses focus, with no pad Save.
  await typeOnPad(page, ['3', '0', '0', '0'])
  await page.getByRole('button', { name: '15%', exact: true }).click()
  await expect(pad(page)).toHaveCount(0)

  await expect(page.getByLabel('Weekly goal')).toHaveValue('800.00')
  await expect.poll(async () => (await settingsOf(page)).monthlyGoalCents).toBe(300_000)
  expect((await settingsOf(page)).weeklyGoalCents).toBe(80_000)

  await page.goto('./')
  await expect(page.getByTestId('goal-progress-text')).toHaveText('$0 of $800 · $800 to go')
  await page.getByRole('button', { name: 'This month', exact: true }).click()
  await expect(page.getByTestId('goal-progress-text')).toContainText('$3,000')
})

test('a goal box that cannot be read shows the error and saves nothing', async ({ page }) => {
  await seedSettings(page, { weeklyGoalCents: 50_000 })
  await page.goto('./#/settings')

  await page.getByLabel('Weekly goal').fill('abc')
  await page.getByRole('button', { name: '15%', exact: true }).click()

  await expect(page.getByText('Enter an amount like 45 or 45.50.')).toBeVisible()
  expect((await settingsOf(page)).weeklyGoalCents).toBe(50_000)
})

test('the goal pad on Settings leaves the box above it', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/settings')

  await page.getByLabel('Monthly goal').click()
  await expect(pad(page)).toBeVisible()
  await expect
    .poll(async () => {
      const box = await page.getByLabel('Monthly goal').boundingBox()
      const keys = await pad(page).boundingBox()
      return box !== null && keys !== null && box.y + box.height <= keys.y
    })
    .toBe(true)
})

for (const [label, percent, saved] of [
  ['Off', '', null],
  ['15%', '15', 1500],
  ['20%', '20', 2000],
  ['25%', '25', 2500],
] as const) {
  test(`the ${label} tax chip saves at once and the Taxes page shows the same percent`, async ({
    page,
  }) => {
    await seedSettings(page, { taxSetAsideBp: label === 'Off' ? 2000 : null })
    await page.clock.setFixedTime(NOON)
    await page.goto('./#/settings')

    const chip = taxChips(page).getByRole('button', { name: label, exact: true })
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect((await settingsOf(page)).taxSetAsideBp ?? null).toBe(saved)

    await page.getByRole('link', { name: 'Full year table' }).click()
    await expect(page.getByRole('heading', { name: 'Taxes and year summary' })).toBeVisible()
    await expect(page.getByLabel('Percent to set aside')).toHaveValue(percent)
  })
}

test('a percent typed on the Taxes page shows as an Other chip that opens it', async ({ page }) => {
  await seedSettings(page, { taxSetAsideBp: 1750 })
  await page.clock.setFixedTime(NOON)
  await page.goto('./#/settings')

  for (const name of ['Off', '15%', '20%', '25%']) {
    await expect(taxChips(page).getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  }
  const other = taxChips(page).getByRole('button', { name: 'Other: 17.5%', exact: true })
  await expect(other).toHaveAttribute('aria-pressed', 'true')

  await other.click()
  await expect(page.getByRole('heading', { name: 'Taxes and year summary' })).toBeVisible()
  await expect(page.getByLabel('Percent to set aside')).toHaveValue('17.5')
})

test.describe('first-time setup on a 375 by 740 phone', () => {
  test.use({ viewport: { width: 375, height: 740 } })

  async function expectNoScroll(page: Page): Promise<void> {
    const fit = await page.evaluate(() => ({
      page: document.documentElement.scrollHeight,
      window: window.innerHeight,
      wide: document.documentElement.scrollWidth,
    }))
    expect(fit.page).toBeLessThanOrEqual(fit.window)
    expect(fit.wide).toBeLessThanOrEqual(375)
    await expect(page.getByRole('button', { name: /^(Start tracking|Bắt đầu)$/ })).toBeInViewport({
      ratio: 1,
    })
  }

  for (const [locale, custom, rate, payday, start] of [
    ['en', 'Custom commission', 'Custom commission %', 'Weekly', 'Start tracking'],
    ['vi', 'Mức chia khác', 'Tỷ lệ chia khác (%)', 'Hàng tuần', 'Bắt đầu'],
  ] as const) {
    test(`fits with no scroll and finishes in one screen (${locale})`, async ({ page }) => {
      await page.addInitScript((value) => {
        if (!localStorage.getItem('nail-tracker.settings')) {
          localStorage.setItem('nail-tracker.settings', JSON.stringify({ locale: value }))
        }
      }, locale)
      await page.goto('./')
      await expect(page).toHaveURL(/#\/onboarding$/)
      await expect(page.getByRole('radio')).toHaveCount(13)
      await expectNoScroll(page)

      await page.getByText(custom, { exact: true }).click()
      await expect(page.getByLabel(rate)).toBeVisible()
      await expectNoScroll(page)
      await page.getByLabel(rate).fill('abc')
      await page.getByRole('button', { name: start, exact: true }).click()
      await expect(page.getByLabel(rate)).toHaveAttribute('aria-invalid', 'true')
      await expectNoScroll(page)

      await page.getByLabel(rate).fill('55')
      await page.getByText(payday, { exact: true }).click()
      await page.getByRole('button', { name: start, exact: true }).click()
      await expect(page).not.toHaveURL(/#\/onboarding/)
      expect(await settingsOf(page)).toMatchObject({
        onboardingDone: true,
        defaultCommissionRateBp: 5500,
        payPeriodType: 'weekly',
        locale,
      })
    })
  }
})

test.describe('service price in one tap', () => {
  const setPrice = (page: Page) => page.getByRole('button', { name: 'Set price: Manicure', exact: true })
  const changePrice = (page: Page, price: string) =>
    page.getByRole('button', { name: `Change price: Manicure ${price}`, exact: true })

  test('a price is set in one tap on the price and Cancel leaves it alone', async ({ page }) => {
    await seedSettings(page)
    await page.goto('./#/settings/services')

    await setPrice(page).click()
    await expect(pad(page)).toBeVisible()
    await typeOnPad(page, ['4', '5', 'Decimal point', '5'])
    await pad(page).getByRole('button', { name: 'Save', exact: true }).click()
    await expect(pad(page)).toHaveCount(0)

    await expect(changePrice(page, '$45.50')).toHaveText('$45.50')
    const size = await changePrice(page, '$45.50').boundingBox()
    expect(size?.height).toBeGreaterThanOrEqual(44)

    // Add Turn picks the new price up.
    await page.goto('./#/add')
    await selectServices(page, ['Manicure'])
    await expect(page.getByLabel('Service amount')).toHaveValue('45.50')

    await page.goto('./#/settings/services')
    await changePrice(page, '$45.50').click()
    await typeOnPad(page, ['9', '9'])
    await expect(page.getByRole('dialog').getByLabel('Usual price')).toHaveValue('99')
    await pad(page).getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(pad(page)).toHaveCount(0)
    await expect(changePrice(page, '$45.50')).toBeVisible()

    // Escape and a tap on the dim area leave it unchanged too.
    await changePrice(page, '$45.50').click()
    await typeOnPad(page, ['1'])
    await page.keyboard.press('Escape')
    await expect(pad(page)).toHaveCount(0)
    await changePrice(page, '$45.50').click()
    await typeOnPad(page, ['1'])
    await page.mouse.click(190, 40)
    await expect(pad(page)).toHaveCount(0)
    await expect(changePrice(page, '$45.50')).toBeVisible()
  })

  test('the name and commission of the service stay as they were', async ({ page }) => {
    await seedSettings(page)
    await page.goto('./#/settings/services')
    await page.getByRole('button', { name: 'Edit: Manicure', exact: true }).click()
    await page.getByLabel('Commission % for this service').fill('55')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await setPrice(page).click()
    await typeOnPad(page, ['2', '0'])
    await pad(page).getByRole('button', { name: 'Save', exact: true }).click()

    await expect(changePrice(page, '$20.00')).toBeVisible()
    await page.getByRole('button', { name: 'Edit: Manicure', exact: true }).click()
    await expect(page.getByLabel('Name in English')).toHaveValue('Manicure')
    await expect(page.getByLabel('Commission % for this service')).toHaveValue('55')
  })

  test('a price that cannot be read shows the editor error and zero is allowed', async ({
    page,
  }) => {
    await seedSettings(page)
    await page.goto('./#/settings/services')

    await setPrice(page).click()
    await page.getByRole('dialog').getByLabel('Usual price').fill('4x')
    await pad(page).getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Enter an amount like 45 or 45.50.')).toBeVisible()
    await expect(pad(page)).toBeVisible()

    await page.getByRole('dialog').getByLabel('Usual price').fill('0')
    await pad(page).getByRole('button', { name: 'Save', exact: true }).click()
    await expect(changePrice(page, '$0.00')).toBeVisible()
  })

  test('with the number pad off, the price opens the full editor', async ({ page }) => {
    await seedSettings(page, { numberPad: false })
    await page.goto('./#/settings/services')

    await setPrice(page).click()

    await expect(page.getByLabel('Name in English')).toHaveValue('Manicure')
    await expect(pad(page)).toHaveCount(0)
  })

  test('tapping elsewhere on the row does nothing', async ({ page }) => {
    await seedSettings(page)
    await page.goto('./#/settings/services')

    await page.getByText('Manicure', { exact: true }).first().click()

    await expect(pad(page)).toHaveCount(0)
    await expect(page.getByLabel('Name in English')).toHaveCount(0)
  })
})
