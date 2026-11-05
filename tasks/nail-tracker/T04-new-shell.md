# T04: Swap the old expense app for the new empty shell

- **Branch:** `task/T04-new-shell`
- **Milestone:** M1 Foundation
- **Depends on:** T03
- **Size:** about 50 minutes. Most of it is deleting files and pasting the code below.

## Goal

All Daftar content is gone. The app opens in English or Vietnamese with five tabs (Today, History, Earnings, Payday, Settings). Four tabs show "Coming soon". Settings shows the language choice, storage status and version.

## Steps

### 1. Delete

```
git rm -r src/features/expenses src/features/summary src/features/backup src/db
git rm src/lib/jalali.ts src/lib/numberWords.ts src/lib/money.ts
git rm tests/unit/backup.test.ts tests/unit/db.test.ts tests/unit/expenseStore.test.ts tests/unit/groupByDay.test.ts tests/unit/jalali.test.ts tests/unit/monthSummary.test.ts tests/unit/numberWords.test.ts
git rm tests/e2e/a11y.spec.ts tests/e2e/backup.spec.ts tests/e2e/offline.spec.ts
pnpm remove jalaali-js @types/jalaali-js
```

If a path is missing, skip it and keep going. Keep `tests/unit/persistStorage.test.ts` and everything in `src/pwa/`.

### 2. Language

`src/lib/locale.ts` becomes:
```ts
export type Locale = 'vi' | 'en'
```
Copy the dictionary over the old one:
```
cp tasks/nail-tracker/reference/i18n.ts src/lib/i18n.ts
```

### 3. Settings: replace `src/app/settings.ts` with

```ts
import { useSyncExternalStore } from 'react'
import type { IsoDate } from '../domain/dates.ts'
import type { Locale } from '../lib/locale.ts'

export type PayPeriodType = 'weekly' | 'biweekly' | 'custom' | 'none'
export type TipHandling = 'inHand' | 'fromSalon'

export interface Settings {
  locale: Locale
  defaultCommissionRateBp: number
  perServiceRates: boolean
  weekStartDay: 0 | 1
  payPeriodType: PayPeriodType
  payPeriodAnchorDate: IsoDate | null
  cashTipHandling: TipHandling
  cardTipHandling: TipHandling
  lastServicePresetId: string | null
  onboardingDone: boolean
}

const STORAGE_KEY = 'nail-tracker.settings'

/** Vietnamese if the browser's first language is Vietnamese, English otherwise. */
export function detectLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

const isTipHandling = (value: unknown): value is TipHandling => value === 'inHand' || value === 'fromSalon'
const isPeriodType = (value: unknown): value is PayPeriodType =>
  value === 'weekly' || value === 'biweekly' || value === 'custom' || value === 'none'
const isRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000
const isDateText = (value: unknown): value is IsoDate => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** Saved choices win over defaults. Anything malformed in storage is ignored rather than trusted. */
export function resolveSettings(saved: string | null, languages: readonly string[]): Settings {
  let parsed: Partial<Record<keyof Settings, unknown>> = {}
  try {
    const value: unknown = saved ? JSON.parse(saved) : null
    if (value && typeof value === 'object') parsed = value
  } catch {
    // Corrupt value: fall back to defaults.
  }
  return {
    locale: parsed.locale === 'vi' || parsed.locale === 'en' ? parsed.locale : detectLocale(languages),
    defaultCommissionRateBp: isRate(parsed.defaultCommissionRateBp) ? parsed.defaultCommissionRateBp : 6000,
    perServiceRates: parsed.perServiceRates === true,
    weekStartDay: parsed.weekStartDay === 1 ? 1 : 0,
    payPeriodType: isPeriodType(parsed.payPeriodType) ? parsed.payPeriodType : 'none',
    payPeriodAnchorDate: isDateText(parsed.payPeriodAnchorDate) ? parsed.payPeriodAnchorDate : null,
    cashTipHandling: isTipHandling(parsed.cashTipHandling) ? parsed.cashTipHandling : 'inHand',
    cardTipHandling: isTipHandling(parsed.cardTipHandling) ? parsed.cardTipHandling : 'fromSalon',
    lastServicePresetId: typeof parsed.lastServicePresetId === 'string' ? parsed.lastServicePresetId : null,
    onboardingDone: parsed.onboardingDone === true,
  }
}

// Settings live in localStorage, not IndexedDB: they are read synchronously
// before the first render, so the page never flashes in the wrong language.
// Storage can throw (private mode, blocked site data), so every access is
// guarded and the app still works with defaults.
function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let current = resolveSettings(readStorage(), navigator.languages ?? [navigator.language])
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function updateSettings(change: Partial<Settings>): void {
  current = { ...current, ...change }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Not saved, but still applied for this session.
  }
  applyToDocument(current)
  listeners.forEach((listener) => listener())
}

/** Sets <html lang>. Both languages read left to right. */
export function applyToDocument({ locale }: Settings): void {
  document.documentElement.lang = locale
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings)
}
```

