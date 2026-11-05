# T21: Offline and install checks

- **Branch:** `task/T21-offline`
- **Milestone:** M4 Offline and backup
- **Depends on:** T20
- **Size:** about 30 minutes

## Goal

Prove with tests that the whole app works with no internet and installs as an app. The code is mostly there already; this task adds proof and fixes what the proof finds.

## Steps

### 1. Bring the old test back

```
git show daftar-base:tests/e2e/offline.spec.ts > tests/e2e/offline.spec.ts
```

Then rewrite its contents:

- Imports: `addTurn`, `installApp`, `seedSettings` from `./helpers.ts`.
- `test.beforeEach`:
  ```ts
  test.beforeEach(async ({ page }) => {
    await seedSettings(page)
    await installApp(page)
  })
  ```
- Keep `'precaches the app shell, including the font'` as it is.
- Keep `'shows the offline badge only while offline'`. Its locator `header [role=status] > span` still works.
- Delete the other two old tests, `'reloads, adds an expense and shows it in the list and summary while offline'` and `'keeps data after the app is closed and reopened offline'`. Steps 2 and 3 replace them.

### 2. New offline test

`addTurn` uses `page.goto`, which does a real navigation. With the service worker in control that works offline, because `navigateFallback` answers from the cache.

```ts
test('works from start to finish with no connection', async ({ page, context }) => {
  await addTurn(page, { amount: '100', cash: '10', card: '15' })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Turn #1')).toBeVisible()

  await addTurn(page, { amount: '50', service: 'Pedicure' })
  await expect(page.getByText('Turn #2')).toBeVisible()

  const nav = page.getByRole('navigation')
  await nav.getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible()
  await expect(page.getByText('Turn #2')).toBeVisible()

  await nav.getByRole('link', { name: 'Earnings' }).click()
  await expect(page.getByText('$115.00').first()).toBeVisible()

  // The font comes from the cache too, not a fallback.
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)
  })
  expect(fonts.join()).toContain('Inter')
})
```
$115.00 is the earned total: commission $60 + tips $25 + commission $30.

### 3. Data survives a closed tab

Add a test in the same file:
```ts
test('data is still there after the app is closed and opened again', async ({ page, context }) => {
  await addTurn(page, { amount: '100' })
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('./')
  await expect(reopened.getByText('Turn #1')).toBeVisible()
})
```

### 4. No outside requests

Add a test: collect every request URL with `page.on('request', ...)` before `goto`, add a turn, open every tab. Then assert every URL starts with `http://localhost:4173/`, or starts with `blob:` or `data:`. This is the proof that no financial data leaves the phone.

Because `beforeEach` opens the page first, register the listener at the top of the test and then do a `page.reload()` before adding the turn.

### 5. Install on iPhone

Add a check to `tests/e2e/manifest.spec.ts`:
```ts
test('has what an iPhone needs to add it to the home screen', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Nail Tracker')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
})
```

### 6. Storage warning

Check that `backupHint` appears on Settings. It is the spec's warning that browser data can be deleted. T20 added it through `BackupSection`. If it does not show, fix it.

### 7. Fix what fails

If an offline test fails, the likely causes, in order:
1. A file type is not listed in `globPatterns` in `vite.config.ts`.
2. A screen does something that needs the network. Nothing should.

Do not raise timeouts to hide a problem.

## Files

Create `tests/e2e/offline.spec.ts`. Edit `tests/e2e/manifest.spec.ts`. Edit `vite.config.ts` only if a test proves it is needed.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/offline.spec.ts tests/e2e/manifest.spec.ts --workers=2` passes.

## Not in this task

Accessibility (T23).
