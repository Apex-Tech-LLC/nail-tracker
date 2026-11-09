import { expect, test, type Locator, type Page } from '@playwright/test'
import { commissionPill, datePill, fixNow, formSave, openCommission, seedSettings, weeklyPay } from './helpers.ts'

/*
 * Audit of every selection control, used the way a person uses it: open the
 * screen fresh, look at what is already chosen, tap once, save, then read what
 * was really stored (IndexedDB and localStorage) and check it after a reload.
 * Nothing here imports `selectServices`, which un-taps chips no person would.
 * The plain service chips are covered elsewhere; these tests only touch them
 * to read the starting choice.
 */

// Noon on Friday 2026-11-06 in Chicago. The offset is explicit so a machine
// running in UTC cannot move the day. A Sunday-start week is Nov 1 to Nov 7.
const NOON = new Date('2026-11-06T12:00:00-06:00')
const TODAY = '2026-11-06'
const YESTERDAY = '2026-11-05'

interface SavedService {
  servicePresetId: string | null
  serviceNameSnapshot: string
  servicePriceCents: number
  commissionRateSnapshotBp: number
  commissionCents: number
  sortOrder: number
}

interface SavedTurn {
  id: string
  localWorkDate: string
  occurredAt: number
  createdAt: number
  turnCount: number
  clientType: string
  note?: string
  cashTipCents: number
  cardTipCents: number
  cashTipReceived: boolean
  cardTipReceived: boolean
  serviceRevenueTotalCents: number
  commissionTotalCents: number
  earnedTotalCents: number
  services: SavedService[]
}

interface SavedAdjustment {
  id: string
  localWorkDate: string
  amountCents: number
  category: string
  note?: string
}

interface SavedPayment {
  id: string
  paymentDate: string
  amountCents: number
  paymentMethod: string
}

interface SavedPayRules {
  id: string
  startDate: string
  checkBp: number | null
  cardTipsPaidIn: string
  cardTipFeeBp: number
  supplyFee: { kind: string; cents?: number; bp?: number; when?: string }
}

/** Opens the app database, reads one whole store, and closes it again. */
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

/** Every saved turn, oldest saved first, each with its service rows in order. */
async function savedTurns(page: Page): Promise<SavedTurn[]> {
  const turns = await readStore<Omit<SavedTurn, 'services'>>(page, 'turns')
  const services = await readStore<SavedService & { turnId: string }>(page, 'turnServices')
  return turns
    .map((turn) => ({
      ...turn,
      services: services
        .filter((service) => service.turnId === turn.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

/** The saved settings exactly as the phone stores them. */
function savedSettings(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}'))
}

interface SeedLine {
  presetId: string
  name: string
  cents: number
  rateBp?: number
}

interface SeedTurn {
  date?: string
  /** Minutes after 09:00 local, so the order inside a day is fixed. */
  minute?: number
  lines: SeedLine[]
  cash?: number
  card?: number
  cashReceived?: boolean
  cardReceived?: boolean
  client?: 'unspecified' | 'walkIn' | 'request'
  count?: number
  note?: string
}

/**
 * Writes turns straight into the database, then reloads so the screens read
 * them. Seeding by hand keeps the setup out of the form being audited.
 */
async function seedTurns(page: Page, turns: SeedTurn[]): Promise<void> {
  await page.goto('./')
  await page.waitForFunction(async () => {
    const names = (await indexedDB.databases()).map((item) => item.name)
    return names.includes('nail-tracker')
  })
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const request = indexedDB.open('nail-tracker')
            request.onsuccess = () => {
              const has = request.result.objectStoreNames.contains('turns')
              request.result.close()
              resolve(has)
            }
            request.onerror = () => resolve(false)
          }),
      ),
    )
    .toBe(true)

  await page.evaluate(
    (items) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('nail-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction(['turns', 'turnServices'], 'readwrite')
          items.forEach((item, index) => {
            const date = item.date ?? '2026-11-06'
            const when = new Date(`${date}T09:00:00-06:00`).getTime() + (item.minute ?? index) * 60_000
            const id = `seed-${index}-${Math.random().toString(36).slice(2)}`
            const lines = item.lines.map((line) => {
              const rate = line.rateBp ?? 6000
              return { ...line, rate, commission: Math.round((line.cents * rate) / 10_000) }
            })
            const revenue = lines.reduce((sum, line) => sum + line.cents, 0)
            const commission = lines.reduce((sum, line) => sum + line.commission, 0)
            const cash = item.cash ?? 0
            const card = item.card ?? 0
            transaction.objectStore('turns').put({
              id,
              salonId: 'default',
              occurredAt: when,
              localWorkDate: date,
              turnCount: item.count ?? 1,
              clientType: item.client ?? 'unspecified',
              ...(item.note ? { note: item.note } : {}),
              cashTipCents: cash,
              cardTipCents: card,
              cashTipReceived: item.cashReceived ?? true,
              cardTipReceived: item.cardReceived ?? false,
              serviceRevenueTotalCents: revenue,
              commissionTotalCents: commission,
              earnedTotalCents: commission + cash + card,
              createdAt: when,
              updatedAt: when,
            })
            lines.forEach((line, lineIndex) => {
              transaction.objectStore('turnServices').put({
                id: `${id}-line-${lineIndex}`,
                turnId: id,
                servicePresetId: line.presetId,
                serviceNameSnapshot: line.name,
                servicePriceCents: line.cents,
                commissionRateSnapshotBp: line.rate,
                commissionCents: line.commission,
                sortOrder: lineIndex,
                createdAt: when,
                updatedAt: when,
              })
            })
          })
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          transaction.onerror = () => reject(transaction.error)
        }
      }),
    turns,
  )
  await page.reload()
}

/** Gives one service preset a usual price and, optionally, its own usual commission. */
async function setPreset(
  page: Page,
  id: string,
  patch: { defaultPriceCents?: number | null; defaultCommissionRateBp?: number | null },
): Promise<void> {
  await page.goto('./')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const request = indexedDB.open('nail-tracker')
            request.onsuccess = () => {
              const has = request.result.objectStoreNames.contains('servicePresets')
              request.result.close()
              resolve(has)
            }
            request.onerror = () => resolve(false)
          }),
      ),
    )
    .toBe(true)
  await page.evaluate(
    ({ id: presetId, patch: change }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('nail-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction('servicePresets', 'readwrite')
          const store = transaction.objectStore('servicePresets')
          const get = store.get(presetId)
          get.onsuccess = () => store.put({ ...get.result, ...change })
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          transaction.onerror = () => reject(transaction.error)
        }
      }),
    { id, patch },
  )
}

/** Fixed day, then the starting settings. The number pad is off unless a test asks for it. */
async function start(page: Page, settings: Record<string, unknown> = {}): Promise<void> {
  await fixNow(page, NOON)
  await seedSettings(page, { numberPad: false, ...settings })
}

/** The group of service chips, in any language. */
function chips(page: Page): Locator {
  return page.locator('[role="group"]:has(button[data-service-name])')
}

/** Names of the service chips that look pressed right now. */
async function pressedServices(page: Page): Promise<string[]> {
  await chips(page).locator('button').first().waitFor()
  return chips(page)
    .locator('button[aria-pressed="true"]')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-service-name') ?? ''))
}

/** Taps a chip the way a person does, once, with no un-tapping first. */
async function tapChip(page: Page, name: string): Promise<void> {
  await chips(page).locator(`button[data-service-name="${name}"]`).click()
}

async function saveAndWaitForHome(page: Page): Promise<void> {
  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
}

/** The tip box buttons ($5 $10 $15 $20 18%). */
function tipButton(page: Page, label: string): Locator {
  return page.getByRole('button', { name: label, exact: true })
}

function cashTip(page: Page): Locator {
  return page.getByLabel('Cash tip', { exact: true })
}

function cardTip(page: Page): Locator {
  return page.getByLabel('Card tip', { exact: true })
}

function byDate(turns: SavedTurn[], date: string): SavedTurn {
  const found = turns.find((turn) => turn.localWorkDate === date)
  if (!found) throw new Error(`no saved turn on ${date}`)
  return found
}

