import { expect, test, type Page } from '@playwright/test'
import { addTurn, formSave, seedSettings, selectServices } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')
const DAY_OFF_PILL = 'Day off for Wednesday, November 4'

interface Seed {
  service: string
  amount: string
  request?: boolean
  cash?: string
  card?: string
}

// Manicure is used 3 times, Pedicure 2, Gel Manicure once: the two top
// services are Manicure and Pedicure. Two turns are Request, two have a cash
// tip and two a card tip.
const TURNS: Seed[] = [
  { service: 'Manicure', amount: '30', request: true, cash: '5' },
  { service: 'Manicure', amount: '31', card: '7' },
  { service: 'Manicure', amount: '32' },
  { service: 'Pedicure', amount: '40', request: true, card: '3' },
  { service: 'Pedicure', amount: '41', cash: '2' },
  { service: 'Gel Manicure', amount: '50' },
]

async function saveTurn(page: Page, turn: Seed): Promise<void> {
  if (!turn.request) {
    await addTurn(page, { service: turn.service, amount: turn.amount, cash: turn.cash, card: turn.card })
    return
  }
  await page.goto('./#/add')
  await page.getByRole('button', { name: 'Request', exact: true }).click()
  await selectServices(page, [turn.service])
  await page.getByLabel('Service amount').fill(turn.amount)
  if (turn.cash) await page.getByLabel('Cash tip').fill(turn.cash)
  if (turn.card) await page.getByLabel('Card tip').fill(turn.card)
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

async function seedTurns(page: Page): Promise<void> {
  for (const turn of TURNS) await saveTurn(page, turn)
}

const rows = (page: Page) => page.getByTestId('turn-row')
const strip = (page: Page) => page.getByRole('group', { name: /^(Quick filters|Lọc nhanh)$/ })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
})

test('the strip offers Request, the tips and the two most used services', async ({ page }) => {
  await seedTurns(page)
  await page.goto('./#/history')
  await expect(rows(page)).toHaveCount(6)

  await expect(strip(page).getByRole('button')).toHaveText([
    'Request',
    'Cash tip',
    'Card tip',
    'Manicure',
    'Pedicure',
  ])
})

for (const [pill, expected] of [
  ['Request', 2],
  ['Cash tip', 2],
  ['Card tip', 2],
  ['Manicure', 3],
  ['Pedicure', 2],
] as const) {
  test(`one tap on ${pill} filters the list and the Filter sheet agrees`, async ({ page }) => {
    await seedTurns(page)
    await page.goto('./#/history')
    await expect(rows(page)).toHaveCount(6)
    const total = page.getByTestId('history-total')
    const totalTop = (await total.boundingBox())?.y

    const button = strip(page).getByRole('button', { name: pill, exact: true })
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()

    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(rows(page)).toHaveCount(expected)
    // The filter is not repeated as a chip, so nothing pushes the list down.
    await expect(page.getByRole('button', { name: pill, exact: true })).toHaveCount(1)
    expect((await total.boundingBox())?.y).toBe(totalTop)

    await page.getByRole('button', { name: 'Filter', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: pill, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()

    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(rows(page)).toHaveCount(6)
  })
}

test('a filter turned on in the sheet shows on its pill, and Clear turns it off', async ({
  page,
}) => {
  await seedTurns(page)
  await page.goto('./#/history')
  await expect(rows(page)).toHaveCount(6)

  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Cash tip', exact: true }).click()
  // This service is not among the top two, so it has no pill.
  await dialog.getByRole('button', { name: 'Gel Manicure', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()

  await expect(strip(page).getByRole('button', { name: 'Cash tip', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Both together match nothing; the service has no pill, so it is a removable chip.
  await expect(rows(page)).toHaveCount(0)
  await expect(strip(page).getByRole('button', { name: 'Gel Manicure' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Gel Manicure', exact: true }).click()
  await expect(rows(page)).toHaveCount(2)

  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(strip(page).getByRole('button', { name: 'Cash tip', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(rows(page)).toHaveCount(6)
})

for (const locale of ['en', 'vi'] as const) {
  test(`the strip stays on one line at 375 by 740 in ${locale === 'en' ? 'English' : 'Vietnamese'}`, async ({
    page,
  }) => {
    await seedTurns(page)
    if (locale === 'vi') {
      await page.goto('./#/settings')
      await page
        .getByRole('group', { name: 'Language' })
        .getByText('Tiếng Việt', { exact: true })
        .click()
    }
    await page.setViewportSize({ width: 375, height: 740 })
    await page.goto('./#/history')
    await expect(rows(page)).toHaveCount(6)

    const filterButton = page.getByRole('button', { name: locale === 'en' ? 'Filter' : 'Lọc', exact: true })
    const pills = strip(page).getByRole('button')
    await expect(pills).toHaveCount(5)
    const filterBox = await filterButton.boundingBox()
    expect(filterBox).not.toBeNull()
    for (const pill of await pills.all()) {
      const box = await pill.boundingBox()
      expect(box).not.toBeNull()
      // Same line as the Filter button, and a tap target of at least 44 pixels.
      expect(Math.abs(box!.y - filterBox!.y)).toBeLessThan(4)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    // Longer than the screen, it scrolls sideways instead of wrapping.
    const stripBox = await strip(page).boundingBox()
    expect(stripBox!.height).toBeLessThan(60)
    const noPageScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
    expect(noPageScroll).toBe(true)
  })
}

test('the Day off pill marks and clears a day in one tap, and Undo puts it back', async ({
  page,
}) => {
  await seedTurns(page)
  await page.goto('./#/history')
  await expect(rows(page)).toHaveCount(6)
  const pill = page.getByRole('button', { name: DAY_OFF_PILL })
  const toast = page.getByRole('status').filter({ hasText: 'Marked as a day off' })

  await expect(pill).toHaveAttribute('aria-pressed', 'false')
  await pill.click()

  // One tap: no sheet opens. The day with turns is off, and Undo is offered.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(pill).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Off', { exact: true })).toHaveCount(0)
  await expect(rows(page)).toHaveCount(6)
  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(pill).toHaveAttribute('aria-pressed', 'false')

  await pill.click()
  await expect(pill).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(pill).toHaveAttribute('aria-pressed', 'true')

  // Tapping it again clears the day; Undo marks it again.
  await pill.click()
  await expect(pill).toHaveAttribute('aria-pressed', 'false')
  const cleared = page.getByRole('status').filter({ hasText: 'Day off removed' })
  await cleared.getByRole('button', { name: 'Undo' }).click()
  await expect(pill).toHaveAttribute('aria-pressed', 'true')
})

test('Reports shows service revenue, commission and both tips with no tap', async ({ page }) => {
  await addTurn(page, { amount: '100', cash: '10', card: '15' })
  await page.goto('./#/earnings')

  for (const [label, amount] of [
    ['Service revenue', '$100.00'],
    ['Commission', '$60.00'],
    ['Cash tips', '$10.00'],
    ['Card tips', '$15.00'],
  ] as const) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    await expect(
      page.getByText(label, { exact: true }).first().locator('..').locator('span').last(),
    ).toHaveText(amount)
  }

  // The rest stays behind More.
  const more = page.getByRole('button', { name: 'More', exact: true })
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Total paid', { exact: true })).toHaveCount(0)
  await more.click()
  await expect(page.getByText('Total paid', { exact: true })).toBeVisible()
})
