import { expect, test, type Locator, type Page } from '@playwright/test'
import { addTurn, formSave, openCommission, seedSettings, selectServices } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')

interface Row {
  [key: string]: unknown
}

/** Every row of one table, read straight from the database the app writes to. */
async function rows(page: Page, store: 'turns' | 'turnServices'): Promise<Row[]> {
  return page.evaluate(
    (name) =>
      new Promise<Row[]>((resolve, reject) => {
        const open = indexedDB.open('nail-tracker')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const request = database.transaction(name).objectStore(name).getAll()
          request.onsuccess = () => {
            database.close()
            resolve(request.result as Row[])
          }
          request.onerror = () => reject(request.error)
        }
      }),
    store,
  )
}

async function startSay(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page, overrides)
  await page.goto('./#/say')
}

async function sayText(page: Page, text: string, makeName = 'Make turns'): Promise<void> {
  await page.locator('textarea').fill(text)
  await page.getByRole('button', { name: makeName, exact: true }).click()
}

const cards = (page: Page): Locator => page.getByTestId('draft-card')

test('Home and Add turn both open the Say screen', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await page.goto('./')

  await page.getByRole('link', { name: 'Say your turns' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Say your turns' })).toBeVisible()
  await expect(
    page.getByText('Tap the mic on your keyboard and say each job: service, price, tip.'),
  ).toBeVisible()

  await page.goto('./#/add')
  await page.getByRole('link', { name: 'Say your turns' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Say your turns' })).toBeVisible()
})

test('two jobs said become two cards with the total earned', async ({ page }) => {
  await startSay(page)
  await sayText(page, 'Gel manicure 45, 10 tip cash. Pedicure 35.')

  await expect(page.getByRole('heading', { level: 1, name: 'Check 2 turns' })).toBeVisible()
  await expect(cards(page)).toHaveCount(2)
  await expect(cards(page).nth(0)).toContainText('Gel Manicure')
  await expect(cards(page).nth(0)).toContainText('$45')
  await expect(cards(page).nth(0)).toContainText('+$10 cash tip')
  await expect(cards(page).nth(0)).toContainText('9:00 AM')
  await expect(cards(page).nth(0)).toContainText('"Gel manicure 45, 10')
  await expect(cards(page).nth(1)).toContainText('Pedicure')
  await expect(cards(page).nth(1)).toContainText('$35')
  await expect(cards(page).nth(1)).toContainText('9:45 AM')

  // At 60%: $27 + $10 + $21.
  await expect(page.getByTestId('voice-total')).toHaveText('$58.00')
  await expect(page.getByRole('button', { name: 'Save 2 turns' })).toBeEnabled()
})

test('a service with no price uses the usual price and is marked', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await addTurn(page, { service: 'Pedicure', amount: '35' })
  await page.goto('./#/say')
  await sayText(page, 'pedicure')

  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('$35')
  await expect(cards(page).first()).toContainText('Check this: No price heard, used your usual $35')
  await expect(page.getByRole('button', { name: 'Save 1 turn' })).toBeEnabled()
})

test('Vietnamese words are read and every reason is in Vietnamese', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await addTurn(page, { service: 'Pedicure', amount: '35' })
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}')
    localStorage.setItem('nail-tracker.settings', JSON.stringify({ ...saved, locale: 'vi' }))
  })
  await page.goto('./#/say')
  await page.reload()
  await sayText(page, 'Sơn gel tay bốn mươi lăm, tip mười đô. Làm móng chân', 'Tạo turn')

  await expect(page.getByRole('heading', { level: 1, name: 'Kiểm tra 2 turn' })).toBeVisible()
  await expect(cards(page).nth(0)).toContainText('Sơn gel tay')
  await expect(cards(page).nth(0)).toContainText('$45')
  await expect(cards(page).nth(0)).toContainText('+$10 tip tiền mặt')
  await expect(cards(page).nth(1)).toContainText(
    'Cần xem lại: Chưa nghe thấy giá, đã dùng giá quen thuộc $35',
  )
  await expect(page.getByText('No price heard')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lưu 2 turn' })).toBeEnabled()
})

