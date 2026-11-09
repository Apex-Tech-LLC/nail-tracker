import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addTurn, datePill, fixNow, seedSettings, weeklyPay } from './helpers.ts'

// Wednesday noon in Chicago, inside the week of Nov 1 to 7.
const NOON = new Date('2026-11-04T12:00:00-06:00')

// 60% commission with the given share of the pay by check, and no fees: a $100
// turn pays $60, so 70% by check is $42 check and $18 cash.
function rules(checkBp: number | null): Record<string, unknown> {
  return {
    id: 'default',
    startDate: '2000-01-01',
    supplyFee: { kind: 'none' },
    cardTipFeeBp: 0,
    checkBp,
    cardTipsPaidIn: 'split',
    guarantee: { kind: 'none' },
    tiers: null,
    createdAt: 1,
    updatedAt: 1,
  }
}

interface SavedPayment {
  id: string
  paymentDate: string
  amountCents: number
  paymentMethod: string
}
interface SavedAllocation {
  paymentId: string
  payPeriodId: string
  amountCents: number
}
interface SavedRecord {
  checkedDate: string | null
}
interface SavedRule {
  startDate: string
  cardTipFeeBp: number
}

function readStore<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<T[]>((resolve, reject) => {
        const request = indexedDB.open('nail-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction(name, 'readonly').objectStore(name).getAll()
          all.onsuccess = () => {
            database.close()
            resolve(all.result as T[])
          }
          all.onerror = () => reject(all.error)
        }
      }),
    store,
  )
}

async function seedPayRules(page: Page, record: Record<string, unknown>): Promise<void> {
  await page.goto('./')
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
  await page.evaluate(async (row) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('nail-tracker')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('payRules', 'readwrite')
        transaction.objectStore('payRules').put(row)
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
    })
  }, record)
  await page.reload()
}

/** A week with one $100 turn (unless told otherwise) and the given pay split, open on Payday. */
async function startWeek(
  page: Page,
  checkBp: number | null = 7000,
  withTurn = true,
  locale = 'en',
): Promise<void> {
  await fixNow(page, NOON)
  await seedSettings(page, { ...weeklyPay, locale })
  await seedPayRules(page, rules(checkBp))
  if (withTurn) await addTurn(page, { amount: '100' })
  await page.goto('./#/payday')
}

const exactButton = (page: Page) => page.getByRole('button', { name: /^Got exactly this/ })
const toast = (page: Page) => page.locator('div[role=status]')
const undoButton = (page: Page) => toast(page).getByRole('button', { name: 'Undo' })
const recordLink = (page: Page) => page.getByRole('link', { name: 'Record what you got', exact: true })
const formSaveButton = (page: Page) => page.locator('form').getByRole('button', { name: 'Save', exact: true })

test('one tap records the statement check and cash and marks the period checked', async ({ page }) => {
  await startWeek(page)
  await expect(exactButton(page)).toHaveText('Got exactly this: $42.00 check + $18.00 cash')
  await exactButton(page).click()

  await expect(exactButton(page)).toHaveCount(0)
  await expect(page.getByText(/^Checked /)).toBeVisible()
  await expect(toast(page)).toContainText('Marked as checked')

  const payments = await readStore<SavedPayment>(page, 'payments')
  expect(
    payments.map((payment) => [payment.paymentMethod, payment.amountCents, payment.paymentDate]).sort(),
  ).toEqual([
    ['cash', 1800, '2026-11-04'],
    ['check', 4200, '2026-11-04'],
  ])
  const allocations = await readStore<SavedAllocation>(page, 'paymentAllocations')
  expect(allocations.map((row) => row.amountCents).sort()).toEqual([1800, 4200])
  expect(new Set(allocations.map((row) => row.payPeriodId)).size).toBe(1)
  const records = await readStore<SavedRecord>(page, 'paycheckRecords')
  expect(records.map((row) => row.checkedDate)).toEqual(['2026-11-04'])
})

test('Undo removes both payments and the checked mark, and the button works again', async ({ page }) => {
  await startWeek(page)
  await exactButton(page).click()
  await expect(exactButton(page)).toHaveCount(0)

  await undoButton(page).click()
  await expect(exactButton(page)).toHaveText('Got exactly this: $42.00 check + $18.00 cash')
  expect(await readStore<SavedPayment>(page, 'payments')).toHaveLength(0)
  expect(await readStore<SavedAllocation>(page, 'paymentAllocations')).toHaveLength(0)
  const records = await readStore<SavedRecord>(page, 'paycheckRecords')
  expect(records.map((row) => row.checkedDate)).toEqual([null])

  await exactButton(page).click()
  await expect(exactButton(page)).toHaveCount(0)
  expect(await readStore<SavedPayment>(page, 'payments')).toHaveLength(2)
})

test('two fast taps record the payments once', async ({ page }) => {
  await startWeek(page)
  await exactButton(page).dblclick()
  await expect(exactButton(page)).toHaveCount(0)
  expect(await readStore<SavedPayment>(page, 'payments')).toHaveLength(2)
})

test('a part of zero is left out of the button and the payments', async ({ page }) => {
  await startWeek(page, 10_000)
  await expect(exactButton(page)).toHaveText('Got exactly this: $60.00 check')
  await exactButton(page).click()
  await expect(exactButton(page)).toHaveCount(0)
  const payments = await readStore<SavedPayment>(page, 'payments')
  expect(payments.map((payment) => [payment.paymentMethod, payment.amountCents])).toEqual([['check', 6000]])
})

