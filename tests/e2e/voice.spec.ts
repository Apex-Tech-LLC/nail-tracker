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

/** The jobs box is the first text box; the ChatGPT answer box comes after it. */
const jobsBox = (page: Page): Locator => page.locator('textarea').first()

async function sayText(page: Page, text: string, makeName = 'Make turns'): Promise<void> {
  await jobsBox(page).fill(text)
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
  await expect(cards(page).nth(0)).toContainText('"Gel manicure 45, 10 tip cash"')
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

  await expect(page.getByRole('heading', { level: 1, name: 'Xem lại 2 turn' })).toBeVisible()
  await expect(cards(page).nth(0)).toContainText('Sơn gel tay')
  await expect(cards(page).nth(0)).toContainText('$45')
  await expect(cards(page).nth(0)).toContainText('+$10 tip cash')
  await expect(cards(page).nth(1)).toContainText(
    'Cần xem lại: Chưa có giá, tạm lấy giá thường tính là $35',
  )
  await expect(page.getByText('No price heard')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lưu 2 turn' })).toBeEnabled()
})

test('words the reader cannot place become a card that is fixed and saved with the others', async ({ page }) => {
  await startSay(page)
  await sayText(page, 'Manicure 30. blah blah')

  await expect(page.getByText('Not understood: "blah blah"')).toBeVisible()
  await page.getByRole('button', { name: 'Add as a turn' }).click()

  // The line is gone and the new card opens in the usual form, with no service yet.
  await expect(page.getByRole('heading', { level: 1, name: 'Fix this turn' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('Not understood: "blah blah"')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add as a turn' })).toHaveCount(0)
  await expect(cards(page)).toHaveCount(2)
  await expect(cards(page).nth(1)).toContainText('No service')
  await expect(cards(page).nth(1)).toContainText('"blah blah"')
  await expect(page.getByRole('button', { name: 'Save 2 turns' })).toBeDisabled()

  await cards(page).nth(1).click()
  await page.getByRole('button', { name: 'Pedicure', exact: true }).click()
  await page.getByLabel('Service amount').fill('40')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Save 2 turns' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved 2 turns' })).toBeVisible()

  const names = (await rows(page, 'turnServices')).map((service) => [service.serviceNameSnapshot, service.servicePriceCents])
  expect(names.sort()).toEqual([
    ['Manicure', 3000],
    ['Pedicure', 4000],
  ])
})

test('a ChatGPT refusal line has no Add as a turn button', async ({ page }) => {
  await startSay(page)
  await page.getByLabel("Paste ChatGPT's answer").fill(answer('{"services":[{"id":"nails","price":"20"}]}'))
  await page.getByRole('button', { name: 'Check the answer' }).click()

  await expect(page.getByText('Not understood: turn 1 has a service that is not on your list (nails)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add as a turn' })).toHaveCount(0)
})

test('a said time shows on its card and is saved', async ({ page }) => {
  await startSay(page)
  await sayText(page, 'Gel manicure 45 at 2 PM. Pedicure 35 at 2:30. Manicure 30. Acrylic fill 50 at 7.')

  await expect(cards(page)).toHaveCount(4)
  await expect(cards(page).nth(0)).toContainText('2:00 PM')
  await expect(cards(page).nth(1)).toContainText('2:30 PM')
  // No time said: the slot for its place among all the cards.
  await expect(cards(page).nth(2)).toContainText('10:30 AM')
  await expect(cards(page).nth(3)).toContainText('7:00 PM')
  await expect(cards(page).nth(3)).toContainText('Check this: Is that morning or evening?')

  // Opening the guessed card shows the time box already open.
  await cards(page).nth(3).click()
  await expect(page.getByLabel('Time')).toHaveValue('19:00')
  await page.getByLabel('Time').fill('07:00')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(cards(page).nth(3)).toContainText('7:00 AM')

  await page.getByRole('button', { name: 'Save 4 turns' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved 4 turns' })).toBeVisible()

  const times = (await rows(page, 'turns')).map((turn) => turn.occurredAt as number).sort((a, b) => a - b)
  expect(times).toEqual(
    [
      '2026-11-04T07:00:00-06:00',
      '2026-11-04T10:30:00-06:00',
      '2026-11-04T14:00:00-06:00',
      '2026-11-04T14:30:00-06:00',
    ].map((time) => new Date(time).getTime()),
  )
})

test('a time said in Vietnamese shows on its card', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await page.goto('./')
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}')
    localStorage.setItem('nail-tracker.settings', JSON.stringify({ ...saved, locale: 'vi' }))
  })
  await page.goto('./#/say')
  await page.reload()
  await sayText(page, 'Lúc hai giờ chiều, sơn gel tay bốn lăm. Làm móng chân ba lăm lúc 3 giờ rưỡi', 'Tạo turn')

  await expect(cards(page)).toHaveCount(2)
  await expect(cards(page).nth(0)).toContainText('14:00')
  await expect(cards(page).nth(1)).toContainText('15:30')
  await expect(page.getByText('Cần xem lại')).toHaveCount(0)
  await page.getByRole('button', { name: 'Lưu 2 turn' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu 2 turn' })).toBeVisible()

  const times = (await rows(page, 'turns')).map((turn) => turn.occurredAt as number).sort((a, b) => a - b)
  expect(times).toEqual(
    ['2026-11-04T14:00:00-06:00', '2026-11-04T15:30:00-06:00'].map((time) => new Date(time).getTime()),
  )
})