### 4. Navigation: in `src/app/navigation.ts`

Change the comment's `/daftar/` to `/nail-tracker/`, replace `paths`, and change `paths.list` to `paths.today` inside `useGoBack`. In its comment, change "with the list" to "with Today".
```ts
export const paths = {
  today: '/',
  history: '/history',
  earnings: '/earnings',
  payday: '/payday',
  settings: '/settings',
  add: '/add',
  edit: (id: string) => `/edit/${id}`,
  adjustmentNew: '/adjustment/new',
  adjustment: (id: string) => `/adjustment/${id}`,
  period: (id: string) => `/payday/${id}`,
  pay: (id: string) => `/payday/${id}/pay`,
  payment: (id: string) => `/payment/${id}`,
  services: '/settings/services',
  onboarding: '/onboarding',
} as const
```

### 5. Header: in `src/app/PageHeader.tsx`

Change `const other = locale === 'fa' ? 'en' : 'fa'` to `const other = locale === 'vi' ? 'en' : 'vi'`. Nothing else.

### 6. Tabs: replace the top of `src/app/BottomNav.tsx`

```ts
import { IconCalendarDollar, IconChartBar, IconHome, IconList, IconSettings, type Icon } from '@tabler/icons-react'
```
```ts
const TABS: { path: string; label: StringKey; icon: Icon }[] = [
  { path: paths.today, label: 'navToday', icon: IconHome },
  { path: paths.history, label: 'navHistory', icon: IconList },
  { path: paths.earnings, label: 'navEarnings', icon: IconChartBar },
  { path: paths.payday, label: 'navPayday', icon: IconCalendarDollar },
  { path: paths.settings, label: 'navSettings', icon: IconSettings },
]
```
If `IconCalendarDollar` does not exist in the package, use `IconCash`.

### 7. Placeholder pages

Create `src/features/today/TodayPage.tsx`, `src/features/history/HistoryPage.tsx`, `src/features/earnings/EarningsPage.tsx`, `src/features/payday/PaydayPage.tsx`. Each is the same with its own name and title key (`appName`, `historyTitle`, `earningsTitle`, `paydayTitle`):
```tsx
import { PageHeader } from '../../app/PageHeader.tsx'
import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'

export function HistoryPage() {
  const { locale } = useSettings()
  return (
    <>
      <PageHeader title={t(locale, 'historyTitle')} />
      <p className="text-text-secondary">{t(locale, 'comingSoon')}</p>
    </>
  )
}
```

### 8. Routes: replace `src/app/routes.tsx`

```tsx
import { Link, Route, Switch } from 'wouter'
import { EarningsPage } from '../features/earnings/EarningsPage.tsx'
import { HistoryPage } from '../features/history/HistoryPage.tsx'
import { PaydayPage } from '../features/payday/PaydayPage.tsx'
import { SettingsPage } from '../features/settings/SettingsPage.tsx'
import { TodayPage } from '../features/today/TodayPage.tsx'
import { t } from '../lib/i18n.ts'
import { paths } from './navigation.ts'
import { useSettings } from './settings.ts'

export function Routes() {
  const { locale } = useSettings()

  return (
    <Switch>
      <Route path={paths.today} component={TodayPage} />
      <Route path={paths.history} component={HistoryPage} />
      <Route path={paths.earnings} component={EarningsPage} />
      <Route path={paths.payday} component={PaydayPage} />
      <Route path={paths.settings} component={SettingsPage} />
      <Route>
        <p>{t(locale, 'notFound')}</p>
        <Link href={paths.today} replace className="text-brand-600 underline">
          {t(locale, 'backToToday')}
        </Link>
      </Route>
    </Switch>
  )
}
```

### 9. Shell: replace `src/app/App.tsx`

