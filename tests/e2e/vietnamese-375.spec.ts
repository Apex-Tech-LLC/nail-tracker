import { expect, test, type Page } from '@playwright/test'
import { fixNow, seedSettings } from './helpers.ts'

// Noon on 2026-11-04 in Chicago, written with its offset so a UTC runner keeps the day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

const CURRENT_PERIOD = 'period-2026-11-01-2026-11-07'
const PAST_PERIOD = 'period-2026-10-25-2026-10-31'

// Everything optional is on, so every part of every screen has something to show.
const VIETNAMESE_SETTINGS = {
  locale: 'vi',
  onboardingDone: true,
  hoursOn: true,
  minimumWageCents: 1600,
  taxSetAsideBp: 2500,
  weeklyGoalCents: 50000,
  monthlyGoalCents: 200000,
  payPeriodType: 'weekly',
  payPeriodAnchorDate: '2026-11-01',
  weekStartDay: 0,
  backupReminderDays: 0,
  // So the Forget learned words button on Settings has something to show.
  learnedWords: { 'joe x': 'gel-x' },
}

interface Line {
  name: string
  priceCents: number
}

interface TurnSeed {
  id: string
  date: string
  hour: number
  clientType: 'walkIn' | 'request' | 'unspecified'
  cashTipCents: number
  cardTipCents: number
  note?: string
  lines: Line[]
}

const TURNS: TurnSeed[] = [
  {
    id: 'turn-today-1',
    date: '2026-11-04',
    hour: 10,
    clientType: 'request',
    cashTipCents: 500,
    cardTipCents: 0,
    note: 'Khách quen, thích màu hồng nhạt và móng ngắn vừa phải, hẹn lần sau vào thứ Bảy.',
    lines: [{ name: 'Manicure', priceCents: 4500 }],
  },
  {
    id: 'turn-today-2',
    date: '2026-11-04',
    hour: 14,
    clientType: 'walkIn',
    cashTipCents: 0,
    cardTipCents: 1000,
    note: 'Đắp bột dài, sơn màu trắng sữa, thêm đá nhỏ ở ngón giữa.',
    lines: [
      { name: 'Gel-X dài kèm đắp bột và sơn móng', priceCents: 12000 },
      { name: 'Sơn móng tay', priceCents: 2500 },
    ],
  },
  {
    id: 'turn-week-1',
    date: '2026-11-02',
    hour: 11,
    clientType: 'walkIn',
    cashTipCents: 800,
    cardTipCents: 0,
    lines: [{ name: 'Pedicure', priceCents: 6500 }],
  },
  {
    id: 'turn-past-1',
    date: '2026-10-27',
    hour: 12,
    clientType: 'request',
    cashTipCents: 1000,
    cardTipCents: 500,
    note: 'Làm móng tay giả cho đám cưới, cần chắc và bền.',
    lines: [{ name: 'Acrylic full set', priceCents: 15000 }],
  },
  {
    id: 'turn-past-2',
    date: '2026-10-30',
    hour: 16,
    clientType: 'unspecified',
    cashTipCents: 0,
    cardTipCents: 800,
    lines: [{ name: 'Dip powder', priceCents: 9500 }],
  },
]

const RATE_BP = 6000