test('Undo after Save removes exactly those turns and leaves older turns alone', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await addTurn(page, { service: 'Pedicure', amount: '35' })
  await page.goto('./#/say')
  const older = await rows(page, 'turns')
  const olderServices = await rows(page, 'turnServices')
  expect(older).toHaveLength(1)

  await sayText(page, 'Manicure 30. Gel manicure 50, 5 tip card.')
  await page.getByRole('button', { name: 'Save 2 turns' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved 2 turns' })).toBeVisible()
  expect(await rows(page, 'turns')).toHaveLength(3)
  expect(await rows(page, 'turnServices')).toHaveLength(3)

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(async () => (await rows(page, 'turns')).length).toBe(1)
  expect(await rows(page, 'turns')).toEqual(older)
  expect(await rows(page, 'turnServices')).toEqual(olderServices)
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
  await jobsBox(page).fill('Manicure 30')
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('link', { name: 'Say your turns' }).click()
  await expect(jobsBox(page)).toHaveValue('Manicure 30')
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
  await jobsBox(page).click()

  await expect(page.getByTestId('number-pad')).toHaveCount(0)
  await expect(jobsBox(page)).not.toHaveAttribute('inputmode', /.+/)
  await page.keyboard.type('Manicure thirty')
  await expect(jobsBox(page)).toHaveValue('Manicure thirty')
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

test('the Say and Check screens make no request outside the app', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await recordOpens(page)
  await startSay(page)
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))

  await sayText(page, 'Manicure 30. Pedicure 40.')
  await expect(cards(page)).toHaveCount(2)
  await cards(page).first().click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(cards(page)).toHaveCount(2)

  // The ChatGPT choice is the one thing that goes out, and only as a tab the person opens.
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Use ChatGPT instead' }).click()
  await expect(page.getByText('Instructions copied.')).toBeVisible()
  await page.getByLabel("Paste ChatGPT's answer").fill(answer(GOOD_TURN))
  await page.getByRole('button', { name: 'Check the answer' }).click()
  await expect(cards(page)).toHaveCount(1)

  for (const url of urls) expect(url, url).toMatch(/^http:\/\/localhost:4173\/|^blob:|^data:/)
})

// ---------------------------------------------------------------------------
// Use ChatGPT instead
// ---------------------------------------------------------------------------

const GOOD_TURN =
  '{"services":[{"id":"gel-manicure","price":"45.00"}],"cashTip":"10.00","cardTip":"0","request":false}'
const answer = (...turns: string[]) => `{"turns":[${turns.join(',')}]}`

/** Replaces window.open with a recorder, so no tab opens and the call can be read back. */
async function recordOpens(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const opened: unknown[][] = []
    ;(window as unknown as { __opened: unknown[][] }).__opened = opened
    window.open = (...args: unknown[]) => {
      opened.push(args)
      return null
    }
  })
}

const opens = (page: Page) => page.evaluate(() => (window as unknown as { __opened: unknown[][] }).__opened)

