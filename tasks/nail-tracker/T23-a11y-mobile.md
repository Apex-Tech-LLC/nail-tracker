# T23: Accessibility and iPhone width

- **Branch:** `task/T23-a11y-mobile`
- **Milestone:** M5 Testing and polish
- **Depends on:** T22
- **Size:** about 45 minutes

## Goal

Every screen passes an automatic accessibility audit, in both languages, and nothing scrolls sideways at 375px wide.

## Steps

### 1. Create `tests/e2e/a11y.spec.ts`

Start from `git show daftar-base:tests/e2e/a11y.spec.ts` for the `audit` function. Keep `audit` exactly: tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`, and any violation fails.

Add a second check in the same file:
```ts
async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}
```

Set the size for the whole file:
```ts
test.use({ viewport: { width: 375, height: 667 } })
```

Run through this list for both languages with a loop `for (const locale of ['en', 'vi'] as const)`. Add data first in English through the helpers, then change language by writing to storage, because the helpers only speak English:
```ts
await page.evaluate((value) => {
  const saved = JSON.parse(localStorage.getItem('nail-tracker.settings') ?? '{}')
  localStorage.setItem('nail-tracker.settings', JSON.stringify({ ...saved, locale: value }))
}, locale)
await page.reload()
```

**Data to add first:** with the clock fixed at `2026-11-04T12:00:00` and `weeklyPay` settings: `addTurn(page, { amount: '1234.56', cash: '100', card: '200' })`. Large numbers test the width. Then one adjustment of `-25` and one payment of `100` through the screens.

| Screen | How to open |
|---|---|
| Today, with data | `./` |
| Today, empty | A separate test with no data |
| Add Turn | `./#/add` |
| Add Turn, all open | Same, press Add service, press More options |
| Edit Turn | From Today, tap `Turn #1` |
| History | `./#/history` |
| Earnings | `./#/earnings` |
| Payday list | `./#/payday` |
| Period | Tap the period |
| Payment form | Press Record payment. Type `100` as the amount |
| Adjustment form | `./#/adjustment/new` |
| Settings | `./#/settings` |
| Service presets | `./#/settings/services` |
| Preset editor | Press Add a service |
| Onboarding, all four steps | Separate test, no `seedSettings`, press Next three times. Audit each step |
| Delete dialog | On Edit Turn, press Delete. Audit with the dialog open |

For each: wait for the page heading to be visible, then `await audit(page)` and `await noSidewaysScroll(page)`.

One test per screen group is fine. Do not put everything in one test: a failure must name the screen.

### 2. Tap targets

Add a test that opens Add Turn and checks the real buttons and fields:
```ts
const small = await page.evaluate(() =>
  [...document.querySelectorAll('button, a, input:not([type=checkbox]), select, textarea')]
    .map((element) => ({ text: element.textContent?.trim() || element.getAttribute('aria-label'), height: element.getBoundingClientRect().height }))
    .filter((item) => item.height > 0 && item.height < 40),
)
expect(small).toEqual([])
```
Run the same check on Today and Settings. Checkbox inputs are left out because their whole `<label>` row is the target.

The handbook asks for 44px. This test allows 40 to leave room for rounding. Fix chips or icon buttons that fall short with `min-h-11`.

### 3. iPhone input zoom

Add a test: on Add Turn, every `input, select, textarea` has a computed font size of at least 16:
```ts
const sizes = await page.evaluate(() =>
  [...document.querySelectorAll('input, select, textarea')].map((element) => parseFloat(getComputedStyle(element).fontSize)),
)
expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16)
```

### 4. Fix what fails

Usual fixes:

| Problem | Fix |
|---|---|
| Colour contrast | Use `text-text-secondary` or `text-text-muted`. Do not invent a new colour. Amount colours `text-positive-text` and `text-warning-text` on `bg-surface` are fine. If one fails on a tinted background, use `text-text` there |
| Input with no name | Add a `<label htmlFor>` |
| Heading order | Pages have one `<h1>`, then `<h2>`. Do not skip levels |
| Sideways scroll from a long amount | `min-w-0` on the text, `shrink-0` on the number, and `flex-wrap` on the row |
| Sideways scroll from Vietnamese text in chips | `flex-wrap` on the chip row |
| Page landmark warnings | Content goes inside `<main>`, which `App.tsx` already has |
| Dialog has no name | `aria-labelledby` from T09 |

Do not suppress a rule. Do not add `.disableRules`. If a rule cannot be met after 3 tries, report BLOCKED and name it.

### 5. Reduced motion

`src/index.css` already turns motion off for people who ask for that. Nothing to do.

## Files

Create `tests/e2e/a11y.spec.ts`. Change any screen file only to fix what the tests find.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test tests/e2e/a11y.spec.ts --workers=2` passes.
- `pnpm exec playwright test --workers=2` passes in full.

## Not in this task

Charts (T24).