test('words the reader cannot place can be added by hand', async ({ page }) => {
  await startSay(page)
  await sayText(page, 'Manicure 30. blah blah')

  await expect(page.getByText('Not understood: "blah blah"')).toBeVisible()
  await page.getByRole('button', { name: 'Add as a turn' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Add Turn' })).toBeVisible()
})

test('Save writes every draft on the chosen day, and nothing before', async ({ page }) => {
  await startSay(page)
  await page.getByRole('button', { name: 'Yesterday' }).click()
  await sayText(page, 'Manicure 30. Pedicure 40, 5 tip card. Gel manicure 50.')

  await expect(cards(page)).toHaveCount(3)
  await expect(page.getByText('Yesterday, Nov 3')).toBeVisible()
  expect(await rows(page, 'turns')).toHaveLength(0)
  expect(await rows(page, 'turnServices')).toHaveLength(0)

  // A double tap saves once.
  await page.getByRole('button', { name: 'Save 3 turns' }).dblclick()
  await expect(page.getByRole('status').filter({ hasText: 'Saved 3 turns · you earn $' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Say your turns' })).toBeVisible()

  const turns = await rows(page, 'turns')
  expect(turns).toHaveLength(3)
  expect(turns.every((turn) => turn.localWorkDate === '2026-11-03')).toBe(true)
  expect(turns.reduce((sum, turn) => sum + (turn.earnedTotalCents as number), 0)).toBe(
    1800 + 2400 + 500 + 3000,
  )

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'Yesterday' }).click()
  await expect(page.getByTestId('turn-row')).toHaveCount(3)
})

test('the text and drafts survive leaving and coming back', async ({ page }) => {
  await startSay(page)
  await page.locator('textarea').fill('Manicure 30')
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('link', { name: 'Say your turns' }).click()
  await expect(page.locator('textarea')).toHaveValue('Manicure 30')
})

test('Remove drops a card and the total follows', async ({ page }) => {
  await startSay(page)
  await sayText(page, 'Manicure 30. Pedicure 40.')
  await expect(page.getByTestId('voice-total')).toHaveText('$42.00')

  await page.getByRole('button', { name: 'Remove turn 1' }).click()

  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Pedicure')
  await expect(page.getByTestId('voice-total')).toHaveText('$24.00')
  await expect(page.getByRole('button', { name: 'Save 1 turn' })).toBeEnabled()
})

test('a draft opens in the Add turn form; cancelling changes nothing, Done keeps the fix', async ({
  page,
}) => {
  await startSay(page)
  await sayText(page, 'Manicure 30, 5 tip cash')

  await cards(page).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fix this turn' })).toBeVisible()
  await expect(page.getByLabel('Service amount')).toHaveValue('30.00')
  await expect(page.getByLabel('Cash tip')).toHaveValue('5.00')
  // No way to delete, copy or save and add another a turn that does not exist yet.
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Copy again' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save & Add Another' })).toHaveCount(0)

  await page.getByLabel('Service amount').fill('99')
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(cards(page).first()).toContainText('$30')
  await expect(page.getByTestId('voice-total')).toHaveText('$23.00')

  await cards(page).first().click()
  await page.getByLabel('Service amount').fill('50')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Check 1 turn' })).toBeVisible()
  await expect(cards(page).first()).toContainText('$50')
  await expect(page.getByTestId('voice-total')).toHaveText('$35.00')

  expect(await rows(page, 'turns')).toHaveLength(0)
})

test('the number pad setting does not touch the Say box', async ({ page }) => {
  await startSay(page, { numberPad: true })
  await page.locator('textarea').click()

  await expect(page.getByTestId('number-pad')).toHaveCount(0)
  await expect(page.locator('textarea')).not.toHaveAttribute('inputmode', /.+/)
  await page.keyboard.type('Manicure thirty')
  await expect(page.locator('textarea')).toHaveValue('Manicure thirty')
})

test('a service with no price blocks Save until it is fixed', async ({ page }) => {
  await startSay(page)
  await sayText(page, 'Manicure 30. Pedicure')

  await expect(cards(page).nth(1)).toContainText('No price')
  await expect(cards(page).nth(1)).toContainText('Check this: No price heard for Pedicure: enter the price')
  await expect(page.getByRole('button', { name: 'Save 2 turns' })).toBeDisabled()
  await expect(page.getByText('Fix or remove the orange turns first.')).toBeVisible()

  await cards(page).nth(1).click()
  await page.getByLabel('Service amount').fill('40')
  await page.getByRole('button', { name: 'Done', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Save 2 turns' })).toBeEnabled()
  await expect(page.getByText('Fix or remove the orange turns first.')).toHaveCount(0)
  await expect(page.getByTestId('voice-total')).toHaveText('$42.00')
})

test('the Add turn form saves a turn exactly as before', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page, { defaultCommissionRateBp: 5000, cashTipHandling: 'fromSalon' })
  await page.goto('./#/add')
  await selectServices(page, ['Manicure', 'Pedicure'])
  await page.getByLabel('Service amount').first().fill('40')
  await page.getByLabel('Service amount').last().fill('35.50')
  await openCommission(page)
  await page.getByLabel('Commission %').fill('55')
  await page.getByLabel('Cash tip').fill('7')
  await page.getByLabel('Card tip').fill('3.25')
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByLabel('Time').fill('14:30')
  await page.getByRole('button', { name: 'Request', exact: true }).click()
  await formSave(page).click()
  await expect(page.getByRole('link', { name: 'Add Turn' })).toBeVisible()

  const [turn] = await rows(page, 'turns')
  expect(turn).toMatchObject({
    localWorkDate: '2026-11-04',
    occurredAt: new Date('2026-11-04T14:30:00-06:00').getTime(),
    turnCount: 1,
    clientType: 'request',
    cashTipCents: 700,
    cardTipCents: 325,
    cashTipReceived: false,
    cardTipReceived: false,
    serviceRevenueTotalCents: 7550,
    commissionTotalCents: 2200 + 1953,
    earnedTotalCents: 2200 + 1953 + 700 + 325,
  })
  const services = (await rows(page, 'turnServices')).sort(
    (a, b) => (a.sortOrder as number) - (b.sortOrder as number),
  )
  expect(services.map((service) => [service.serviceNameSnapshot, service.servicePriceCents, service.commissionRateSnapshotBp])).toEqual([
    ['Manicure', 4000, 5500],
    ['Pedicure', 3550, 5500],
  ])
})

test('the Say and Check screens make no request outside the app', async ({ page }) => {
  await startSay(page)
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))

  await sayText(page, 'Manicure 30. Pedicure 40.')
  await expect(cards(page)).toHaveCount(2)
  await cards(page).first().click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(cards(page)).toHaveCount(2)

  for (const url of urls) expect(url, url).toMatch(/^http:\/\/localhost:4173\/|^blob:|^data:/)
})