test('Use ChatGPT instead copies the instructions with the services and the reply format', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await recordOpens(page)
  await startSay(page)

  await page.getByRole('button', { name: 'Use ChatGPT instead' }).click()
  await expect(page.getByText('Instructions copied.')).toBeVisible()

  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('- gel-manicure: Gel Manicure / Sơn gel tay')
  expect(copied).toContain('- pedicure: Pedicure / Làm móng chân')
  expect(copied).toContain(
    '{"turns":[{"services":[{"id":"gel-manicure","price":"45.00"}],"cashTip":"10.00","cardTip":"0","request":false}]}',
  )
  expect(copied).toContain('You reply: ')
  // Copied fine, so there is no box to copy by hand.
  await expect(page.getByLabel('Instructions for ChatGPT')).toHaveCount(0)
})

test('Use ChatGPT instead opens ChatGPT in a new tab', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await recordOpens(page)
  await startSay(page)

  await page.getByRole('button', { name: 'Use ChatGPT instead' }).click()

  await expect.poll(() => opens(page)).toEqual([['https://chatgpt.com', '_blank', 'noopener,noreferrer']])
})

test('when the clipboard fails the instructions are shown to copy by hand', async ({ page }) => {
  await recordOpens(page)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new DOMException('no', 'NotAllowedError')) },
    })
  })
  await startSay(page)

  await page.getByRole('button', { name: 'Use ChatGPT instead' }).click()

  const box = page.getByLabel('Instructions for ChatGPT')
  await expect(box).toBeVisible()
  await expect(box).toHaveAttribute('readonly', '')
  await expect(box).toHaveValue(/- gel-manicure: Gel Manicure \/ Sơn gel tay/)
  await expect(page.getByText('Instructions copied.')).toHaveCount(0)
  // The person is still here to copy it: ChatGPT opens only when they ask.
  expect(await opens(page)).toEqual([])

  await page.getByRole('button', { name: 'Select all' }).click()
  const selected = await page.evaluate(() => {
    const area = document.activeElement as HTMLTextAreaElement
    return area.value.slice(area.selectionStart, area.selectionEnd)
  })
  expect(selected).toBe(await box.inputValue())

  await page.getByRole('button', { name: 'Open ChatGPT' }).click()
  expect(await opens(page)).toHaveLength(1)
})

test('a good ChatGPT answer becomes cards and saves', async ({ page }) => {
  await startSay(page)
  await page.getByRole('button', { name: 'Yesterday' }).click()
  const reply = [
    'Here you go:',
    '```json',
    answer(
      GOOD_TURN,
      '{"services":[{"id":"pedicure","price":null}],"cashTip":"0","cardTip":"8.50","request":true,"extra":1}',
    ),
    '```',
    'Anything else?',
  ].join('\n')
  await page.getByLabel("Paste ChatGPT's answer").fill(reply)
  await page.getByRole('button', { name: 'Check the answer' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Check 2 turns' })).toBeVisible()
  await expect(cards(page).nth(0)).toContainText('Gel Manicure')
  await expect(cards(page).nth(0)).toContainText('$45')
  await expect(cards(page).nth(0)).toContainText('+$10 cash tip')
  await expect(cards(page).nth(1)).toContainText('Pedicure')
  await expect(cards(page).nth(1)).toContainText('+$8.50 card tip')
  await expect(cards(page).nth(1)).toContainText('Request')
  // No price said and no usual price yet: the card is marked and Save waits for a price.
  await expect(cards(page).nth(1)).toContainText('Check this: No price heard for Pedicure: enter the price')
  expect(await rows(page, 'turns')).toHaveLength(0)

  await cards(page).nth(1).click()
  await page.getByLabel('Service amount').fill('35')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Save 2 turns' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved 2 turns' })).toBeVisible()

  const turns = await rows(page, 'turns')
  expect(turns).toHaveLength(2)
  expect(turns.every((turn) => turn.localWorkDate === '2026-11-03')).toBe(true)
  // At 60%: $27 + $10, then $21 + $8.50.
  expect(turns.reduce((sum, turn) => sum + (turn.earnedTotalCents as number), 0)).toBe(
    2700 + 1000 + 2100 + 850,
  )
})

