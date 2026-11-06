import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addTurn, seedSettings, weeklyPay } from './helpers.ts'

// Noon in Chicago. The offset is explicit so the machine running the tests
// (UTC on GitHub) cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

const LOCALES = ['en', 'vi'] as const
type Locale = (typeof LOCALES)[number]

interface Copy {
  appName: string
  addTurn: string
  editTurn: string
  addService: string
  moreOptions: string
  delete: string
  history: string
  earnings: string
  payday: string
  period: string
  recordPayment: string
  newAdjustment: string
  settings: string
  servicePresets: string
  addPreset: string
  next: string
  onboarding: readonly [string, string, string, string]
}

const TEXT: Record<Locale, Copy> = {
  en: {
    appName: 'Nail Tracker',
    addTurn: 'Add Turn',
    editTurn: 'Edit Turn',
    addService: 'Add service',
    moreOptions: 'More options',
    delete: 'Delete',
    history: 'History',
    earnings: 'Earnings',
    payday: 'Payday',
    period: 'Nov 1 – Nov 7',
    recordPayment: 'Record payment',
    newAdjustment: 'New adjustment',
    settings: 'Settings',
    servicePresets: 'Service presets',
    addPreset: 'Add a service',
    next: 'Next',
    onboarding: [
      'Choose your language',
      'How are you paid?',
      'How do you usually get your tips?',
      'How often are you paid?',
    ],
  },
  vi: {
    appName: 'Nail Tracker',
    addTurn: 'Thêm turn',
    editTurn: 'Chỉnh sửa turn',
    addService: 'Thêm dịch vụ',
    moreOptions: 'Thêm tùy chọn',
    delete: 'Xóa',
    history: 'Lịch sử',
    earnings: 'Thu nhập',
    payday: 'Ngày nhận lương',
    period: '1 thg 11 – 7 thg 11',
    recordPayment: 'Ghi khoản đã nhận',
    newAdjustment: 'Điều chỉnh mới',
    settings: 'Cài đặt',
    servicePresets: 'Danh sách dịch vụ',
    addPreset: 'Thêm dịch vụ',
    next: 'Tiếp',
    onboarding: [
      'Chọn ngôn ngữ',
      'Bạn được trả lương thế nào?',
      'Bạn thường nhận tip thế nào?',
      'Bao lâu bạn nhận lương một lần?',
    ],
  },
}

test.use({ viewport: { width: 375, height: 667 } })

// Every screen, in both languages, checked against WCAG 2.1 A and AA plus
// axe best practices. Any violation fails, not only serious ones.
async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze()
  const found = violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)
  expect(found).toEqual([])
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/** Waits for the page's one heading, then runs both screen checks. */
async function expectScreen(page: Page, heading?: string) {
  if (heading === undefined) await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  else await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  await audit(page)
  await noSidewaysScroll(page)
}

/** Writes the language to storage and reloads, because the data helpers only speak English. */
async function switchLocale(page: Page, locale: Locale) {
  await page.evaluate((value) => {
    const saved = JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}')
    localStorage.setItem('nail-tracker.settings', JSON.stringify({ ...saved, locale: value }))
  }, locale)
  await page.reload()
}

/** One large turn, one adjustment of -25 and one payment of 100, all on the fixed day. */
async function addData(page: Page) {
  await addTurn(page, { amount: '1234.56', cash: '100', card: '200' })

  await page.goto('./#/adjustment/new')
  await page.getByLabel('Amount').fill('-25')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: /Add Turn/ })).toBeVisible()

  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Nov 1 – Nov 7/ }).click()
  await page.getByRole('link', { name: 'Record payment', exact: true }).click()
  await page.getByLabel('Amount received').first().fill('100')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()
}

async function start(page: Page, locale: Locale, withData = true) {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page, weeklyPay)
  if (withData) await addData(page)
  else await page.goto('./')
  await switchLocale(page, locale)
}

/**
 * Controls smaller than 40px. Checkboxes and radios are left out because the
 * whole label row or tile is their target.
 */
async function smallTapTargets(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, a, input:not([type=checkbox]):not([type=radio]), select, textarea')]
      .map((element) => ({
        text: element.textContent?.trim() || element.getAttribute('aria-label'),
        height: element.getBoundingClientRect().height,
      }))
      .filter((item) => item.height > 0 && item.height < 40),
  )
}