function amountBox(page: Page): Locator {
  return page.getByLabel('Service amount')
}

async function openMoreOptions(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'More options', exact: true }).click()
}

const seedPedicureLast = { lastServicePresetId: 'pedicure' }

// ---------------------------------------------------------------------------
// Add turn
// ---------------------------------------------------------------------------

test('Add turn opens on the last-used service with its usual price, today, and nothing else chosen', async ({
  page,
}) => {
  await start(page, seedPedicureLast)
  await setPreset(page, 'pedicure', { defaultPriceCents: 4500 })
  await page.goto('./#/add')

  expect(await pressedServices(page)).toEqual(['Pedicure'])
  // The chip shows a usual price, so the box must already hold it.
  await expect(chips(page).locator('button[data-service-name="Pedicure"]')).toContainText('$45')
  await expect(amountBox(page)).toHaveValue('45.00')

  await expect(datePill(page)).toContainText('Fri 11/6')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 60%')
  await expect(cashTip(page)).toHaveValue('')
  await expect(cardTip(page)).toHaveValue('')
  // The tip buttons start on Cash, and none of the amounts is pressed.
  await expect(page.getByRole('button', { name: 'Cash', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Card', exact: true })).toHaveAttribute('aria-pressed', 'false')
  for (const label of ['$5', '$10', '$15', '$20', '18%']) {
    await expect(tipButton(page, label)).toHaveAttribute('aria-pressed', 'false')
  }
  for (const label of ['Walk-in', 'Request']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'false')
  }
  await openMoreOptions(page)
  await expect(page.getByLabel('Turn count')).toHaveValue('1')
})

test('saving the untouched pre-chosen service stores that service, its price, and the default rate', async ({
  page,
}) => {
  await start(page, seedPedicureLast)
  await setPreset(page, 'pedicure', { defaultPriceCents: 4500 })
  await page.goto('./#/add')

  await saveAndWaitForHome(page)

  const [turn] = await savedTurns(page)
  expect(turn.services.map((service) => service.serviceNameSnapshot)).toEqual(['Pedicure'])
  expect(turn.services[0].servicePriceCents).toBe(4500)
  expect(turn.services[0].commissionRateSnapshotBp).toBe(6000)
  expect(turn.earnedTotalCents).toBe(2700)
})

test('a service that was last charged at $50 comes back with $50 in the box', async ({ page }) => {
  await start(page, seedPedicureLast)
  await seedTurns(page, [{ date: YESTERDAY, lines: [{ presetId: 'pedicure', name: 'Pedicure', cents: 5000 }] }])
  await page.goto('./#/add')

  expect(await pressedServices(page)).toEqual(['Pedicure'])
  await expect(chips(page).locator('button[data-service-name="Pedicure"]')).toContainText('$50')
  await expect(amountBox(page)).toHaveValue('50.00')
})

test('a repeat chip replaces the pre-chosen service and saves exactly that combination', async ({ page }) => {
  await start(page, { lastServicePresetId: 'manicure' })
  const combo: SeedTurn['lines'] = [
    { presetId: 'gel-manicure', name: 'Gel Manicure', cents: 3500 },
    { presetId: 'nail-art', name: 'Nail Art / Design', cents: 1000 },
  ]
  await seedTurns(page, [
    { date: '2026-11-03', lines: combo },
    { date: '2026-11-04', lines: combo },
  ])
  await page.goto('./#/add')
  expect(await pressedServices(page)).toEqual(['Manicure'])

  await page.getByRole('button', { name: /Gel Manicure \+ Nail Art \/ Design \$45/ }).click()
  expect((await pressedServices(page)).sort()).toEqual(['Gel Manicure', 'Nail Art / Design'])
  await expect(page.getByTestId('service-line')).toHaveCount(2)

  await saveAndWaitForHome(page)
  const turns = await savedTurns(page)
  const saved = turns[turns.length - 1]
  expect(saved.services.map((service) => [service.serviceNameSnapshot, service.servicePriceCents])).toEqual([
    ['Gel Manicure', 3500],
    ['Nail Art / Design', 1000],
  ])
  expect(saved.serviceRevenueTotalCents).toBe(4500)
  expect(saved.earnedTotalCents).toBe(2700)

  await page.reload()
  await page.goto('./#/history')
  await expect(page.getByTestId('turn-row').first()).toContainText('Gel Manicure')
})

test('a repeat chip keeps a commission the person typed first', async ({ page }) => {
  await start(page, { lastServicePresetId: 'manicure' })
  const combo: SeedTurn['lines'] = [
    { presetId: 'gel-manicure', name: 'Gel Manicure', cents: 3500 },
    { presetId: 'nail-art', name: 'Nail Art / Design', cents: 1000 },
  ]
  await seedTurns(page, [
    { date: '2026-11-03', lines: combo },
    { date: '2026-11-04', lines: combo },
  ])
  await page.goto('./#/add')
  await openCommission(page)
  await page.getByLabel('Commission %').fill('50')
  await page.getByRole('button', { name: /Gel Manicure \+ Nail Art/ }).click()

  await saveAndWaitForHome(page)
  const turns = await savedTurns(page)
  const saved = turns[turns.length - 1]
  expect(saved.services.map((service) => service.commissionRateSnapshotBp)).toEqual([5000, 5000])
  expect(saved.commissionTotalCents).toBe(2250)
})

test('Same as last copies the latest turn, saves it as a new turn dated today, and leaves the old one alone', async ({
  page,
}) => {
  await start(page, seedPedicureLast)
  await seedTurns(page, [
    {
      date: YESTERDAY,
      lines: [{ presetId: 'pedicure', name: 'Pedicure', cents: 5000, rateBp: 5500 }],
      cash: 700,
      card: 300,
      cashReceived: false,
      cardReceived: true,
      client: 'walkIn',
      count: 2,
      note: 'regular',
    },
  ])
  await page.goto('./#/add')
  await page.getByRole('button', { name: /Same as last/ }).click()
  await expect(page).toHaveURL(/#\/copy\//)

  // The copy starts with every choice of the old turn, but on today.
  expect(await pressedServices(page)).toEqual(['Pedicure'])
  await expect(amountBox(page)).toHaveValue('50.00')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 55%')
  await expect(datePill(page)).toContainText('Fri 11/6')
  await expect(cashTip(page)).toHaveValue('7.00')
  await expect(cardTip(page)).toHaveValue('3.00')
  await expect(page.getByRole('button', { name: 'Walk-in', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Turn count')).toHaveValue('2')
  await expect(page.getByLabel('Cash tip already in my hand')).not.toBeChecked()
  await expect(page.getByLabel('Card tip already in my hand')).toBeChecked()

  await saveAndWaitForHome(page)
  const turns = await savedTurns(page)
  expect(turns).toHaveLength(2)
  const copy = byDate(turns, TODAY)
  expect(byDate(turns, YESTERDAY).turnCount).toBe(2)
  expect(copy).toMatchObject({
    turnCount: 2,
    clientType: 'walkIn',
    cashTipCents: 700,
    cardTipCents: 300,
    cashTipReceived: false,
    cardTipReceived: true,
    note: 'regular',
    earnedTotalCents: 2750 + 1000,
  })
  expect(copy.services[0]).toMatchObject({ serviceNameSnapshot: 'Pedicure', commissionRateSnapshotBp: 5500 })
})

for (const [target, other] of [
  ['Cash', 'Card'],
  ['Card', 'Cash'],
] as const) {
  test(`tip buttons fill the ${target} tip box only, and replace what was there`, async ({ page }) => {
    await start(page, { tipButtonsTarget: target.toLowerCase() })
    await page.goto('./#/add')
    await amountBox(page).fill('50')
    const filled = page.getByLabel(`${target} tip`)
    const untouched = page.getByLabel(`${other} tip`)
    await expect(page.getByRole('button', { name: target, exact: true })).toHaveAttribute('aria-pressed', 'true')

    await tipButton(page, '$10').click()
    await expect(filled).toHaveValue('10.00')
    await expect(untouched).toHaveValue('')
    await expect(tipButton(page, '$10')).toHaveAttribute('aria-pressed', 'true')

    await tipButton(page, '$20').click()
    await expect(filled).toHaveValue('20.00')
    await expect(tipButton(page, '$10')).toHaveAttribute('aria-pressed', 'false')
    await expect(tipButton(page, '$20')).toHaveAttribute('aria-pressed', 'true')

    await tipButton(page, '18%').click()
    await expect(filled).toHaveValue('9.00')
    await expect(tipButton(page, '$20')).toHaveAttribute('aria-pressed', 'false')
    await expect(tipButton(page, '18%')).toHaveAttribute('aria-pressed', 'true')

    await saveAndWaitForHome(page)
    const [turn] = await savedTurns(page)
    expect(target === 'Cash' ? [turn.cashTipCents, turn.cardTipCents] : [turn.cardTipCents, turn.cashTipCents]).toEqual([
      900, 0,
    ])
  })
}

test('switching the tip buttons from Cash to Card moves the next tap to the card box and is remembered', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/add')
  await amountBox(page).fill('40')
  await tipButton(page, '$10').click()
  await expect(cashTip(page)).toHaveValue('10.00')

  await page.getByRole('button', { name: 'Card', exact: true }).click()
  await tipButton(page, '$5').click()
  await expect(cardTip(page)).toHaveValue('5.00')
  await expect(cashTip(page)).toHaveValue('10.00')
  expect((await savedSettings(page)).tipButtonsTarget).toBe('card')

  await saveAndWaitForHome(page)
  const [turn] = await savedTurns(page)
  expect([turn.cashTipCents, turn.cardTipCents]).toEqual([1000, 500])

  await page.goto('./#/add')
  await expect(page.getByRole('button', { name: 'Card', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('tapping a tip button that is already pressed turns it off', async ({ page }) => {
  await start(page)
  await page.goto('./#/add')
  await amountBox(page).fill('40')
  await tipButton(page, '$10').click()
  await expect(tipButton(page, '$10')).toHaveAttribute('aria-pressed', 'true')

  await tipButton(page, '$10').click()

  await expect(tipButton(page, '$10')).toHaveAttribute('aria-pressed', 'false')
  await expect(cashTip(page)).toHaveValue('')
})

test('the 18% button follows the service amount when the price changes afterwards', async ({ page }) => {
  await start(page)
  await page.goto('./#/add')
  await amountBox(page).fill('50')
  await tipButton(page, '18%').click()
  await expect(cashTip(page)).toHaveValue('9.00')

  await amountBox(page).fill('100')

  // A person who fixes the price expects 18% to mean 18% of the new price.
  await expect(cashTip(page)).toHaveValue('18.00')
})

test('tip buttons work with the number pad on, and the pad does not hide them', async ({ page }) => {
  await start(page, { numberPad: true })
  await page.goto('./#/add')
  await page.getByTestId('number-pad').getByRole('button', { name: '4', exact: true }).click()
  await page.getByTestId('number-pad').getByRole('button', { name: '0', exact: true }).click()
  await expect(amountBox(page)).toHaveValue('40')

  await tipButton(page, '$15').click()
  await expect(cashTip(page)).toHaveValue('15.00')

  await saveAndWaitForHome(page)
  const [turn] = await savedTurns(page)
  expect(turn.services[0].servicePriceCents).toBe(4000)
  expect(turn.cashTipCents).toBe(1500)
})

test('client type: nothing is chosen at first, one tap saves it, and it survives edit and reload', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/add')
  await amountBox(page).fill('30')
  for (const label of ['Walk-in', 'Request']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'false')
  }

  await page.getByRole('button', { name: 'Request', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Request', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Walk-in', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await saveAndWaitForHome(page)

  expect((await savedTurns(page))[0].clientType).toBe('request')
  await page.reload()
  await page.getByTestId('turn-row').first().click()
  await expect(page).toHaveURL(/#\/edit\//)
  // The client type sits on the main form, so it shows without opening anything.
  await expect(page.getByRole('button', { name: 'Request', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Walk-in', exact: true }).click()
  await formSave(page).click()
  await expect.poll(async () => (await savedTurns(page))[0].clientType).toBe('walkIn')
})

test('turn count: starts at 1, a tap on 2 saves two turns, and it shows up on History and Home', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/add')
  await amountBox(page).fill('60')
  await openMoreOptions(page)
  await expect(page.getByLabel('Turn count')).toHaveValue('1')
  await page.getByLabel('Turn count').fill('2')
  await saveAndWaitForHome(page)

  expect((await savedTurns(page))[0].turnCount).toBe(2)
  await expect(page.getByText('2 turns').first()).toBeVisible()
  await page.goto('./#/history')
  await expect(page.getByTestId('history-total')).toContainText('2 turns')
})

test('date row: Today is chosen, Yesterday saves yesterday, the pill saves the picked day, and the pill follows', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/add')
  await amountBox(page).fill('20')
  const choice = (name: string) => page.getByRole('button', { name, exact: true })
  await expect(choice('Today')).toHaveAttribute('aria-pressed', 'true')
  await expect(choice('Yesterday')).toHaveAttribute('aria-pressed', 'false')
  await expect(datePill(page)).toContainText('Fri 11/6')

  await choice('Yesterday').click()
  await expect(choice('Yesterday')).toHaveAttribute('aria-pressed', 'true')
  await expect(datePill(page)).toContainText('Thu 11/5')
  await saveAndWaitForHome(page)
  expect((await savedTurns(page))[0].localWorkDate).toBe(YESTERDAY)

  await page.goto('./#/add')
  await amountBox(page).fill('25')
  await page.getByLabel('Work date').fill('2026-11-02')
  await expect(datePill(page)).toContainText('Mon 11/2')
  await expect(choice('Today')).toHaveAttribute('aria-pressed', 'false')
  await expect(choice('Yesterday')).toHaveAttribute('aria-pressed', 'false')
  await saveAndWaitForHome(page)
  const turns = await savedTurns(page)
  expect(turns.map((turn) => turn.localWorkDate).sort()).toEqual(['2026-11-02', YESTERDAY])

  // Editing the old-day turn must open on that day, with neither Today nor Yesterday chosen.
  await page.goto(`./#/edit/${byDate(turns, '2026-11-02').id}`)
  await expect(datePill(page)).toContainText('Mon 11/2')
  await expect(page.getByLabel('Work date')).toHaveValue('2026-11-02')
  await expect(choice('Today')).toHaveAttribute('aria-pressed', 'false')
  await expect(choice('Yesterday')).toHaveAttribute('aria-pressed', 'false')
})

test('typing a date into the date pill with the keyboard keeps the row after the first key', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/add')
  const date = page.getByLabel('Work date')
  await date.focus()
  // Month first: "03" is a whole valid month, so the box fires a change at once.
  await page.keyboard.type('03')

  await expect(date).toBeVisible()
})

test('commission pill: shows the settings rate, one change applies to the turn and is saved with it', async ({
  page,
}) => {
  await start(page, { defaultCommissionRateBp: 5000 })
  await page.goto('./#/add')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 50%')

  await amountBox(page).fill('80')
  await openCommission(page)
  await page.getByLabel('Commission %').fill('45')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 45%')
  await saveAndWaitForHome(page)

  const [turn] = await savedTurns(page)
  expect(turn.services[0].commissionRateSnapshotBp).toBe(4500)
  expect(turn.commissionTotalCents).toBe(3600)
  // The default in Settings is not changed by one turn.
  expect((await savedSettings(page)).defaultCommissionRateBp).toBe(5000)
})

test('commission with per-service rates on: no pill, each service box starts at the default and saves its own rate', async ({
  page,
}) => {
  await start(page, { perServiceRates: true, defaultCommissionRateBp: 5500 })
  await setPreset(page, 'gel-x', { defaultCommissionRateBp: 4000 })
  await page.goto('./#/add')
  await expect(commissionPill(page)).toHaveCount(0)
  await expect(page.getByLabel('Commission %')).toHaveValue('55')

  await amountBox(page).fill('100')
  await page.getByLabel('Commission %').fill('42.5')
  await saveAndWaitForHome(page)

  const [turn] = await savedTurns(page)
  expect(turn.services[0].commissionRateSnapshotBp).toBe(4250)
  expect(turn.commissionTotalCents).toBe(4250)
})

test('a service with its own usual commission opens with that rate when it is the pre-chosen one', async ({
  page,
}) => {
  await start(page, { lastServicePresetId: 'gel-x' })
  await setPreset(page, 'gel-x', { defaultCommissionRateBp: 4000 })
  await page.goto('./#/add')

  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 40%')
  await amountBox(page).fill('100')
  await saveAndWaitForHome(page)
  expect((await savedTurns(page))[0].services[0].commissionRateSnapshotBp).toBe(4000)
})

for (const [cash, card, label] of [
  ['inHand', 'inHand', 'both in hand'],
  ['fromSalon', 'fromSalon', 'both pooled with the salon'],
  ['inHand', 'fromSalon', 'cash in hand, card from the salon'],
  ['fromSalon', 'inHand', 'cash from the salon, card in hand'],
] as const) {
  test(`tip received toggles start from the settings (${label}) and one tap flips only that tip`, async ({
    page,
  }) => {
    await start(page, { cashTipHandling: cash, cardTipHandling: card })
    await page.goto('./#/add')
    await amountBox(page).fill('40')
    await cashTip(page).fill('5')
    await cardTip(page).fill('6')
    await openMoreOptions(page)
    const cashBox = page.getByLabel('Cash tip already in my hand')
    const cardBox = page.getByLabel('Card tip already in my hand')
    if (cash === 'inHand') await expect(cashBox).toBeChecked()
    else await expect(cashBox).not.toBeChecked()
    if (card === 'inHand') await expect(cardBox).toBeChecked()
    else await expect(cardBox).not.toBeChecked()

    await cardBox.click()
    await saveAndWaitForHome(page)

    const [turn] = await savedTurns(page)
    expect(turn.cashTipReceived).toBe(cash === 'inHand')
    expect(turn.cardTipReceived).toBe(card !== 'inHand')

    // Edit: what was saved is what is shown, and one more tap changes it back.
    await page.reload()
    await page.getByTestId('turn-row').first().click()
    await openMoreOptions(page).catch(() => undefined)
    const editCard = page.getByLabel('Card tip already in my hand')
    if (card !== 'inHand') await expect(editCard).toBeChecked()
    else await expect(editCard).not.toBeChecked()
  })
}

test('edit keeps every choice of the saved turn and saving without changes changes nothing', async ({
  page,
}) => {
  await start(page, { cashTipHandling: 'fromSalon', cardTipHandling: 'inHand' })
  await seedTurns(page, [
    {
      date: '2026-11-04',
      lines: [
        { presetId: 'gel-x', name: 'Gel-X', cents: 7000, rateBp: 5500 },
        { presetId: 'nail-art', name: 'Nail Art / Design', cents: 1500, rateBp: 5500 },
      ],
      cash: 400,
      card: 900,
      cashReceived: true,
      cardReceived: false,
      client: 'request',
      count: 3,
      note: 'bride',
    },
  ])
  const before = (await savedTurns(page))[0]
  await page.goto('./#/history')
  await page.getByRole('button', { name: 'This week' }).click()
  await page.getByTestId('turn-row').first().click()

  expect((await pressedServices(page)).sort()).toEqual(['Gel-X', 'Nail Art / Design'])
  await expect(datePill(page)).toContainText('Wed 11/4')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 55%')
  await expect(cashTip(page)).toHaveValue('4.00')
  await expect(cardTip(page)).toHaveValue('9.00')
  await expect(page.getByRole('button', { name: 'Request', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Turn count')).toHaveValue('3')
  await expect(page.getByLabel('Cash tip already in my hand')).toBeChecked()
  await expect(page.getByLabel('Card tip already in my hand')).not.toBeChecked()

  await formSave(page).click()
  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ }).or(page.getByRole('heading', { name: 'History' }))).toBeVisible()
  const after = (await savedTurns(page))[0]
  expect({ ...after, createdAt: 0 }).toMatchObject({
    localWorkDate: before.localWorkDate,
    occurredAt: before.occurredAt,
    turnCount: 3,
    clientType: 'request',
    note: 'bride',
    cashTipCents: 400,
    cardTipCents: 900,
    cashTipReceived: true,
    cardTipReceived: false,
    earnedTotalCents: before.earnedTotalCents,
  })
  expect(after.services.map((service) => [service.serviceNameSnapshot, service.servicePriceCents, service.commissionRateSnapshotBp])).toEqual([
    ['Gel-X', 7000, 5500],
    ['Nail Art / Design', 1500, 5500],
  ])
})

test('Copy on an edit screen opens a new turn on today with the same choices', async ({ page }) => {
  await start(page)
  await seedTurns(page, [
    {
      date: '2026-11-03',
      lines: [{ presetId: 'dip-powder', name: 'Dip Powder', cents: 4000, rateBp: 5000 }],
      cash: 500,
      client: 'walkIn',
      count: 1,
    },
  ])
  await page.goto('./#/history')
  await page.getByRole('button', { name: 'This week' }).click()
  await page.getByTestId('turn-row').first().click()
  await page.getByRole('link', { name: 'Copy as a new turn', exact: true }).click()

  expect(await pressedServices(page)).toEqual(['Dip Powder'])
  await expect(datePill(page)).toContainText('Fri 11/6')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 50%')
  await expect(page.getByRole('button', { name: 'Walk-in', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await saveAndWaitForHome(page)
  const turns = await savedTurns(page)
  expect(turns.map((turn) => turn.localWorkDate).sort()).toEqual(['2026-11-03', TODAY])
})

test('Save & Add Another: the next turn starts clean on the service just used, the day stays, the first turn is stored', async ({
  page,
}) => {
  await start(page, { cashTipHandling: 'fromSalon', cardTipHandling: 'inHand' })
  await setPreset(page, 'dip-powder', { defaultPriceCents: 4000 })
  await page.goto('./#/add')
  // Pick Dip Powder the way a person does: tap off the pre-chosen one, then tap it.
  await tapChip(page, 'Manicure')
  await tapChip(page, 'Dip Powder')
  expect(await pressedServices(page)).toEqual(['Dip Powder'])
  await page.getByRole('button', { name: 'Yesterday', exact: true }).click()
  await cashTip(page).fill('5')
  await cardTip(page).fill('6')
  await openMoreOptions(page)
  await page.getByRole('button', { name: 'Walk-in', exact: true }).click()
  await page.getByLabel('Turn count').fill('2')
  await page.getByLabel('Cash tip already in my hand').click()
  await page.getByRole('button', { name: 'Save & Add Another' }).click()

  await expect(page.getByRole('status')).toContainText('Saved')
  const first = (await savedTurns(page)).find((turn) => turn.cashTipCents === 500)
  expect(first).toMatchObject({
    localWorkDate: YESTERDAY,
    turnCount: 2,
    clientType: 'walkIn',
    cashTipCents: 500,
    cardTipCents: 600,
    cashTipReceived: true,
    cardTipReceived: true,
  })

  // The next turn: same service, empty tips, one turn, no client type, flags from settings.
  expect(await pressedServices(page)).toEqual(['Dip Powder'])
  await expect(cashTip(page)).toHaveValue('')
  await expect(cardTip(page)).toHaveValue('')
  await expect(datePill(page)).toContainText('Thu 11/5')
  await expect(page.getByRole('button', { name: 'Yesterday', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await openMoreOptions(page)
  await expect(page.getByLabel('Turn count')).toHaveValue('1')
  await expect(page.getByRole('button', { name: 'Walk-in', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByLabel('Cash tip already in my hand')).not.toBeChecked()
  await expect(page.getByLabel('Card tip already in my hand')).toBeChecked()
  // The service chip showed a usual price, so the new turn must hold it.
  await expect(amountBox(page)).toHaveValue('40.00')

  await formSave(page).click()
  await expect.poll(async () => (await savedTurns(page)).length).toBe(2)
  const second = (await savedTurns(page)).find((turn) => turn.cashTipCents === 0) ?? (await savedTurns(page))[1]
  expect(second.services.map((service) => service.serviceNameSnapshot)).toEqual(['Dip Powder'])
  expect(second).toMatchObject({ localWorkDate: YESTERDAY, turnCount: 1, clientType: 'unspecified' })
})

test('Save & Add Another keeps the commission the person set for the turn they are logging', async ({ page }) => {
  await start(page)
  await page.goto('./#/add')
  await amountBox(page).fill('100')
  await openCommission(page)
  await page.getByLabel('Commission %').fill('50')
  await page.getByRole('button', { name: 'Save & Add Another' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')

  await amountBox(page).fill('80')
  await formSave(page).click()
  await expect.poll(async () => (await savedTurns(page)).length).toBe(2)
  const turns = await savedTurns(page)
  const rateOf = (cents: number) => turns.find((turn) => turn.serviceRevenueTotalCents === cents)?.services[0].commissionRateSnapshotBp
  expect([rateOf(10_000), rateOf(8000)]).toEqual([5000, 5000])
})

// ---------------------------------------------------------------------------
// Settings and Vietnamese
// ---------------------------------------------------------------------------

function radio(page: Page, group: string, name: string): Locator {
  return page.getByRole('group', { name: group, exact: true }).getByRole('radio', { name })
}

/** Taps the tile a person sees; the radio itself is hidden behind its label. */
async function choose(page: Page, group: string, name: string): Promise<void> {
  await page.getByRole('group', { name: group, exact: true }).getByText(name, { exact: true }).click()
}

test('settings language: English is chosen, one tap on Tiếng Việt switches the screen, and it stays after a reload', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/settings')
  await expect(radio(page, 'Language', 'English')).toBeChecked()
  await expect(radio(page, 'Language', 'Tiếng Việt')).not.toBeChecked()

  await choose(page, 'Language', 'Tiếng Việt')
  await expect(page.getByRole('heading', { name: 'Cài đặt' })).toBeVisible()
  expect((await savedSettings(page)).locale).toBe('vi')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Cài đặt' })).toBeVisible()
  await expect(radio(page, 'Ngôn ngữ', 'Tiếng Việt')).toBeChecked()

  await choose(page, 'Ngôn ngữ', 'English')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  expect((await savedSettings(page)).locale).toBe('en')
})

test('settings appearance: Same as phone is chosen, Dark and Light are applied and remembered', async ({ page }) => {
  await start(page)
  await page.goto('./#/settings')
  await expect(radio(page, 'Appearance', 'Same as phone')).toBeChecked()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)

  await choose(page, 'Appearance', 'Dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect((await savedSettings(page)).theme).toBe('dark')
  await page.reload()
  await expect(radio(page, 'Appearance', 'Dark')).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await choose(page, 'Appearance', 'Light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await choose(page, 'Appearance', 'Same as phone')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('settings number pad: on by default for a new phone, off removes the pad on Add turn, on brings it back', async ({
  page,
}) => {
  await fixNow(page, NOON)
  await seedSettings(page)
  await page.goto('./#/settings')
  const box = page.getByLabel("Use the app's number pad")
  await expect(box).toBeChecked()

  await page.goto('./#/add')
  await amountBox(page).focus()
  await expect(page.getByTestId('number-pad')).toBeVisible()

  await page.goto('./#/settings')
  await box.uncheck()
  expect((await savedSettings(page)).numberPad).toBe(false)
  await page.goto('./#/add')
  await amountBox(page).focus()
  await expect(page.getByTestId('number-pad')).toHaveCount(0)

  await page.goto('./#/settings')
  await expect(box).not.toBeChecked()
  await box.check()
  await page.goto('./#/add')
  await amountBox(page).focus()
  await expect(page.getByTestId('number-pad')).toBeVisible()
})

test('settings tip handling: each pick decides whether a new turn starts with the tip already in hand', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/settings')
  await expect(radio(page, 'Cash tips', 'I keep them right away')).toBeChecked()
  await expect(radio(page, 'Card tips', 'The salon pays them on payday')).toBeChecked()

  await choose(page, 'Cash tips', 'The salon pays them on payday')
  await choose(page, 'Card tips', 'I keep them right away')
  const settings = await savedSettings(page)
  expect([settings.cashTipHandling, settings.cardTipHandling]).toEqual(['fromSalon', 'inHand'])

  await page.goto('./#/add')
  await amountBox(page).fill('50')
  await cashTip(page).fill('5')
  await cardTip(page).fill('6')
  await openMoreOptions(page)
  await expect(page.getByLabel('Cash tip already in my hand')).not.toBeChecked()
  await expect(page.getByLabel('Card tip already in my hand')).toBeChecked()
  await saveAndWaitForHome(page)

  const [turn] = await savedTurns(page)
  expect([turn.cashTipReceived, turn.cardTipReceived]).toEqual([false, true])

  await page.goto('./#/settings')
  await expect(radio(page, 'Cash tips', 'The salon pays them on payday')).toBeChecked()
  await expect(radio(page, 'Card tips', 'I keep them right away')).toBeChecked()
})

test('settings pay schedule: each pick is kept, weekly and every two weeks start on this week, Not set hides the date', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/settings')
  await expect(radio(page, 'Payday schedule', 'Not set')).toBeChecked()
  await expect(page.getByLabel('First day of a pay period')).toHaveCount(0)

  await choose(page, 'Payday schedule', 'Weekly')
  await expect(page.getByLabel('First day of a pay period')).toHaveValue('2026-11-01')
  let settings = await savedSettings(page)
  expect([settings.payPeriodType, settings.payPeriodAnchorDate]).toEqual(['weekly', '2026-11-01'])

  await choose(page, 'Payday schedule', 'Every two weeks')
  await page.getByLabel('First day of a pay period').fill('2026-10-25')
  settings = await savedSettings(page)
  expect([settings.payPeriodType, settings.payPeriodAnchorDate]).toEqual(['biweekly', '2026-10-25'])

  await choose(page, 'Payday schedule', 'Custom')
  await expect(page.getByLabel('First day of a pay period')).toHaveCount(0)
  await choose(page, 'Payday schedule', 'Not set')

  await page.reload()
  await expect(radio(page, 'Payday schedule', 'Not set')).toBeChecked()
  expect((await savedSettings(page)).payPeriodType).toBe('none')
})

test('settings week start: Monday moves This week on History so Sunday falls into last week', async ({ page }) => {
  await start(page)
  await seedTurns(page, [
    { date: '2026-11-01', lines: [{ presetId: 'manicure', name: 'Manicure', cents: 1000 }] },
    { date: TODAY, lines: [{ presetId: 'manicure', name: 'Manicure', cents: 2000 }] },
  ])
  await page.goto('./#/history')
  await page.getByRole('button', { name: 'This week' }).click()
  // Sunday-start week: Sunday Nov 1 is inside it, so both turns are counted.
  await expect(page.getByTestId('history-total')).toContainText('2 turns')

  await page.goto('./#/settings')
  await expect(radio(page, 'Week starts on', 'Sunday')).toBeChecked()
  await choose(page, 'Week starts on', 'Monday')
  expect((await savedSettings(page)).weekStartDay).toBe(1)

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'This week' }).click()
  // Monday-start week: Nov 2 to Nov 8. Sunday Nov 1 now belongs to last week.
  await expect(page.getByTestId('history-total')).toContainText('1 turn')
  await expect(page.getByTestId('history-total')).not.toContainText('2 turns')
})

test('Vietnamese Add turn: chips, date choices and Save work, and the saved service keeps its Vietnamese name', async ({
  page,
}) => {
  await start(page, { locale: 'vi', ...seedPedicureLast })
  await page.goto('./#/add')
  const pressed = await pressedServices(page)
  expect(pressed).toHaveLength(1)

  await page.getByLabel('Tiền dịch vụ').fill('55')
  await expect(page.getByRole('button', { name: 'Hôm nay', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(datePill(page)).toContainText('T6 6/11')
  await page.getByRole('button', { name: 'Hôm qua', exact: true }).click()
  await expect(datePill(page)).toContainText('T5 5/11')
  await page.getByRole('button', { name: 'Thêm tùy chọn', exact: true }).click()
  await page.getByLabel('Tip cash đã cầm').uncheck()
  await page.locator('form').getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(page.getByRole('link', { name: /Thêm turn/ })).toBeVisible()

  const [turn] = await savedTurns(page)
  expect(turn.localWorkDate).toBe(YESTERDAY)
  expect(turn.services.map((service) => service.serviceNameSnapshot)).toEqual(pressed)
  expect(turn.services[0].servicePriceCents).toBe(5500)
  expect(turn.cashTipReceived).toBe(false)
})

// ---------------------------------------------------------------------------
// History, Home and Reports
// ---------------------------------------------------------------------------

// Week starts on Monday here, so Sunday Nov 1 sits in November but outside the week of Nov 2 to Nov 8.
const monday = { weekStartDay: 1 }
const weekOfTurns: SeedTurn[] = [
  { date: '2026-11-01', lines: [{ presetId: 'manicure', name: 'Manicure', cents: 2000 }] }, // earns $12
  {
    date: '2026-11-03',
    lines: [{ presetId: 'pedicure', name: 'Pedicure', cents: 5000 }], // earns $30
  },
  {
    date: YESTERDAY,
    lines: [{ presetId: 'gel-x', name: 'Gel-X', cents: 7000 }], // earns $42 + $8 card tip = $50
    card: 800,
    client: 'walkIn',
  },
  {
    date: TODAY,
    lines: [{ presetId: 'manicure', name: 'Manicure', cents: 4000 }], // earns $24 + $5 cash tip = $29
    cash: 500,
    client: 'request',
    note: 'regular',
  },
  { date: '2026-10-28', lines: [{ presetId: 'acrylic-fill', name: 'Acrylic Fill', cents: 6000 }] }, // earns $36
]

function rangeChip(page: Page, name: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') })
}

function historyRows(page: Page): Locator {
  return page.getByTestId('turn-row')
}

async function rowNames(page: Page): Promise<string[]> {
  return (await historyRows(page).allInnerTexts()).map((text) => text.split('\n')[0].trim())
}

test('history range chips: This Week is chosen, and Today, Yesterday, Last Week and Custom each show their own turns', async ({
  page,
}) => {
  await start(page, monday)
  await seedTurns(page, weekOfTurns)
  await page.goto('./#/history')

  await expect(rangeChip(page, 'This Week')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('history-total')).toHaveText('$109 from 3 turns')

  await rangeChip(page, 'Today').click()
  await expect(rangeChip(page, 'This Week')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('history-total')).toHaveText('$29 from 1 turn')
  expect(await rowNames(page)).toEqual(['Manicure'])

  await rangeChip(page, 'Yesterday').click()
  await expect(page.getByTestId('history-total')).toHaveText('$50 from 1 turn')
  expect(await rowNames(page)).toEqual(['Gel-X'])

  await rangeChip(page, 'Last Week').click()
  await expect(page.getByTestId('history-total')).toHaveText('$48 from 2 turns')
  expect(await rowNames(page)).toEqual(['Manicure', 'Acrylic Fill'])

  await rangeChip(page, 'Custom').click()
  await page.getByLabel('From', { exact: true }).fill('2026-10-28')
  await page.getByLabel('To', { exact: true }).fill('2026-11-03')
  await expect(page.getByTestId('history-total')).toHaveText('$78 from 3 turns')
})

test('history filters: each chip narrows the list, chips in one group are alternatives, groups add up, Clear brings everything back', async ({
  page,
}) => {
  await start(page, monday)
  await seedTurns(page, weekOfTurns)
  await page.goto('./#/history')
  await expect(historyRows(page)).toHaveCount(3)

  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Filter' })
  const chip = (name: string) => sheet.getByRole('button', { name, exact: true })
  // Nothing is on when the sheet opens.
  for (const name of ['Request', 'Walk-in', 'Cash tip', 'Card tip', 'No tip', 'Has a note']) {
    await expect(chip(name)).toHaveAttribute('aria-pressed', 'false')
  }

  await chip('Request').click()
  await expect(chip('Request')).toHaveAttribute('aria-pressed', 'true')
  await expect(historyRows(page)).toHaveCount(1)
  await chip('Walk-in').click()
  await expect(historyRows(page)).toHaveCount(2)
  await chip('Card tip').click()
  await expect(historyRows(page)).toHaveCount(1)
  await chip('Card tip').click()
  await expect(historyRows(page)).toHaveCount(2)
  await chip('Request').click()
  await chip('Walk-in').click()
  await expect(historyRows(page)).toHaveCount(3)

  await chip('No tip').click()
  await expect(historyRows(page)).toHaveCount(1)
  expect(await rowNames(page)).toEqual(['Pedicure'])
  await chip('No tip').click()
  await chip('Has a note').click()
  expect(await rowNames(page)).toEqual(['Manicure'])
  await chip('Has a note').click()
  await chip('Pedicure').click()
  expect(await rowNames(page)).toEqual(['Pedicure'])
  await sheet.getByRole('button', { name: 'Close', exact: true }).click()

  await expect(historyRows(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(historyRows(page)).toHaveCount(3)
})

test('history keeps the chosen range when a person opens a turn and comes back', async ({ page }) => {
  await start(page, monday)
  await seedTurns(page, weekOfTurns)
  await page.goto('./#/history')
  await rangeChip(page, 'Last Week').click()
  await expect(historyRows(page)).toHaveCount(2)

  await historyRows(page).first().click()
  await expect(page).toHaveURL(/#\/edit\//)
  await page.goBack()

  await expect(rangeChip(page, 'Last Week')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('history-total')).toHaveText('$48 from 2 turns')
})

test('history Custom starts on the range the person was just looking at', async ({ page }) => {
  await start(page, monday)
  await seedTurns(page, weekOfTurns)
  await page.goto('./#/history')
  await rangeChip(page, 'Last Week').click()
  await rangeChip(page, 'Custom').click()

  await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-10-26')
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('2026-11-01')
})

test('history List and Calendar: List is chosen, Calendar replaces it, and the choice stays while the app is open', async ({
  page,
}) => {
  await start(page, monday)
  await seedTurns(page, weekOfTurns)
  await page.goto('./#/history')
  const view = page.getByRole('group', { name: 'History view' })
  await expect(view.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')

  await view.getByRole('button', { name: 'Calendar' }).click()
  await expect(view.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true')
  await expect(historyRows(page)).toHaveCount(0)

  await page.getByRole('link', { name: 'Home' }).click()
  await page.getByRole('link', { name: 'History' }).click()
  await expect(view.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true')
  await view.getByRole('button', { name: 'List' }).click()
  await expect(historyRows(page)).toHaveCount(3)
})

test('Home Today / This week / This month: Today is chosen, each tap changes the figure, and the choice survives a reload', async ({
  page,
}) => {
  await start(page, monday)
  await seedTurns(page, weekOfTurns)
  await page.goto('./#/')
  const hero = page.getByTestId('hero-earned')
  const period = (name: string) => page.getByRole('button', { name, exact: true })

  await expect(period('Today')).toHaveAttribute('aria-pressed', 'true')
  await expect(hero).toHaveText('$29.00')

  await period('This week').click()
  await expect(period('This week')).toHaveAttribute('aria-pressed', 'true')
  await expect(period('Today')).toHaveAttribute('aria-pressed', 'false')
  await expect(hero).toHaveText('$109.00')

  await period('This month').click()
  await expect(hero).toHaveText('$121.00')

  await page.reload()
  await expect(period('This month')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('hero-earned')).toHaveText('$121.00')
})

test('Reports Day / Week / Month / Year / Custom: Week is chosen, each chip shows its own total, Custom starts on the period just shown', async ({
  page,
}) => {
  await start(page, monday)
  await seedTurns(page, weekOfTurns)
  await page.goto('./#/earnings')
  const total = page.getByText('Total earned', { exact: true }).locator('xpath=following-sibling::p[1]')
  const turns = page.getByTestId('report-stat-turns')
  const chip = (name: string) => page.getByRole('button', { name, exact: true })

  await expect(chip('Week')).toHaveAttribute('aria-pressed', 'true')
  await expect(total).toHaveText('$109.00')
  await expect(turns).toHaveText('3')

  await chip('Day').click()
  await expect(chip('Day')).toHaveAttribute('aria-pressed', 'true')
  await expect(chip('Week')).toHaveAttribute('aria-pressed', 'false')
  await expect(total).toHaveText('$29.00')

  await chip('Month').click()
  await expect(total).toHaveText('$121.00')
  await expect(turns).toHaveText('4')

  await chip('Year').click()
  await expect(total).toHaveText('$157.00')
  await expect(turns).toHaveText('5')

  await chip('Week').click()
  await chip('Custom').click()
  await expect(chip('Custom')).toHaveAttribute('aria-pressed', 'true')
  // A person who was looking at this week and taps Custom expects to start from this week.
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-11-02')
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('2026-11-08')
})

test('Reports trend bar: a tap shows that bar, a second bar replaces it, and Open moves the report to that period', async ({
  page,
}) => {
  await start(page, monday)
  await seedTurns(page, weekOfTurns)
  await page.goto('./#/earnings')
  const bars = page.getByTestId('trend-bar')
  await expect(bars.first()).toBeVisible()
  for (const bar of await bars.all()) await expect(bar).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('trend-detail')).toHaveCount(0)

  const lastWeekBar = page.locator('[data-testid="trend-bar"][aria-label$="$48.00"]')
  await lastWeekBar.click()
  await expect(lastWeekBar).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('trend-detail')).toContainText('$48.00')

  const thisWeekBar = page.locator('[data-testid="trend-bar"][aria-label$="$109.00"]')
  await thisWeekBar.click()
  await expect(lastWeekBar).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('trend-detail')).toContainText('$109.00')

  await lastWeekBar.click()
  await page.getByTestId('trend-detail').getByRole('button', { name: 'Open' }).click()
  await expect(page.getByText('Total earned', { exact: true }).locator('xpath=following-sibling::p[1]')).toHaveText('$48.00')
})

// ---------------------------------------------------------------------------
// Adjustment, Payment, Record what you got, Onboarding, Pay rules
// ---------------------------------------------------------------------------

function pressed(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true })
}

/** A chip of the adjustment's Type row; Bonus is also a chip in the sign row above the amount. */
function typeChip(page: Page, name: string): Locator {
  return page.getByRole('group', { name: 'Type', exact: true }).getByRole('button', { name, exact: true })
}

test('adjustment: Bonus and Today are chosen at first, one tap picks a type and a day, the signed amount is stored, and edit reopens it', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/adjustment/new')
  for (const [name, on] of [
    ['Bonus', 'true'],
    ['Commission correction', 'false'],
    ['Tip correction', 'false'],
    ['Bookkeeping deduction', 'false'],
  ] as const) {
    await expect(typeChip(page, name)).toHaveAttribute('aria-pressed', on)
  }
  for (const [name, on] of [
    ['Today', 'true'],
    ['Yesterday', 'false'],
  ] as const) {
    await expect(pressed(page, name)).toHaveAttribute('aria-pressed', on)
  }

  await typeChip(page, 'Commission correction').click()
  await expect(typeChip(page, 'Commission correction')).toHaveAttribute('aria-pressed', 'true')
  await expect(typeChip(page, 'Bonus')).toHaveAttribute('aria-pressed', 'false')
  await pressed(page, 'Yesterday').click()
  await expect(pressed(page, 'Today')).toHaveAttribute('aria-pressed', 'false')
  await page.getByLabel('Amount', { exact: true }).fill('-25')
  await page.getByLabel('Note', { exact: true }).fill('fixed the count')
  await pressed(page, 'Save').click()

  await expect.poll(async () => (await readStore<SavedAdjustment>(page, 'adjustments')).length).toBe(1)
  const [saved] = await readStore<SavedAdjustment>(page, 'adjustments')
  expect(saved).toMatchObject({
    amountCents: -2500,
    category: 'commissionCorrection',
    localWorkDate: YESTERDAY,
    note: 'fixed the count',
  })

  await page.goto(`./#/adjustment/${saved.id}`)
  await expect(typeChip(page, 'Commission correction')).toHaveAttribute('aria-pressed', 'true')
  await expect(pressed(page, 'Yesterday')).toHaveAttribute('aria-pressed', 'true')
  await expect(pressed(page, 'Deduction')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('25.00')
  await typeChip(page, 'Tip correction').click()
  await pressed(page, 'Save').click()
  await expect
    .poll(async () => (await readStore<SavedAdjustment>(page, 'adjustments'))[0].category)
    .toBe('tipCorrection')
  const [edited] = await readStore<SavedAdjustment>(page, 'adjustments')
  expect([edited.amountCents, edited.localWorkDate]).toEqual([-2500, YESTERDAY])
})

test('adjustment day: the date pill saves the picked day and the edit screen reopens on it', async ({ page }) => {
  await start(page)
  await page.goto('./#/adjustment/new')
  await page.getByLabel('Work date').fill('2026-10-30')
  await page.getByLabel('Amount', { exact: true }).fill('40')
  await pressed(page, 'Save').click()

  await expect.poll(async () => (await readStore<SavedAdjustment>(page, 'adjustments')).length).toBe(1)
  const [saved] = await readStore<SavedAdjustment>(page, 'adjustments')
  expect([saved.localWorkDate, saved.amountCents, saved.category]).toEqual(['2026-10-30', 4000, 'bonus'])

  await page.goto(`./#/adjustment/${saved.id}`)
  await expect(datePill(page)).toContainText('Fri 10/30')
  await expect(pressed(page, 'Today')).toHaveAttribute('aria-pressed', 'false')
  await expect(pressed(page, 'Yesterday')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByLabel('Work date')).toHaveValue('2026-10-30')
})

/** Opens the pay form (or the record form) for the week that holds the fixed test day. */
async function openPeriod(page: Page): Promise<void> {
  await seedTurns(page, [{ lines: [{ presetId: 'manicure', name: 'Manicure', cents: 10_000 }] }])
  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Nov 1 – Nov 7/ }).click()
}

test('payment method: Direct deposit is chosen at first, each tap saves that method, and edit reopens it', async ({
  page,
}) => {
  await start(page, weeklyPay)
  await openPeriod(page)
  await page.getByRole('link', { name: 'Record payment', exact: true }).click()
  await expect(page.getByLabel('Payment date')).toHaveValue(TODAY)
  for (const [name, on] of [
    ['Cash', 'false'],
    ['Check', 'false'],
    ['Direct deposit', 'true'],
    ['Zelle', 'false'],
    ['Other', 'false'],
  ] as const) {
    await expect(pressed(page, name)).toHaveAttribute('aria-pressed', on)
  }
  await page.getByLabel('Amount received').first().fill('20')
  await pressed(page, 'Save').click()
  await expect.poll(async () => (await readStore<SavedPayment>(page, 'payments')).length).toBe(1)

  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Nov 1 – Nov 7/ }).click()
  await page.getByRole('link', { name: 'Record payment', exact: true }).click()
  await page.getByLabel('Amount received').first().fill('30')
  await pressed(page, 'Zelle').click()
  await expect(pressed(page, 'Zelle')).toHaveAttribute('aria-pressed', 'true')
  await expect(pressed(page, 'Direct deposit')).toHaveAttribute('aria-pressed', 'false')
  await pressed(page, 'Save').click()
  await expect.poll(async () => (await readStore<SavedPayment>(page, 'payments')).length).toBe(2)

  const payments = await readStore<SavedPayment>(page, 'payments')
  const methodOf = (cents: number) => payments.find((payment) => payment.amountCents === cents)?.paymentMethod
  expect([methodOf(2000), methodOf(3000)]).toEqual(['directDeposit', 'zelle'])

  const zelle = payments.find((payment) => payment.amountCents === 3000)!
  await page.goto(`./#/payment/${zelle.id}`)
  await expect(pressed(page, 'Zelle')).toHaveAttribute('aria-pressed', 'true')
  await pressed(page, 'Check').click()
  await pressed(page, 'Save').click()
  await expect
    .poll(async () => (await readStore<SavedPayment>(page, 'payments')).find((payment) => payment.id === zelle.id)?.paymentMethod)
    .toBe('check')
})

test('Record what you got: Zelle is chosen for the other payment, a tap on Other saves Other, and the check and cash amounts keep their own method', async ({
  page,
}) => {
  await start(page, weeklyPay)
  await openPeriod(page)
  await page.getByRole('link', { name: 'Record what you got', exact: true }).click()
  await expect(page.getByLabel('Payment date')).toHaveValue(TODAY)
  for (const [name, on] of [
    ['Zelle', 'true'],
    ['Direct deposit', 'false'],
    ['Other', 'false'],
  ] as const) {
    await expect(pressed(page, name)).toHaveAttribute('aria-pressed', on)
  }
  await page.getByLabel('Check amount').fill('10')
  await page.getByLabel('Cash amount').fill('20')
  await page.getByLabel('Other payment').fill('30')
  await pressed(page, 'Save').click()
  await expect.poll(async () => (await readStore<SavedPayment>(page, 'payments')).length).toBe(3)

  const first = await readStore<SavedPayment>(page, 'payments')
  const methodOf = (list: SavedPayment[], cents: number) => list.find((payment) => payment.amountCents === cents)?.paymentMethod
  expect([methodOf(first, 1000), methodOf(first, 2000), methodOf(first, 3000)]).toEqual(['check', 'cash', 'zelle'])

  await page.goto('./#/payday')
  await page.getByRole('link', { name: /Nov 1 – Nov 7/ }).click()
  await page.getByRole('link', { name: 'Record what you got', exact: true }).click()
  await page.getByLabel('Other payment').fill('5')
  await pressed(page, 'Other').click()
  await expect(pressed(page, 'Other')).toHaveAttribute('aria-pressed', 'true')
  await expect(pressed(page, 'Zelle')).toHaveAttribute('aria-pressed', 'false')
  await pressed(page, 'Save').click()
  await expect.poll(async () => (await readStore<SavedPayment>(page, 'payments')).length).toBe(4)
  expect(methodOf(await readStore<SavedPayment>(page, 'payments'), 500)).toBe('other')
})

test('onboarding: every choice opens on the usual answer, one tap changes it, and the answers reach Settings and Add turn', async ({
  page,
}) => {
  await start(page, { onboardingDone: false })
  await page.goto('./')
  await expect(radio(page, 'Language', 'English')).toBeChecked()
  await expect(radio(page, 'Default commission', '60% commission')).toBeChecked()
  await choose(page, 'Default commission', '50% commission')
  await expect(radio(page, 'Default commission', '50% commission')).toBeChecked()
  await choose(page, 'Default commission', 'Custom commission')
  await page.getByLabel('Custom commission %').fill('45')

  await expect(radio(page, 'Total tips', 'Cash tips right away, card tips on payday')).toBeChecked()
  await choose(page, 'Total tips', 'All tips on payday')

  await expect(radio(page, 'Payday schedule', 'Skip for now')).toBeChecked()
  await choose(page, 'Payday schedule', 'Weekly')
  await pressed(page, 'Start tracking').click()

  await expect(page.getByRole('link', { name: /Add Turn|Add your first turn/ })).toBeVisible()
  const settings = await savedSettings(page)
  expect(settings).toMatchObject({
    onboardingDone: true,
    defaultCommissionRateBp: 4500,
    cashTipHandling: 'fromSalon',
    cardTipHandling: 'fromSalon',
    payPeriodType: 'weekly',
    payPeriodAnchorDate: '2026-11-01',
  })

  await page.goto('./#/add')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 45%')
  await openMoreOptions(page)
  await expect(page.getByLabel('Cash tip already in my hand')).not.toBeChecked()
})

test('onboarding: choosing Vietnamese switches every choice at once, and one Skip keeps the usual answers', async ({
  page,
}) => {
  await start(page, { onboardingDone: false })
  await page.goto('./')
  await choose(page, 'Language', 'Tiếng Việt')
  await expect(page.getByRole('heading', { name: 'Tỷ lệ chia mặc định' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lịch nhận lương' })).toBeVisible()
  await pressed(page, 'Bỏ qua').click()

  await expect(page.getByRole('link', { name: /Thêm turn/ })).toBeVisible()
  expect(await savedSettings(page)).toMatchObject({
    onboardingDone: true,
    locale: 'vi',
    defaultCommissionRateBp: 6000,
    cashTipHandling: 'inHand',
    cardTipHandling: 'fromSalon',
    payPeriodType: 'none',
  })
})

async function savedRules(page: Page): Promise<SavedPayRules[]> {
  return readStore<SavedPayRules>(page, 'payRules')
}

test('pay rules: 60% is chosen, 50% plus Save rules changes the next turn, and the start day choice decides the rule row', async ({
  page,
}) => {
  await start(page, weeklyPay)
  await page.goto('./#/settings/pay')
  await expect(radio(page, 'Default commission', '60%')).toBeChecked()
  await choose(page, 'Default commission', '50%')
  await choose(page, 'Split', '50/50')
  await choose(page, 'Card tips paid in', 'Cash')
  await expect(page.getByText('When did this start?')).toBeVisible()
  await expect(pressed(page, 'Start of this pay period')).toHaveAttribute('aria-pressed', 'true')
  await expect(pressed(page, 'Today')).toHaveAttribute('aria-pressed', 'false')
  await pressed(page, 'Save rules').click()
  await expect.poll(async () => (await savedRules(page)).some((rules) => rules.startDate === '2026-11-01')).toBe(true)
  const rules = (await savedRules(page)).find((row) => row.startDate === '2026-11-01')!
  expect([rules.checkBp, rules.cardTipsPaidIn]).toEqual([5000, 'cash'])

  await page.goto('./#/add')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 50%')
  await amountBox(page).fill('100')
  await saveAndWaitForHome(page)
  expect((await savedTurns(page))[0].services[0].commissionRateSnapshotBp).toBe(5000)

  await page.goto('./#/settings/pay')
  await expect(radio(page, 'Default commission', '50%')).toBeChecked()
  await expect(radio(page, 'Split', '50/50')).toBeChecked()
  await expect(radio(page, 'Card tips paid in', 'Cash')).toBeChecked()
})

test('pay rules start day: Today and Other day each store the rule from that day', async ({ page }) => {
  await start(page, weeklyPay)
  await page.goto('./#/settings/pay')
  await choose(page, 'Card tips paid in', 'Check')
  await pressed(page, 'Today').click()
  await pressed(page, 'Save rules').click()
  await expect.poll(async () => (await savedRules(page)).some((rules) => rules.startDate === TODAY)).toBe(true)
  expect((await savedRules(page)).find((rules) => rules.startDate === TODAY)?.cardTipsPaidIn).toBe('check')

  await page.goto('./#/settings/pay')
  await choose(page, 'Card tips paid in', 'Cash')
  await pressed(page, 'Other day').click()
  await page.getByLabel('Start date', { exact: true }).fill('2026-10-12')
  await pressed(page, 'Save rules').click()
  await expect.poll(async () => (await savedRules(page)).some((rules) => rules.startDate === '2026-10-12')).toBe(true)
  expect((await savedRules(page)).find((rules) => rules.startDate === '2026-10-12')?.cardTipsPaidIn).toBe('cash')
})

test('pay rules per-service checkbox: off at first, on gives every service its own commission box on Add turn', async ({
  page,
}) => {
  await start(page)
  await page.goto('./#/settings/pay')
  const box = page.getByLabel('Different commission for each service')
  await expect(box).not.toBeChecked()
  await box.check()
  expect((await savedSettings(page)).perServiceRates).toBe(true)

  await page.goto('./#/add')
  await expect(commissionPill(page)).toHaveCount(0)
  await expect(page.getByLabel('Commission %')).toHaveValue('60')

  await page.goto('./#/settings/pay')
  await expect(box).toBeChecked()
  await box.uncheck()
  await page.goto('./#/add')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 60%')
})

test('pay rules: tapping 50% saves it at once, even when leaving with the X', async ({ page }) => {
  await start(page)
  await page.goto('./#/settings/pay')
  await choose(page, 'Default commission', '50%')
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  expect((await savedSettings(page)).defaultCommissionRateBp).toBe(5000)
  await page.goto('./#/add')
  await expect(commissionPill(page)).toHaveAccessibleName('Commission: 50%')
})