/** Opens the app once so its database exists, then writes five small turns and the rest directly. */
async function seedVietnameseData(page: Page): Promise<void> {
  await page.goto('./')
  await expect(page.getByTestId('hero-earned')).toBeVisible()

  await page.evaluate(
    ({ turns, currentPeriod, pastPeriod, rate }) => {
      const now = 1
      const services: Record<string, unknown>[] = []
      const turnRows: Record<string, unknown>[] = []

      for (const turn of turns) {
        let serviceRevenue = 0
        let commission = 0
        turn.lines.forEach((line, index) => {
          const lineCommission = Math.round((line.priceCents * rate) / 10_000)
          serviceRevenue += line.priceCents
          commission += lineCommission
          services.push({
            id: `${turn.id}-service-${index}`,
            turnId: turn.id,
            servicePresetId: null,
            serviceNameSnapshot: line.name,
            servicePriceCents: line.priceCents,
            commissionRateSnapshotBp: rate,
            commissionCents: lineCommission,
            sortOrder: index,
            createdAt: now,
            updatedAt: now,
          })
        })
        const [year, month, day] = turn.date.split('-').map(Number)
        turnRows.push({
          id: turn.id,
          salonId: 'default',
          occurredAt: Date.UTC(year, month - 1, day, turn.hour),
          localWorkDate: turn.date,
          turnCount: 1,
          clientType: turn.clientType,
          ...(turn.note ? { note: turn.note } : {}),
          cashTipCents: turn.cashTipCents,
          cardTipCents: turn.cardTipCents,
          cashTipReceived: true,
          cardTipReceived: false,
          serviceRevenueTotalCents: serviceRevenue,
          commissionTotalCents: commission,
          earnedTotalCents: commission + turn.cashTipCents + turn.cardTipCents,
          createdAt: now,
          updatedAt: now,
        })
      }

      const adjustments = [
        {
          id: 'adjustment-bonus',
          occurredAt: Date.UTC(2026, 10, 2, 18),
          localWorkDate: '2026-11-02',
          amountCents: 3000,
          category: 'bonus',
          note: 'Thưởng vì giữ khách quen trong tháng lễ.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'adjustment-correction',
          occurredAt: Date.UTC(2026, 9, 27, 18),
          localWorkDate: '2026-10-27',
          amountCents: -500,
          category: 'commissionCorrection',
          note: 'Sửa lại turn bị tính sai tiền chia tuần trước.',
          createdAt: now,
          updatedAt: now,
        },
      ]

      const payments = [
        {
          id: 'payment-current',
          paymentDate: '2026-11-04',
          amountCents: 15000,
          paymentMethod: 'check',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'payment-past',
          paymentDate: '2026-10-31',
          amountCents: 20000,
          paymentMethod: 'cash',
          createdAt: now,
          updatedAt: now,
        },
      ]

      const allocations = [
        {
          id: 'allocation-current',
          paymentId: 'payment-current',
          payPeriodId: currentPeriod,
          amountCents: 15000,
        },
        {
          id: 'allocation-past',
          paymentId: 'payment-past',
          payPeriodId: pastPeriod,
          amountCents: 20000,
        },
      ]

      const workDays = [
        {
          date: '2026-11-02',
          dayOff: false,
          startTime: '09:00',
          endTime: '18:30',
          createdAt: now,
          updatedAt: now,
        },
        {
          date: '2026-11-03',
          dayOff: true,
          startTime: null,
          endTime: null,
          createdAt: now,
          updatedAt: now,
        },
      ]

      // A supply fee, a check/cash split, a per-day guarantee and three tiers.
      const payRules = {
        id: 'default',
        startDate: '2000-01-01',
        supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' },
        cardTipFeeBp: 300,
        checkBp: 5000,
        cardTipsPaidIn: 'split',
        guarantee: { kind: 'perDay', cents: 5000, minDays: null },
        tiers: {
          mode: 'eachPart',
          levels: [
            { fromCents: 0, rateBp: 5000 },
            { fromCents: 50000, rateBp: 6000 },
            { fromCents: 100000, rateBp: 7000 },
          ],
        },
        createdAt: now,
        updatedAt: now,
      }

      function write(store: string, rows: readonly Record<string, unknown>[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('nail-tracker')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const database = request.result
            const transaction = database.transaction(store, 'readwrite')
            const objectStore = transaction.objectStore(store)
            for (const row of rows) objectStore.put(row)
            transaction.oncomplete = () => {
              database.close()
              resolve()
            }
            transaction.onerror = () => reject(transaction.error)
            transaction.onabort = () => reject(transaction.error)
          }
        })
      }

      return (async () => {
        await write('turns', turnRows)
        await write('turnServices', services)
        await write('adjustments', adjustments)
        await write('payments', payments)
        await write('paymentAllocations', allocations)
        await write('workDays', workDays)
        await write('payRules', [payRules])
      })()
    },
    { turns: TURNS, currentPeriod: CURRENT_PERIOD, pastPeriod: PAST_PERIOD, rate: RATE_BP },
  )

  await page.reload()
}

