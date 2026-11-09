import { expect, test, type Page } from '@playwright/test'
import { addTurn, formSave, seedSettings, selectServices, turnRow } from './helpers.ts'

// Noon on 2026-11-04 in the browser's America/Chicago timezone. The offset is
// explicit so a machine running in UTC cannot move the fixed day.
const NOON = new Date('2026-11-04T12:00:00-06:00')
const TODAY = '2026-11-04'

type Row = Record<string, unknown>

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

/** The saved turn that is not `original`: the browser clock is fixed, so age cannot tell them apart. */
async function copyOf(page: Page, original: Row): Promise<Row> {
  const copies = (await rows(page, 'turns')).filter((turn) => turn.id !== original.id)
  expect(copies).toHaveLength(1)
  return copies[0]
}

const SAME_ON_A_COPY = [
  'turnCount',
  'clientType',
  'note',
  'cashTipCents',
  'cardTipCents',
  'cashTipReceived',
  'cardTipReceived',
  'serviceRevenueTotalCents',
  'commissionTotalCents',
  'earnedTotalCents',
] as const

const toast = (page: Page) => page.getByRole('status').filter({ hasText: 'Copied, you earn' })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON)
  await seedSettings(page)
})

test('client type chips sit on the main form: pick one, tap it again to clear', async ({ page }) => {
  await page.goto('./#/add')
  await page.getByLabel('Service amount').fill('40')
  const walkIn = page.getByRole('button', { name: 'Walk-in', exact: true })
  const request = page.getByRole('button', { name: 'Request', exact: true })

  // No need to open More options: both chips are in view, nothing chosen.
  await expect(page.getByLabel('Turn count')).toHaveCount(0)
  await expect(walkIn).toHaveAttribute('aria-pressed', 'false')
  await expect(request).toHaveAttribute('aria-pressed', 'false')

  await request.click()
  await expect(request).toHaveAttribute('aria-pressed', 'true')
  await walkIn.click()
  await expect(walkIn).toHaveAttribute('aria-pressed', 'true')
  await expect(request).toHaveAttribute('aria-pressed', 'false')
  await walkIn.click()
  await expect(walkIn).toHaveAttribute('aria-pressed', 'false')

  await request.click()
  await formSave(page).click()
  await expect.poll(async () => (await rows(page, 'turns')).length).toBe(1)
  expect((await rows(page, 'turns'))[0].clientType).toBe('request')
})

test('Copy on a Home row saves a turn at once, with Undo on the toast', async ({ page }) => {
  await addTurn(page, { service: 'Gel-X', amount: '75', cash: '5', rate: '55' })

  const [first] = await rows(page, 'turns')

  await page.getByRole('button', { name: 'Copy turn #1' }).click()

  await expect(page).toHaveURL(/#\/$/)
  await expect(toast(page)).toContainText('Copied, you earn $46.25')
  await expect(turnRow(page, 2)).toBeVisible()
  const second = await copyOf(page, first)
  for (const field of SAME_ON_A_COPY) expect(second[field]).toEqual(first[field])
  expect(second.earnedTotalCents).toBe(4125 + 500)
  const services = await rows(page, 'turnServices')
  const copied = services.filter((service) => service.turnId === second.id)
  expect(
    copied.map((service) => [service.servicePriceCents, service.commissionRateSnapshotBp]),
  ).toEqual([[7500, 5500]])

  await toast(page).getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(async () => (await rows(page, 'turns')).length).toBe(1)
  await expect(turnRow(page, 2)).toHaveCount(0)
})

test('Edit on the Copied toast opens the new turn', async ({ page }) => {
  await addTurn(page, { amount: '60' })
  const [original] = await rows(page, 'turns')
  await page.getByRole('button', { name: 'Copy turn #1' }).click()
  await expect.poll(async () => (await rows(page, 'turns')).length).toBe(2)

  await toast(page).getByRole('button', { name: 'Edit', exact: true }).click()

  const newest = await copyOf(page, original)
  await expect(page).toHaveURL(new RegExp(`#/edit/${newest.id}$`))
  await expect(page.getByRole('heading', { name: 'Edit Turn' })).toBeVisible()
  await expect(page.getByLabel('Service amount')).toHaveValue('60.00')
})

test('Copy on a History row dates the copy today and keeps every choice and the pay', async ({
  page,
}) => {
  // One turn on November 2 with every extra option changed from its default.
  await page.goto('./#/add')
  await page.getByLabel('Work date').fill('2026-11-02')
  await selectServices(page, ['Gel-X', 'Manicure'])
  await page.getByLabel('Service amount').first().fill('75')
  await page.getByLabel('Service amount').last().fill('30')
  await page.getByLabel('Cash tip').fill('10')
  await page.getByLabel('Card tip').fill('5')
  await page.getByRole('button', { name: 'Walk-in', exact: true }).click()
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByLabel('Turn count').fill('2')
  await page.getByLabel('Cash tip already in my hand').uncheck()
  await page.getByLabel('Note').fill('Owner requested')
  await formSave(page).click()
  await expect(page.getByRole('link', { name: 'Add Turn', exact: true })).toBeVisible()

  await page.goto('./#/history')
  await page.getByRole('button', { name: 'This week' }).click()
  const [first] = await rows(page, 'turns')
  await page.getByRole('button', { name: /^Copy turn/ }).click()

  await expect(page).toHaveURL(/#\/history/)
  await expect(toast(page)).toBeVisible()
  await expect.poll(async () => (await rows(page, 'turns')).length).toBe(2)
  const second = await copyOf(page, first)
  expect(first.localWorkDate).toBe('2026-11-02')
  expect(second.localWorkDate).toBe(TODAY)
  for (const field of SAME_ON_A_COPY) expect(second[field]).toEqual(first[field])
  expect(second.clientType).toBe('walkIn')
  expect(second.cashTipReceived).toBe(false)
  expect(second.occurredAt).toBe(NOON.getTime())
  const services = await rows(page, 'turnServices')
  const lines = (id: unknown) =>
    services
      .filter((service) => service.turnId === id)
      .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
      .map((service) => [
        service.serviceNameSnapshot,
        service.servicePriceCents,
        service.commissionRateSnapshotBp,
      ])
  expect(lines(second.id)).toEqual(lines(first.id))
})

test('two fast taps on Copy save one turn', async ({ page }) => {
  await addTurn(page, { amount: '50' })

  await page.getByRole('button', { name: 'Copy turn #1' }).dblclick()

  await expect.poll(async () => (await rows(page, 'turns')).length).toBe(2)
  await page.waitForTimeout(600)
  expect(await rows(page, 'turns')).toHaveLength(2)
})