test('a ChatGPT answer that cannot be checked shows Not understood and is never saved', async ({ page }) => {
  await startSay(page)
  await page
    .getByLabel("Paste ChatGPT's answer")
    .fill(
      answer('{"services":[{"id":"manicure","price":"forty-ish"}]}', '{"services":[{"id":"nails","price":"20"}]}'),
    )
  await page.getByRole('button', { name: 'Check the answer' }).click()

  await expect(
    page.getByText('Not understood: turn 1 has a price that is not dollars and cents (forty-ish)'),
  ).toBeVisible()
  await expect(
    page.getByText('Not understood: turn 2 has a service that is not on your list (nails)'),
  ).toBeVisible()
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save 0 turns' })).toBeDisabled()
  expect(await rows(page, 'turns')).toHaveLength(0)

  // Text that is not an answer at all is refused too, and never put into the page as markup.
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByLabel("Paste ChatGPT's answer").fill('<img src=x onerror="document.title=\'hacked\'"> sorry')
  await page.getByRole('button', { name: 'Check the answer' }).click()
  await expect(page.getByText('Not understood: no JSON block was found in the answer')).toBeVisible()
  await expect(page.locator('img[src="x"]')).toHaveCount(0)
  expect(await page.title()).not.toBe('hacked')
})

test('the ChatGPT labels and reasons are in Vietnamese', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await page.goto('./')
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}')
    localStorage.setItem('nail-tracker.settings', JSON.stringify({ ...saved, locale: 'vi' }))
  })
  await page.goto('./#/say')
  await page.reload()

  await expect(page.getByRole('button', { name: 'Dùng ChatGPT' })).toBeVisible()
  await page.getByLabel('Dán câu trả lời của ChatGPT').fill(answer('{"services":[{"id":"x"}]}'))
  await page.getByRole('button', { name: 'Kiểm tra câu trả lời' }).click()
  await expect(
    page.getByText('Chưa hiểu: dịch vụ ở turn 1 chưa có trong danh sách (x)'),
  ).toBeVisible()
})

const howTo = (page: Page, name: string): Locator => page.getByRole('dialog', { name })

const howToSeen = (page: Page): Promise<unknown> =>
  page.evaluate(() => JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}').sayHowToSeen)