/**
 * No sideways scroll, no text cut off, and only what the technician typed may
 * end in an ellipsis: service names in lists, client notes and adjustment
 * notes (marked data-testid="truncate-ok" in the row components).
 */
async function checkScreen(page: Page, name: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  const problems = await page.evaluate(() => {
    const found: string[] = []
    const root = document.documentElement
    if (root.scrollWidth > 375) {
      found.push(`page is ${root.scrollWidth}px wide, 375px allowed`)
    }

    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      if (element.closest('.sr-only')) continue
      if (element.closest('[data-testid="truncate-ok"]')) continue

      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (element.getClientRects().length === 0) continue
      const text = (element.textContent ?? '').trim()
      if (text === '') continue

      const label = `${element.tagName.toLowerCase()} "${text.slice(0, 45)}"`
      if (style.textOverflow === 'ellipsis') {
        found.push(`ellipsis: ${label}`)
      } else if (
        element.scrollWidth > element.clientWidth + 1 &&
        (style.overflowX === 'hidden' || style.overflowX === 'clip')
      ) {
        found.push(`clipped: ${label}`)
      }
    }
    return found
  })

  expect(problems, name).toEqual([])
  await page.screenshot({ path: `test-results/vi-375/${name}.png`, fullPage: true })
}

test.use({ viewport: { width: 375, height: 812 } })

