# V01: New look

**Branch:** `task/V01-new-look`
**Read:** spec section 4.1; `docs/design/v2-mockup.html` (its `<style>` block holds every number below).
**Goal:** the whole app takes on the version 2 look by changing the shared design pieces. No screen layout changes and
no new features: those are later tasks. Every existing browser test must still pass unchanged.

## Steps

### 1. Font

- Add the package `@fontsource/be-vietnam-pro` with `pnpm add @fontsource/be-vietnam-pro`. Remove
  `@fontsource-variable/inter` with `pnpm remove @fontsource-variable/inter`.
- In `src/index.css` replace the Inter import with only the Latin and Vietnamese files for weights 400, 500, 600, 700
  and 800, for example `@import '@fontsource/be-vietnam-pro/latin-400.css';` and
  `@import '@fontsource/be-vietnam-pro/vietnamese-400.css';` (10 imports). Check the file names exist in
  `node_modules/@fontsource/be-vietnam-pro/` before using them. Do not import the whole package: that would precache
  every subset for offline use.
- `--font-sans: 'Be Vietnam Pro', system-ui, sans-serif;`
- In the `body` rule add `font-variant-numeric: tabular-nums;` so every number lines up.

### 2. Colours (`src/index.css`, `:root`)

Keep every variable name; change the values:

| Variable | New value |
|---|---|
| `--brand-50` | `#fbe7ef` |
| `--brand-100` | `#f6d0df` |
| `--brand-200` | `#eaa6c0` |
| `--brand-400` | `#c42a64` |
| `--brand-600` | `#a3164d` |
| `--brand-800` | `#7d0f3a` |
| `--brand-900` | `#5c0a2a` |
| `--page` | `#f7f4f8` |
| `--surface` | `#ffffff` |
| `--surface-subtle` | `#efe9f2` |
| `--text` | `#1d1822` |
| `--text-secondary` | `#5d5566` |
| `--text-muted` | `#6e6676` (4.65:1 on brand-50, the lowest background it sits on) |
| `--border` | `#ebe5ee` |
| `--border-strong` | `#d6ccdb` |
| `--positive-bg` / `--positive-text` | `#e3f4ec` / `#0d7a57` |
| `--warning-bg` / `--warning-text` | `#fdeee6` / `#b4441b` |
| `--danger-bg` / `--danger-text` | `#fcebeb` / `#b42318` |

Radii in `@theme inline`: `--radius-card: 18px; --radius-control: 12px;` and add `--radius-button: 16px;`.

Change `#fbf8f4` to `#f7f4f8` in `index.html` (theme-color), `vite.config.ts` (manifest `theme_color` and
`background_color`), `public/favicon.svg` and `public/icon.svg`. Do not regenerate the PNG icons.

### 3. Shared styles (`src/ui/styles.ts`)

Replace the class strings, keeping every export name. Add the new `list` and `pageTitle` exports.

```ts
export const card = 'rounded-card border border-border bg-surface p-4'
// One white card holding rows split by thin lines (spec 4.1: not one card per row).
export const list = 'divide-y divide-border overflow-hidden rounded-card border border-border bg-surface'
export const field = 'w-full rounded-control border-[1.5px] border-border-strong bg-surface px-3.5 py-3 text-base focus:border-brand-600 focus:outline-none'
export const label = 'mb-1.5 block text-sm font-semibold text-text-secondary'
export const chip = 'min-h-11 rounded-control border-[1.5px] px-3 py-2 text-sm font-semibold'
export const chipOn = 'border-brand-600 bg-brand-50 text-brand-800'
export const chipOff = 'border-border bg-surface'
export const primaryButton = 'w-full min-h-14 rounded-button bg-brand-600 px-4 py-3 text-[17px] font-bold text-white shadow-[0_10px_24px_-8px_rgb(163_22_77/0.6)]'
export const secondaryButton = 'w-full min-h-12 rounded-button border-[1.5px] border-text bg-surface px-4 py-3 text-base font-bold'
export const dangerButton = 'w-full min-h-12 rounded-button border-[1.5px] border-danger-text px-4 py-3 text-base font-bold text-danger-text'
export const errorText = 'mt-1 text-sm text-danger-text'
export const pageTitle = 'text-[30px] font-extrabold leading-tight tracking-[-0.03em]'
```

If Tailwind does not generate `rounded-button`, add `--radius-button` under `@theme inline` as above; Tailwind 4 turns
`--radius-*` theme variables into `rounded-*` classes.

Keep focus rings visible on buttons and chips: they must still show a ring on keyboard focus.

### 4. Page titles (`src/app/PageHeader.tsx`)

The `<h1>` uses `pageTitle` from `styles.ts`. The language button gets `bg-surface border-border font-semibold`.

### 5. Bottom bar (`src/app/BottomNav.tsx`)

As in the mockup's `.nav`: background `bg-surface/90` with `backdrop-blur`, top border `border-border`, labels
`text-[11px] font-semibold`, active tab `text-brand-600`, icons 24px. Do not change the tabs, labels or links.

### 6. Big numbers

Find the big headline numbers (the total on Today, Earnings and the period screen; search for `text-3xl` and `text-2xl`
in `src/features`). Give them `font-extrabold tracking-[-0.03em]`. Money that is earned keeps `text-positive-text`;
money owed keeps `text-warning-text`.

### 7. Lists

Where a screen renders turn rows or payment rows as separate cards stacked with a gap, leave that for V02. Do not change
`TurnRow.tsx`.

## Done when

- `pnpm gate` passes and the full browser suite passes with `--workers=2`, with no test changed. If a test checks the
  old font or a colour value, report it instead of changing it.
- `grep -rn "fbf8f4\|inter" src index.html vite.config.ts public/*.svg` (case-insensitive for inter) finds nothing.
- The production build's precache list (printed by `pnpm build`) holds Be Vietnam Pro `.woff2` files for Latin and
  Vietnamese only, and no Inter files.
