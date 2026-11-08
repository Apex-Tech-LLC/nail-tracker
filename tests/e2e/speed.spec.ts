import { expect, test, type Page } from '@playwright/test'
import { fixNow, seedSettings } from './helpers.ts'
import { seedFiveYears, speedSettings, SPEED_NOW } from './speedSeed.ts'

// Desktop Chrome on GitHub should load each screen well under a second with
// five years of data. The 300 ms phone target from the spec is checked by hand
// from the printed numbers.
const BUDGET_MS = 1_000

function countOf(page: Page, name: string): Promise<number> {
  return page.evaluate((entryName) => performance.getEntriesByName(entryName).length, name)
}

function lastDuration(page: Page, name: string): Promise<number> {
  return page.evaluate((entryName) => {
    const entries = performance.getEntriesByName(entryName)
    return entries.length === 0 ? -1 : entries[entries.length - 1].duration
  }, name)
}

/** Waits until the screen has recorded at least one load, then reads the last one. */
async function firstDuration(page: Page, name: string): Promise<number> {
  await expect.poll(() => countOf(page, name), { timeout: 60_000 }).toBeGreaterThan(0)
  return lastDuration(page, name)
}

/**
 * Times one state change on a screen. The previous state's load must already
 * be in the timeline (call `firstDuration` first), so the entry that appears
 * after the change is the one for the new numbers.
 */
async function measureStep(
  page: Page,
  name: string,
  step: () => Promise<void>,
  ready: () => Promise<void>,
): Promise<number> {
  const before = await countOf(page, name)
  await step()
  await ready()
  await expect.poll(() => countOf(page, name), { timeout: 60_000 }).toBeGreaterThan(before)
  return lastDuration(page, name)
}

test.describe('speed with five years of data', () => {
  test('every screen shows its numbers quickly', async ({ page }) => {
    test.setTimeout(300_000)

    await fixNow(page, SPEED_NOW)
    await seedSettings(page, speedSettings)
    await seedFiveYears(page)

    await page.reload()
    await expect(page.getByTestId('hero-earned')).toBeVisible()
    const times: Record<string, number> = {}
    times['load:home'] = await firstDuration(page, 'load:home')

    await page.goto('./#/earnings')
    await expect(page.getByTestId('report-stat-turns')).toBeVisible()
    await firstDuration(page, 'load:reports')

    times['load:reports month'] = await measureStep(
      page,
      'load:reports',
      async () => {
        await page.getByRole('button', { name: 'Month', exact: true }).click()
      },
      async () => {
        await expect(page.getByText('November 2026', { exact: true })).toBeVisible()
      },
    )

    times['load:reports year'] = await measureStep(
      page,
      'load:reports',
      async () => {
        await page.getByRole('button', { name: 'Year', exact: true }).click()
      },
      async () => {
        await expect(page.locator('p').filter({ hasText: /^2026$/ })).toBeVisible()
      },
    )

    await page.goto('./#/history')
    await expect(page.getByTestId('history-total')).toBeVisible()
    await firstDuration(page, 'load:history')

    times['load:history calendar'] = await measureStep(
      page,
      'load:history',
      async () => {
        await page.getByRole('button', { name: 'Calendar', exact: true }).click()
      },
      async () => {
        await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible()
      },
    )

    await measureStep(
      page,
      'load:history',
      async () => {
        await page.getByRole('button', { name: 'List', exact: true }).click()
      },
      async () => {
        await expect(page.getByTestId('history-total')).toBeVisible()
      },
    )
    await measureStep(
      page,
      'load:history',
      async () => {
        await page.getByRole('button', { name: 'Custom', exact: true }).click()
      },
      async () => {
        await expect(page.getByTestId('history-total')).toBeVisible()
      },
    )
    await measureStep(
      page,
      'load:history',
      async () => {
        await page.getByLabel('From', { exact: true }).fill('2026-11-01')
      },
      async () => {
        await expect(page.getByTestId('history-total')).toBeVisible()
      },
    )
    times['load:history list'] = await measureStep(
      page,
      'load:history',
      async () => {
        await page.getByLabel('To', { exact: true }).fill('2026-11-30')
      },
      async () => {
        await expect(page.getByTestId('history-total')).toBeVisible()
      },
    )

    times['load:paycheck'] = await measureStep(
      page,
      'load:paycheck',
      async () => {
        await page.goto('./#/payday')
      },
      async () => {
        await expect(page.getByRole('heading', { name: 'Paycheck', exact: true })).toBeVisible()
      },
    )

    for (const [screen, duration] of Object.entries(times)) {
      console.log(`${screen}: ${Math.round(duration)} ms`)
    }

    for (const [screen, duration] of Object.entries(times)) {
      expect(duration, screen).toBeLessThanOrEqual(BUDGET_MS)
    }
  })
})