for (const locale of LOCALES) {
  const text = TEXT[locale]

  test.describe(locale, () => {
    test('today with data', async ({ page }) => {
      await start(page, locale)
      await page.goto('./')
      await expectScreen(page, text.appName)
    })

    test('today empty', async ({ page }) => {
      await start(page, locale, false)
      await page.goto('./')
      await expectScreen(page, text.appName)
    })

    test('add turn', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/add')
      await expectScreen(page, text.addTurn)
    })

    test('add turn, all options open', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/add')
      await expect(page.getByRole('heading', { level: 1, name: text.addTurn })).toBeVisible()
      await page.getByRole('button', { name: text.addService, exact: true }).click()
      await page.getByRole('button', { name: text.moreOptions, exact: true }).click()
      await audit(page)
      await noSidewaysScroll(page)
    })

    test('edit turn', async ({ page }) => {
      await start(page, locale)
      await page.goto('./')
      await page.getByRole('link', { name: /Turn #1/ }).click()
      await expectScreen(page, text.editTurn)
    })

    test('delete turn dialog', async ({ page }) => {
      await start(page, locale)
      await page.goto('./')
      await page.getByRole('link', { name: /Turn #1/ }).click()
      await page.getByRole('button', { name: text.delete, exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await audit(page)
      await noSidewaysScroll(page)
    })

    test('history', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/history')
      await expectScreen(page, text.history)
    })

    test('earnings', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/earnings')
      await expectScreen(page, text.earnings)
    })

    test('payday list', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/payday')
      await expectScreen(page, text.payday)
    })

    test('period', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/payday')
      await page.getByRole('link', { name: text.period }).click()
      // The heading is the localized date range, so any level-one heading will do.
      await expectScreen(page)
    })

    test('payment form', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/payday')
      await page.getByRole('link', { name: text.period }).click()
      await page.getByRole('link', { name: text.recordPayment, exact: true }).click()
      await expect(page.getByRole('heading', { level: 1, name: text.recordPayment })).toBeVisible()
      await page.getByLabel(locale === 'vi' ? 'Số tiền nhận được' : 'Amount received').first().fill('100')
      await audit(page)
      await noSidewaysScroll(page)
    })

    test('adjustment form', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/adjustment/new')
      await expectScreen(page, text.newAdjustment)
    })

    test('settings', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/settings')
      await expectScreen(page, text.settings)
    })

    test('service presets', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/settings/services')
      await expectScreen(page, text.servicePresets)
    })

    test('preset editor', async ({ page }) => {
      await start(page, locale)
      await page.goto('./#/settings/services')
      await page.getByRole('button', { name: text.addPreset, exact: true }).click()
      await expectScreen(page, text.addPreset)
    })

    test('tap targets', async ({ page }) => {
      await start(page, locale, false)

      await test.step('Add Turn', async () => {
        await page.goto('./#/add')
        await expect(page.getByRole('heading', { level: 1, name: text.addTurn })).toBeVisible()
        // A second service row is what shows the remove-service button.
        await page.getByRole('button', { name: text.addService, exact: true }).click()
        await page.getByRole('button', { name: text.moreOptions, exact: true }).click()
        expect(await smallTapTargets(page)).toEqual([])
      })

      await test.step('Today', async () => {
        await page.goto('./')
        await expect(page.getByRole('heading', { level: 1, name: text.appName })).toBeVisible()
        expect(await smallTapTargets(page)).toEqual([])
      })

      await test.step('Settings', async () => {
        await page.goto('./#/settings')
        await expect(page.getByRole('heading', { level: 1, name: text.settings })).toBeVisible()
        expect(await smallTapTargets(page)).toEqual([])
      })

      await test.step('Service presets', async () => {
        await page.goto('./#/settings/services')
        await expect(page.getByRole('heading', { level: 1, name: text.servicePresets })).toBeVisible()
        expect(await smallTapTargets(page)).toEqual([])
      })

      await test.step('Preset editor', async () => {
        await page.getByRole('button', { name: text.addPreset, exact: true }).click()
        await expect(page.getByRole('heading', { level: 1, name: text.addPreset })).toBeVisible()
        expect(await smallTapTargets(page)).toEqual([])
      })
    })

    test('iPhone input zoom', async ({ page }) => {
      await start(page, locale, false)
      await page.goto('./#/add')
      await page.getByRole('button', { name: text.moreOptions, exact: true }).click()
      const sizes = await page.evaluate(() =>
        [...document.querySelectorAll('input, select, textarea')].map((element) => parseFloat(getComputedStyle(element).fontSize)),
      )
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16)
    })
  })

  // No seedSettings: this is a first launch. Each step is audited on its own,
  // because a failure must name the step.
  test(`onboarding, all four steps (${locale})`, async ({ page }) => {
    await page.clock.setFixedTime(NOON)
    await page.addInitScript((value) => {
      localStorage.setItem('nail-tracker.settings', JSON.stringify({ locale: value }))
    }, locale)
    await page.goto('./')

    for (const [index, heading] of text.onboarding.entries()) {
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await audit(page)
      await noSidewaysScroll(page)
      if (index < text.onboarding.length - 1) {
        await page.getByRole('button', { name: text.next, exact: true }).click()
      }
    }
  })
}