test('the button is hidden when the salon pays nothing', async ({ page }) => {
  await startWeek(page, 7000, false)
  await expect(recordLink(page)).toBeVisible()
  await expect(exactButton(page)).toHaveCount(0)
})

test('the button is hidden when the pay rules have no check and cash split', async ({ page }) => {
  await startWeek(page, null)
  await expect(recordLink(page)).toBeVisible()
  await expect(exactButton(page)).toHaveCount(0)
})

test('the button is hidden once a payment exists, on Payday and on Record what you got', async ({ page }) => {
  await startWeek(page)
  await recordLink(page).click()
  await expect(exactButton(page)).toBeVisible()
  await page.getByLabel('Check amount').fill('10')
  await formSaveButton(page).click()

  await expect(recordLink(page)).toBeVisible()
  await expect(exactButton(page)).toHaveCount(0)
  await recordLink(page).click()
  await expect(page.getByLabel('Check amount')).toBeVisible()
  await expect(exactButton(page)).toHaveCount(0)
})

test('the same button on Record what you got saves and goes back to Payday', async ({ page }) => {
  await startWeek(page)
  await recordLink(page).click()
  await exactButton(page).click()

  await expect(recordLink(page)).toBeVisible()
  await expect(page.getByText(/^Checked /)).toBeVisible()
  expect(await readStore<SavedPayment>(page, 'payments')).toHaveLength(2)
})

test('the payment date row picks Yesterday on Record payment and Record what you got', async ({ page }) => {
  await startWeek(page)
  await page.getByRole('link', { name: /Nov 1 – Nov 7/ }).click()
  await page.getByRole('link', { name: 'Record payment', exact: true }).click()

  await expect(datePill(page)).toContainText('Wed 11/4')
  await page.getByRole('button', { name: 'Yesterday', exact: true }).click()
  await expect(datePill(page)).toContainText('Tue 11/3')
  await expect(page.getByLabel('Payment date')).toHaveValue('2026-11-03')
  await page.getByLabel('Amount received').first().fill('20')
  await formSaveButton(page).click()
  await expect.poll(async () => (await readStore<SavedPayment>(page, 'payments')).length).toBe(1)
  expect((await readStore<SavedPayment>(page, 'payments'))[0].paymentDate).toBe('2026-11-03')

  await page.goto('./#/payday')
  await recordLink(page).click()
  await page.getByRole('button', { name: 'Yesterday', exact: true }).click()
  await expect(datePill(page)).toContainText('Tue 11/3')
  await page.getByLabel('Cash amount').fill('5')
  await formSaveButton(page).click()
  await expect.poll(async () => (await readStore<SavedPayment>(page, 'payments')).length).toBe(2)
  const payments = await readStore<SavedPayment>(page, 'payments')
  expect(payments.find((payment) => payment.paymentMethod === 'cash')?.paymentDate).toBe('2026-11-03')
})

test('pay rules save in one tap with each start choice', async ({ page }) => {
  await fixNow(page, NOON)
  await seedSettings(page, weeklyPay)
  await page.goto('./#/settings/pay')

  const save = page.getByRole('button', { name: 'Save rules', exact: true })
  await expect(page.getByRole('button', { name: 'Start of this pay period', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByLabel('Start date')).toHaveCount(0)

  const starts = async () => (await readStore<SavedRule>(page, 'payRules')).map((rule) => rule.startDate)

  // The pay period start is chosen at first: one tap on Save rules.
  await page.getByLabel('Percent of card tips').fill('1')
  await save.click()
  await expect.poll(starts).toContain('2026-11-01')

  await page.getByLabel('Percent of card tips').fill('2')
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await save.click()
  await expect.poll(starts).toContain('2026-11-04')

  await page.getByLabel('Percent of card tips').fill('3')
  await page.getByRole('button', { name: 'Other day', exact: true }).click()
  await page.getByLabel('Start date').fill('2026-10-12')
  await save.click()
  await expect.poll(starts).toContain('2026-10-12')

  const saved = await readStore<SavedRule>(page, 'payRules')
  expect(saved.find((rule) => rule.startDate === '2026-11-01')?.cardTipFeeBp).toBe(100)
  expect(saved.find((rule) => rule.startDate === '2026-11-04')?.cardTipFeeBp).toBe(200)
  expect(saved.find((rule) => rule.startDate === '2026-10-12')?.cardTipFeeBp).toBe(300)
})

test('the button fits a 375 pixel phone in Vietnamese and passes the accessibility audit', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  // addTurn types English labels, so the turn is logged before the language changes.
  await startWeek(page)
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}')
    localStorage.setItem('nail-tracker.settings', JSON.stringify({ ...saved, locale: 'vi' }))
  })
  await page.reload()

  const button = page.getByRole('button', { name: /^Nhận đúng số này/ })
  for (const screen of ['payday', 'record'] as const) {
    if (screen === 'record') {
      await page.getByRole('link', { name: 'Ghi số tiền đã nhận', exact: true }).click()
    }
    await expect(button).toHaveText('Nhận đúng số này: $42.00 check + $18.00 tiền mặt')
    const box = await button.boundingBox()
    expect(box?.height ?? 0, screen).toBeGreaterThanOrEqual(44)
    const cutOff = await button.evaluate((element) => {
      const style = getComputedStyle(element)
      return style.textOverflow === 'ellipsis' || element.scrollWidth > element.clientWidth + 1
    })
    expect(cutOff, screen).toBe(false)

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()
    expect(violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`), screen).toEqual([])
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, screen).toBeLessThanOrEqual(0)
  }
})