test('every screen fits in Vietnamese at 375 pixels', async ({ page }) => {
  test.setTimeout(300_000)

  await fixNow(page, NOON)
  await seedSettings(page, VIETNAMESE_SETTINGS)
  await seedVietnameseData(page)

  await page.goto('./')
  await expect(page.getByTestId('hero-earned')).toBeVisible()
  // Today has no hours yet, so the Start day button is showing.
  await expect(page.getByRole('button', { name: 'Bắt đầu', exact: true })).toBeVisible()
  await expect(page.getByTestId('turn-bar').first()).toBeVisible()
  await checkScreen(page, 'home-today')

  await page.getByRole('button', { name: 'Tuần này', exact: true }).click()
  await expect(page.getByTestId('goal-progress')).toBeVisible()
  await expect(page.getByTestId('week-bottle').first()).toContainText('CN')
  await checkScreen(page, 'home-week')

  await page.getByRole('button', { name: 'Tháng này', exact: true }).click()
  await expect(page.getByTestId('month-day').first()).toBeVisible()
  await checkScreen(page, 'home-month')

  await page.goto('./#/say')
  await expect(page.getByRole('heading', { name: 'Nói turn trong ngày', exact: true })).toBeVisible()
  await checkScreen(page, 'say-your-turns')

  await page.getByRole('button', { name: 'Cách dùng', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Nói turn trong ngày' })).toBeVisible()
  await checkScreen(page, 'say-how-to')
  await page.getByRole('button', { name: 'Hiểu rồi', exact: true }).click()

  // The phone refuses to copy, so the ChatGPT instructions come up in a sheet.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new DOMException('no', 'NotAllowedError')) },
    })
  })
  await page.getByRole('button', { name: 'Dùng ChatGPT', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Hướng dẫn cho ChatGPT' })).toBeVisible()
  await checkScreen(page, 'say-chatgpt-sheet')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.locator('textarea').first().fill('Gel manicure 45, 10 tip cash\nPedicure\nblah blah')
  await page.getByRole('button', { name: 'Tạo turn', exact: true }).click()
  await expect(page.getByTestId('draft-card').first()).toBeVisible()
  await checkScreen(page, 'say-check')

  await page.getByTestId('draft-card').first().getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: 'Sửa turn này', exact: true })).toBeVisible()
  await checkScreen(page, 'say-fix-turn')

  await page.goto('./#/add')
  await page.locator('[data-pad-target^="line:"]').first().click()
  await expect(page.locator('[data-number-pad]')).toBeVisible()
  await checkScreen(page, 'add-turn-pad')

  await page.goto('./#/history')
  await expect(page.getByTestId('history-total')).toBeVisible()
  await checkScreen(page, 'history-list')

  await page.getByRole('button', { name: 'Lọc', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Lọc' })).toBeVisible()
  await checkScreen(page, 'history-filter')
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click()

  // The oldest day in the week has its hours; its sheet also offers a day off.
  await page.getByRole('button', { name: /^Thao tác cho / }).last().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await checkScreen(page, 'history-day-sheet')
  await page.getByRole('dialog').getByRole('button').first().click()
  await expect(page.getByRole('dialog', { name: /^Giờ làm ngày / })).toBeVisible()
  await checkScreen(page, 'history-hours-sheet')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Lịch', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tháng trước' })).toBeVisible()
  await checkScreen(page, 'history-calendar')

  await page.goto('./#/earnings')
  for (const [mode, shot] of [
    ['Ngày', 'reports-day'],
    ['Tuần', 'reports-week'],
    ['Tháng', 'reports-month'],
    ['Năm', 'reports-year'],
    ['Tùy chọn', 'reports-custom'],
  ] as const) {
    await page.getByRole('button', { name: mode, exact: true }).first().click()
    await expect(page.getByTestId('report-stat-turns')).toBeVisible()
    await checkScreen(page, shot)
  }

  await page.goto('./#/payday')
  await expect(page.getByRole('heading', { name: 'Lương', exact: true })).toBeVisible()
  await expect(page.getByText(/^(Đúng|Thiếu |Dư )/).first()).toBeVisible()
  await checkScreen(page, 'paycheck')

  await page.goto(`./#/payday/${PAST_PERIOD}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await checkScreen(page, 'period-past')

  await page.goto(`./#/payday/${CURRENT_PERIOD}/record`)
  await expect(page.getByRole('heading', { name: 'Ghi số tiền đã nhận', exact: true })).toBeVisible()
  await checkScreen(page, 'record-what-you-got')

  await page.goto(`./#/payday/${CURRENT_PERIOD}/pay`)
  await expect(page.getByRole('heading', { name: 'Ghi khoản đã nhận', exact: true })).toBeVisible()
  await checkScreen(page, 'payment-form')

  await page.goto('./#/adjustment/new')
  await expect(page.getByRole('heading', { name: 'Điều chỉnh mới', exact: true })).toBeVisible()
  await checkScreen(page, 'adjustment-form')

  await page.goto('./#/settings/pay')
  await expect(page.getByRole('heading', { name: 'Cách tính lương', exact: true })).toBeVisible()
  await checkScreen(page, 'how-im-paid')

  await page.goto('./#/settings/goals')
  await expect(page.getByRole('heading', { name: 'Mục tiêu', exact: true })).toBeVisible()
  await checkScreen(page, 'goals')

  await page.goto('./#/taxes/2026')
  await expect(page.getByRole('heading', { name: 'Thuế và tổng kết năm', exact: true })).toBeVisible()
  await checkScreen(page, 'taxes')

  await page.goto('./#/settings')
  await expect(page.getByRole('heading', { name: 'Cài đặt', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quên các từ đã học', exact: true })).toBeVisible()
  await checkScreen(page, 'settings')

  await page.goto('./#/settings/services')
  await expect(page.getByRole('heading', { name: 'Danh sách dịch vụ', exact: true })).toBeVisible()
  await checkScreen(page, 'services')
})

test('onboarding fits in Vietnamese at 375 pixels on a fresh app', async ({ page }) => {
  test.setTimeout(120_000)

  await fixNow(page, NOON)
  await seedSettings(page, { locale: 'vi', onboardingDone: false })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Cài đặt nhanh', exact: true })).toBeAttached()
  await checkScreen(page, 'onboarding')
  await page.getByText('Mức chia khác', { exact: true }).click()
  await expect(page.getByLabel('Tỷ lệ chia khác (%)')).toBeVisible()
  await checkScreen(page, 'onboarding-custom')
})