```tsx
import { Router, useLocation } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { UpdatePrompt } from '../pwa/UpdatePrompt.tsx'
import { BottomNav } from './BottomNav.tsx'
import { paths } from './navigation.ts'
import { Routes } from './routes.tsx'

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell />
    </Router>
  )
}

const TAB_PATHS: string[] = [paths.today, paths.history, paths.earnings, paths.payday, paths.settings]

function Shell() {
  const [location] = useLocation()
  const onTab = TAB_PATHS.includes(location)

  return (
    <>
      <main className={`mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 ${onTab ? 'pb-24' : ''}`}>
        {/* Mounted on every screen to keep the worker registered; shown only on the tabs, never over a form. */}
        <UpdatePrompt visible={onTab} />
        <Routes />
      </main>
      {/* Forms are a focused task: no tabs while one is open. */}
      {onTab && <BottomNav />}
    </>
  )
}
```

### 10. Settings page: edit `src/features/settings/SettingsPage.tsx`

- Remove the imports of `formatDate`, `todayIso`, `Calendar` (the whole `jalali.ts` import) and `BackupSection`.
- Remove `calendar`, `today` and `short` from `SettingsPage`.
- Delete the second `<TileGroup<Calendar> ...>` and the `<BackupSection />` line.
- Change the language tiles to:
  ```tsx
  options={[
    { value: 'vi', glyph: 'Vi', label: 'Tiếng Việt', lang: 'vi' },
    { value: 'en', glyph: 'Aa', label: 'English', lang: 'en' },
  ]}
  ```
- Change the comment above it to: `{/* Language names stay in their own language so anyone can find theirs. No flags. */}`
- Keep `TileGroup`, `StorageStatus` and the version line.

### 11. Tests

Rewrite `tests/unit/settings.test.ts` with these cases:

| Case | Expected |
|---|---|
| `detectLocale(['vi-VN', 'en-US'])` | `'vi'` |
| `detectLocale(['VI'])` | `'vi'` |
| `detectLocale(['en-US', 'vi-VN'])` | `'en'` |
| `detectLocale(['de-DE'])`, `detectLocale([])` | `'en'` |
| `resolveSettings(null, ['en-GB'])` | `toEqual` all the defaults: en, 6000, false, 0, 'none', null, 'inHand', 'fromSalon', null, false |
| Saved `{"locale":"en","defaultCommissionRateBp":5000,"weekStartDay":1}` with `['vi-VN']` | locale en, rate 5000, week start 1 |
| Bad saved values `'not json'`, `'42'`, `'null'`, `'{"locale":"fa","defaultCommissionRateBp":20000,"payPeriodType":"daily"}'` with `['vi-VN']` | locale vi, rate 6000, period none |

Replace `tests/e2e/helpers.ts` with:
```ts
import { expect, type Page } from '@playwright/test'

/**
 * Opens the app and waits until the service worker has precached it and
 * controls the page, the state a user is in after their first visit.
 */
export async function installApp(page: Page): Promise<void> {
  await page.goto('./')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

/** Call before the first page.goto(). Sets starting settings unless the app has already saved some. */
export async function seedSettings(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((settings) => {
    if (!localStorage.getItem('nail-tracker.settings')) localStorage.setItem('nail-tracker.settings', JSON.stringify(settings))
  }, { locale: 'en', onboardingDone: true, ...overrides })
}
```

In `playwright.config.ts` change `locale: 'fa-IR'` to `locale: 'en-US'` and add below it `timezoneId: 'America/Chicago',`.

In `tests/e2e/manifest.spec.ts` replace the last test with:
```ts
test('the document language follows the UI language', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('button', { name: /Switch to Vietnamese/ }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
})
```
and add `import { seedSettings } from './helpers.ts'` at the top.

Create `tests/e2e/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { seedSettings } from './helpers.ts'

test('all five tabs open, and the language choice survives a reload', async ({ page }) => {
  await seedSettings(page)
  await page.goto('./')
  const nav = page.getByRole('navigation')
  for (const [tab, heading] of [
    ['History', 'History'],
    ['Earnings', 'Earnings'],
    ['Payday', 'Payday'],
    ['Settings', 'Settings'],
    ['Today', 'Nail Tracker'],
  ]) {
    await nav.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  await page.getByRole('button', { name: /Switch to Vietnamese/ }).click()
  await expect(nav.getByRole('link', { name: 'Lịch sử' })).toBeVisible()
  await page.reload()
  await expect(nav.getByRole('link', { name: 'Lịch sử' })).toBeVisible()
})
```

## Files

Everything listed above. Nothing else.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test --workers=2` passes.
- `git grep -il "toman\|jalali\|daftar\.\|vazirmatn" -- src tests` prints nothing.

## Not in this task

Database (T05), any real screen.
