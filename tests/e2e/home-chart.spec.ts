import { expect, test, type Page } from '@playwright/test'
import { addTurn, formSave, openCommission, openDateChoices, seedSettings } from './helpers.ts'

// 3pm on Wednesday 2026-11-04 in the browser's America/Chicago timezone. The
// offset is explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T15:00:00-06:00')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON)
})

/** Saves one turn on a chosen day with a 100% rate, so earned equals the amount. */
async function addEarnedOn(page: Page, date: string, amount: string): Promise<void> {
  await page.goto('./#/add')
  await openDateChoices(page)
  await page.getByRole('button', { name: 'Other day' }).click()
  await page.getByLabel('Work date').fill(date)
  await page.getByLabel('Service amount').fill(amount)
  await openCommission(page)
  await page.getByLabel('Commission %').fill('100')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()
}

/** The data helpers only speak English, so settings are changed after the data is in. */
async function changeSettings(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate((value) => {
    const saved = JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}')
    localStorage.setItem('nail-tracker.settings', JSON.stringify({ ...saved, ...value }))
  }, patch)
  await page.reload()
}

const chooseLocale = (page: Page, locale: 'en' | 'vi') => changeSettings(page, { locale })

const periodButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

test('the week shows the day name over its date under every bottle', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '45' })

  await periodButton(page, 'This week').click()
  const bottles = page.getByTestId('week-bottle')
  await expect(bottles).toHaveCount(7)
  await expect(bottles.first()).toContainText('Sun')
  await expect(bottles.first()).toContainText('11/1')
  await expect(bottles.nth(3)).toContainText('Wed')
  await expect(bottles.nth(3)).toContainText('11/4')
  await expect(bottles.last()).toContainText('Sat')
  await expect(bottles.last()).toContainText('11/7')

  await chooseLocale(page, 'vi')
  await periodButton(page, 'Tuần này').click()
  await expect(bottles.first()).toContainText('CN')
  await expect(bottles.first()).toContainText('1/11')
  await expect(bottles.nth(1)).toContainText('T2')
  await expect(bottles.last()).toContainText('T7')
  await expect(bottles.last()).toContainText('7/11')
})

test('the month shows a calendar with dollars, and a day opens History', async ({ page }) => {
  await seedSettings(page)
  await addEarnedOn(page, '2026-11-02', '640')
  await addTurn(page, { amount: '45' })

  await page.goto('./')
  await periodButton(page, 'This month').click()
  const box = page.getByTestId('month-chart-box')
  await expect(box).toContainText('November 2026')
  await expect(box.getByTestId('month-day')).toHaveCount(30)
  await expect(box.getByRole('link', { name: /^Monday, November 2 · \$640$/ })).toContainText('$640')
  await expect(box.getByRole('link', { name: /^Wednesday, November 4 · \$27$/ })).toContainText('$27')
  // A day after today is still blank.
  await expect(box.getByRole('link', { name: /^Friday, November 20$/ })).not.toContainText('$')

  await box.getByRole('link', { name: /^Monday, November 2 · / }).click()
  await expect(page).toHaveURL(/day=2026-11-02.*#\/history/)
  await expect(page.getByRole('heading', { name: 'Monday, November 2' })).toBeVisible()
})

test('the month marks a day off', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./#/history')
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('nail-tracker')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const tx = database.transaction('workDays', 'readwrite')
          tx.objectStore('workDays').put({
            date: '2026-11-03',
            dayOff: true,
            startTime: null,
            endTime: null,
            createdAt: 1,
            updatedAt: 1,
          })
          tx.oncomplete = () => {
            database.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )

  await page.goto('./')
  await periodButton(page, 'This month').click()
  await expect(
    page.getByTestId('month-chart-box').getByRole('link', { name: /^Tuesday, November 3 · Off$/ }),
  ).toContainText('Off')
})

test('today draws one bar per turn in time order, and a bar opens that turn', async ({ page }) => {
  await seedSettings(page)
  await addTurn(page, { amount: '40', cash: '10' })
  // A later time, so the second turn really comes second.
  await page.clock.setFixedTime(new Date(NOON.getTime() + 60 * 60 * 1000))
  await addTurn(page, { amount: '60' })

  const bars = page.getByTestId('turn-bar')
  await expect(bars).toHaveCount(2)
  await expect(bars.first()).toContainText('#1')
  await expect(bars.first()).toContainText('$34')
  await expect(bars.last()).toContainText('#2')
  await expect(bars.last()).toContainText('$36')

  await bars.last().click()
  await expect(page.getByRole('heading', { name: 'Edit Turn' })).toBeVisible()
  await expect(page.getByLabel('Service amount')).toHaveValue('60.00')
})

test('today folds turns past eight into one +n bar', async ({ page }) => {
  await seedSettings(page)
  for (let index = 0; index < 10; index += 1) await addTurn(page, { amount: '20' })

  await expect(page.getByTestId('turn-bar')).toHaveCount(8)
  const more = page.getByTestId('turn-bar-more')
  await expect(more).toContainText('+2')
  await more.click()
  await expect(page).toHaveURL(/day=2026-11-04.*#\/history/)
})

test('an empty day says so in the chart box', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./')

  await expect(page.getByTestId('turn-bar')).toHaveCount(0)
  await expect(page.getByTestId('today-empty')).toHaveText('No turns yet. Tap Add Turn below.')
})

test.describe('at 375 by 740', () => {
  test.use({ viewport: { width: 375, height: 740 } })

  for (const locale of ['en', 'vi'] as const) {
    test(`nothing under the chart moves between periods (${locale})`, async ({ page }) => {
      await seedSettings(page)
      await addEarnedOn(page, '2026-11-02', '640')
      await addTurn(page, { amount: '45' })
      // Goals already passed put the goal message in the room reserved for it.
      await changeSettings(page, {
        locale,
        weeklyGoalCents: 10_000,
        monthlyGoalCents: 20_000,
        dismissedReminders: {},
      })

      const periods =
        locale === 'en'
          ? ['Today', 'This week', 'This month']
          : ['Hôm nay', 'Tuần này', 'Tháng này']
      const strip = page.getByTestId('stats-strip')
      const boxes = ['today-chart-box', 'week-chart-box', 'month-chart-box']

      // The message is shown while the page opens; read it before it is gone.
      await expect(page.getByTestId('goal-message')).toBeVisible()
      const message = (await page.getByTestId('goal-message').boundingBox())!
      const goal = (await page.getByTestId('goal-progress').boundingBox())!
      const box = (await page.getByTestId(boxes[0]).boundingBox())!
      expect(message.y).toBeGreaterThanOrEqual(goal.y)
      expect(message.y + message.height).toBeLessThanOrEqual(box.y)

      const tops: number[] = []
      const heights: number[] = []
      for (const [index, name] of periods.entries()) {
        await periodButton(page, name).click()
        const chart = page.getByTestId(boxes[index])
        await expect(chart).toBeVisible()
        tops.push((await strip.boundingBox())!.y)
        heights.push((await chart.boundingBox())!.height)
      }

      expect(new Set(tops).size).toBe(1)
      expect(new Set(heights).size).toBe(1)
    })
  }
})