test('the how-to opens the first time in English, closes with Got it and does not come back', async ({ page }) => {
  await startSay(page, { sayHowToSeen: false })

  const sheet = howTo(page, 'Say your turns')
  await expect(sheet).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Say your turns' })).toBeVisible()
  await expect(sheet.getByRole('heading', { level: 2, name: 'Say your turns' })).toBeVisible()
  await expect(sheet.getByRole('listitem')).toHaveCount(9)
  await expect(sheet.getByText('Tap the mic on your phone’s keyboard. Say the day’s jobs in order.')).toBeVisible()
  await expect(sheet.getByText('Nail Tracker keeps your words on this phone and sends nothing.')).toBeVisible()
  await expect(sheet.getByText('“Gel manicure 45, 10 tip cash.”')).toBeVisible()
  await expect(sheet.getByText('“Pedicure 35, tip 8 on card.”')).toBeVisible()
  await expect(sheet.getByText('“Acrylic fill 45, she asked for me.”')).toBeVisible()
  expect(await howToSeen(page)).toBeFalsy()

  await sheet.getByRole('button', { name: 'Got it', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  expect(await howToSeen(page)).toBe(true)
  await expect(jobsBox(page)).toBeFocused()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Say your turns' })).toBeVisible()
  await expect(sheet).toHaveCount(0)
})

test('the how-to opens the first time in Vietnamese', async ({ page }) => {
  await startSay(page, { locale: 'vi', sayHowToSeen: false })

  const sheet = howTo(page, 'Nói turn trong ngày')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('heading', { level: 2, name: 'Nói turn trong ngày' })).toBeVisible()
  await expect(sheet.getByText('Hoặc bấm Dùng ChatGPT. Dán hướng dẫn, nói chuyện, rồi dán câu trả lời về đây.')).toBeVisible()
  await expect(sheet.getByText('“Dặm bột bốn lăm, khách gọi tên.”')).toBeVisible()

  await sheet.getByRole('button', { name: 'Hiểu rồi', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  expect(await howToSeen(page)).toBe(true)
})

test('Escape closes the how-to and counts as seen, also after Check and back', async ({ page }) => {
  await startSay(page, { sayHowToSeen: false })

  const sheet = howTo(page, 'Say your turns')
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  expect(await howToSeen(page)).toBe(true)
  await expect(jobsBox(page)).toBeFocused()

  await sayText(page, 'Gel manicure 45, 10 tip cash.')
  await expect(page.getByRole('heading', { level: 1, name: 'Check 1 turn' })).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Say your turns' })).toBeVisible()
  await expect(sheet).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Say your turns' })).toBeVisible()
  await expect(sheet).toHaveCount(0)
})

test('How it works opens the how-to again and every way of closing it gives focus back to the link', async ({ page }) => {
  await startSay(page, { sayHowToSeen: true })

  const sheet = howTo(page, 'Say your turns')
  const link = page.getByRole('button', { name: 'How it works', exact: true })
  await expect(sheet).toHaveCount(0)

  await link.click()
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Got it', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(link).toBeFocused()

  await link.click()
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(link).toBeFocused()

  await link.click()
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(link).toBeFocused()

  await link.click()
  await expect(sheet).toBeVisible()
  await page.mouse.click(190, 40)
  await expect(sheet).toHaveCount(0)
  await expect(link).toBeFocused()
  expect(await howToSeen(page)).toBe(true)
})

const learnedWords = (page: Page): Promise<unknown> =>
  page.evaluate(() => JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}').learnedWords ?? {})

test('"Joe X 65" makes a Gel-X card with Check this', async ({ page }) => {
  await startSay(page)
  await sayText(page, 'Joe X 65 tip 10 cash')

  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Gel-X')
  await expect(cards(page).first()).toContainText('$65')
  await expect(cards(page).first()).toContainText('+$10 cash tip')
  await expect(cards(page).first()).toContainText('Check this')
  await expect(cards(page).first()).toContainText('Joe X')
  await expect(page.getByRole('button', { name: 'Save 1 turn' })).toBeEnabled()
})

test('fixing a card teaches the words, and the same words then match with no check', async ({ page }) => {
  await startSay(page)
  await sayText(page, 'Manicure 30. blah blah')
  await page.getByRole('button', { name: 'Add as a turn' }).click()
  await page.getByRole('button', { name: 'Pedicure', exact: true }).click()
  await page.getByLabel('Service amount').fill('40')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(cards(page)).toHaveCount(2)
  await expect.poll(() => learnedWords(page)).toEqual({ 'blah blah': 'pedicure' })

  await page.goto('./#/say')
  await sayText(page, 'blah blah 45')
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Pedicure')
  await expect(cards(page).first()).toContainText('$45')
  await expect(cards(page).first()).not.toContainText('Check this')
})

test('a guessed card fixed to another service is learned too, and one fixed to nothing new is not', async ({ page }) => {
  await startSay(page)
  await sayText(page, 'Joe X 65')
  // Opened and saved with the same service the reader chose: nothing to learn.
  await cards(page).first().click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(cards(page)).toHaveCount(1)
  await expect.poll(() => learnedWords(page)).toEqual({})

  await cards(page).first().click()
  await selectServices(page, ['Gel Pedicure'])
  await page.getByLabel('Service amount').fill('65')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect.poll(() => learnedWords(page)).toEqual({ 'joe x': 'gel-pedicure' })

  await page.goto('./#/say')
  await sayText(page, 'Joe X 65')
  await expect(cards(page).first()).toContainText('Gel Pedicure')
  await expect(cards(page).first()).not.toContainText('Check this')
})

test('Forget learned words clears what was learned, after a confirm', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page, { learnedWords: { 'blah blah': 'pedicure' } })
  await page.goto('./#/settings')

  await page.getByRole('button', { name: 'Forget learned words' }).click()
  const dialog = page.getByRole('dialog', { name: 'Forget learned words?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect(await learnedWords(page)).toEqual({ 'blah blah': 'pedicure' })

  await page.getByRole('button', { name: 'Forget learned words' }).click()
  await dialog.getByRole('button', { name: 'Forget learned words' }).click()
  await expect(page.getByRole('button', { name: 'Forget learned words' })).toHaveCount(0)
  expect(await learnedWords(page)).toEqual({})

  await page.goto('./#/say')
  await sayText(page, 'blah blah 45')
  await expect(page.getByText('Not understood: "blah blah"')).toBeVisible()
})

test('the Settings button is not shown while nothing is learned', async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
  await page.goto('./#/settings')
  await expect(page.getByRole('heading', { name: 'Manage service presets' }).or(page.getByRole('link', { name: 'Manage service presets' }))).toBeVisible()
  await expect(page.getByRole('button', { name: 'Forget learned words' })).toHaveCount(0)
})
