import { expect, type Page } from '@playwright/test'

/** Noon on 2026-11-04 in Chicago; the offset keeps the fixed day stable on a UTC runner. */
export const SPEED_NOW = new Date('2026-11-04T12:00:00-06:00')

/** Sunday five years before the fixed day, so about 260 weekly periods exist. */
export const SPEED_ANCHOR = '2021-11-01'

/**
 * Pins the app's calendar day without Playwright's clock API: that API also
 * replaces the User Timing timeline, and the speed marks need it intact.
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

/** Settings a real five-year user has: a weekly pay schedule starting five years back. */
export const speedSettings = {
  payPeriodType: 'weekly',
  payPeriodAnchorDate: SPEED_ANCHOR,
  backupReminderDays: 0,
}

const TURNS = 20_000
const DAYS = 1826 // 2021-11-07 to 2026-11-04

/**
 * Fills the database with five years of work the way a busy technician would
 * have it: about eleven turns a day, one to three service lines each, mixed
 * cash and card tips, some adjustments and a payment most weeks. The rows are
 * written straight into IndexedDB, one transaction per table, because saving
 * 20,000 turns through the app's own form would take minutes.
 *
 * Call `seedSettings` and `page.clock.setFixedTime` before this, then expect
 * the app to create its pay periods on the first screen after the reload.
 */
export async function seedFiveYears(page: Page): Promise<void> {
  // Open the app once so the database and its upgrade exist.
  await page.goto('./')
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()

  await page.evaluate(
    async ({ count, days, anchor }) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      const isoOf = (ms: number) => {
        const date = new Date(ms)
        return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
      }
      const addDays = (iso: string, days: number) => {
        const [year, month, day] = iso.split('-').map(Number)
        return isoOf(Date.UTC(year, month - 1, day + days))
      }
      const dayDiff = (from: string, to: string) => {
        const [fy, fm, fd] = from.split('-').map(Number)
        const [ty, tm, td] = to.split('-').map(Number)
        return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
      }

      const names = ['Manicure', 'Gel-X', 'Pedicure', 'Acrylic full set', 'Dip powder', 'Nail art']
      const prices = [4500, 5500, 6500, 8000, 9500, 12000, 15000]
      const clients = ['walkIn', 'request', 'unspecified'] as const
      const services: Record<string, unknown>[] = []
      const turns: Record<string, unknown>[] = []
      const adjustments: Record<string, unknown>[] = []

      const firstDay = Date.UTC(2021, 10, 7)
      const perDay = Math.floor(count / days)
      const extraDays = count - perDay * days
      let index = 0
      let serviceIndex = 0

      for (let day = 0; day < days; day += 1) {
        const date = isoOf(firstDay + day * 86_400_000)
        const turnsToday = perDay + (day < extraDays ? 1 : 0)
        for (let n = 0; n < turnsToday && index < count; n += 1) {
          const turnId = `turn-${index}`
          const lineCount = 1 + ((day + n) % 3)
          const rateBp = 6000
          let serviceRevenue = 0
          let commissionTotal = 0

          for (let line = 0; line < lineCount; line += 1) {
            const price = prices[(index + line) % prices.length]
            const commission = Math.round((price * rateBp) / 10_000)
            serviceRevenue += price
            commissionTotal += commission
            services.push({
              id: `service-${serviceIndex}`,
              turnId,
              servicePresetId: null,
              serviceNameSnapshot: names[(index + line) % names.length],
              servicePriceCents: price,
              commissionRateSnapshotBp: rateBp,
              commissionCents: commission,
              sortOrder: line,
              createdAt: firstDay,
              updatedAt: firstDay,
            })
            serviceIndex += 1
          }

          const cashTip = index % 3 === 0 ? 500 + (index % 5) * 100 : 0
          const cardTip = index % 4 === 1 ? 800 + (index % 3) * 200 : 0
          turns.push({
            id: turnId,
            salonId: 'default',
            occurredAt: firstDay + day * 86_400_000 + (9 + (index % 10)) * 3_600_000,
            localWorkDate: date,
            turnCount: 1,
            clientType: clients[index % clients.length],
            cashTipCents: cashTip,
            cardTipCents: cardTip,
            cashTipReceived: true,
            cardTipReceived: false,
            serviceRevenueTotalCents: serviceRevenue,
            commissionTotalCents: commissionTotal,
            earnedTotalCents: commissionTotal + cashTip + cardTip,
            createdAt: firstDay,
            updatedAt: firstDay,
          })
          index += 1
        }

        if (day % 30 === 0) {
          adjustments.push({
            id: `adjustment-${day}`,
            occurredAt: firstDay + day * 86_400_000,
            localWorkDate: date,
            amountCents: day % 60 === 0 ? 3000 : -500,
            category: day % 60 === 0 ? 'bonus' : 'commissionCorrection',
            note: 'Five years of data',
            createdAt: firstDay,
            updatedAt: firstDay,
          })
        }
      }

      // A payment most weeks, each one allocated to its own weekly period.
      const today = isoOf(firstDay + days * 86_400_000)
      const payments: Record<string, unknown>[] = []
      const allocations: Record<string, unknown>[] = []
      const methods = ['check', 'cash', 'directDeposit']
      const lastPeriod = Math.floor(dayDiff(anchor, today) / 7)
      for (let periodIndex = 0; periodIndex <= lastPeriod; periodIndex += 1) {
        if (periodIndex % 10 === 3) continue
        const start = addDays(anchor, periodIndex * 7)
        const end = addDays(start, 6)
        const amountCents = 50_000 + ((periodIndex * 7919) % 60_000)
        const paymentId = `payment-${periodIndex}`
        payments.push({
          id: paymentId,
          paymentDate: end < today ? end : today,
          amountCents,
          paymentMethod: methods[periodIndex % methods.length],
          createdAt: firstDay,
          updatedAt: firstDay,
        })
        allocations.push({
          id: `allocation-${periodIndex}`,
          paymentId,
          payPeriodId: `period-${start}-${end}`,
          amountCents,
        })
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

      await write('turns', turns)
      await write('turnServices', services)
      await write('adjustments', adjustments)
      await write('payments', payments)
      await write('paymentAllocations', allocations)
    },
    { count: TURNS, days: DAYS, anchor: SPEED_ANCHOR },
  )

  await page.reload()
}
