# V21: Light and dark mode

**Branch:** `task/V21-dark-mode`
**Read:** `docs/product-spec-v2.md` section 4.1 (colours); `src/index.css` (the colour variables and the `@theme`
block); `src/app/settings.ts` (`Settings`, `resolveSettings`, `resetSettings`, `applyToDocument`);
`src/features/settings/SettingsPage.tsx` (the language choice, the pattern to copy); `src/lib/i18n.ts`;
`index.html` and `vite.config.ts` (the theme colour); `src/features/share/shareCanvas.ts` (reads colours);
`tests/e2e/a11y.spec.ts` (axe per screen), `tests/e2e/share.spec.ts` (the fake share sheet);
`tests/unit/settings.test.ts` and `tests/unit/backup.test.ts` (full `Settings` objects).
**Goal:** at night the app is a calm deep plum-navy instead of a bright white screen, and the technician can pick
Light, Dark or Same as phone.

## 1. The choice

- Add `theme: 'system' | 'light' | 'dark'` to `Settings`, default `'system'`; anything else in storage reads as
  `'system'`. `resetSettings` keeps it, like the language. Backups carry settings: a backup without `theme` must
  still restore (it reads as `'system'`).
- Settings page: an `Appearance` / `Giao diện` choice next to the language, built the same way, with `Same as phone` /
  `Theo điện thoại`, `Light` / `Sáng`, `Dark` / `Tối`. Add the words to `i18n.ts` in both languages.
- `applyToDocument` sets `data-theme="light"` or `"dark"` on `<html>` for an explicit choice and removes it for
  `'system'`.
- So the first paint is right before React loads, add a small inline (non-module) script in `index.html`'s `<head>`
  that reads the saved settings from the same storage key, sets the attribute for `'light'` or `'dark'`, and does
  nothing if storage throws, is empty or holds anything else.

## 2. The dark colours

Light values stay exactly as they are; the light look must not change.

**Where the values go.** Write the dark list twice, identical (plain CSS has no way to share it): once as
`:root[data-theme='dark']` and once as `:root:not([data-theme='light'])` inside
`@media (prefers-color-scheme: dark)`. Wrap both inside `@media screen`, so printing always uses the light values.
Set `color-scheme: light` on the light set and `color-scheme: dark` on both dark sets, so date pickers, selects and
scroll bars follow. Make the light values apply to `:root, [data-theme='light']` (section 3 needs it).

**The look.** Deep plum-navy, never pure black: page about `#17131f`, cards about `#211b2a`, subtle surfaces and
borders a step lighter each; text near white with a plum tint. Money stays green, short stays orange-red, the lacquer
stays the main action. Tune the values until axe finds no contrast problem (Tests); keep the hue of each role.

**Brand colours, by use.**
- `brand-50`, `brand-100`, `brand-200` are soft fills (chips, the update prompt, a badge, the History calendar
  shading, the trend chart's other bars): in dark they become plum tints just above the card colour, each step a
  little stronger than the one before, so on the calendar a bigger day still looks stronger.
- `brand-400`, `brand-600`, `brand-800`, `brand-900` stay strong lacquer fills in dark (the main buttons with white
  text, the Home bottle gradient, the top calendar step with white text). Keep their light values unless contrast
  fails.
- Text, borders and outlines in lacquer need a light pink in dark, which a fill cannot be. Add `--brand-ink` (light:
  same as `--brand-600`; dark: a light lacquer pink) and `--brand-ink-strong` (light: same as `--brand-800`; dark: a
  paler pink), each with a Tailwind colour beside the others. Then `grep -rn "brand-" src`, sort every hit into fill
  or ink, and move every ink use: `text-brand-600` to `text-brand-ink`, `border-brand-600` and `border-b-brand-600`
  (`MoneyField.tsx`) to `brand-ink`, `outline-brand-600` to `outline-brand-ink`, `text-brand-800` and
  `text-brand-900` to `text-brand-ink-strong`. Keep the selected-day border on the Home bottles on `brand-ink`. List
  every hit and its choice in the report.

**Dark blocks with white text.** `bg-text` with `text-white` makes an inverted block in `Toast.tsx` (the undo bar),
`NumberPad.tsx` (a key) and `TurnRow.tsx`. Add `--inverse` and `--on-inverse` (light: the ink `#1d1822` and white;
dark: a raised plum about `#3a3046` and near white) and use them in those three places. On Home, `bg-text` is only
the bottle cap: leave it on `text`, it reads as a light cap in dark.

**Hard-coded colours to move into variables:** the number pad tray `#e7e1ea` and its `bg-white` keys
(`NumberPad.tsx`), the future-day bottle `#ecd9d1` (`HomePage.tsx`, twice: the bottle and the legend), the undo link
`#ffb3cd` (`Toast.tsx`). Leave the red swipe-delete, the service dot colours, shadows, `bg-white/35` and the dark
see-through backdrops as they are. When done, `grep` for `#` colours, `bg-white`, `text-white` and `rgb(` in `src/`
and say in the report why each one left is fine in both modes.

**The phone's top bar.** Keep `<meta name="theme-color" content="#f7f4f8">` and give it
`media="(prefers-color-scheme: light)"`; add a second one with `media="(prefers-color-scheme: dark)"` and the dark
page colour. In `settings.ts`, keep the two page colours as named constants (the only colours allowed outside
`index.css`): for `'light'` or `'dark'`, `applyToDocument` sets both tags to that mode's colour; for `'system'` it
puts each back to its own. The manifest stays as it is.

## 3. What stays light

- **Share pictures** go to the salon owner, so they stay light in dark mode. In `shareCanvas.ts`, create a hidden
  element with `data-theme="light"`, add it to the page, read the colours from it with `getComputedStyle`, then
  remove it. Do not read from `<html>`.
- **Printing** (the Taxes page) is light by the `@media screen` wrap in section 2; check it with
  `page.emulateMedia({ media: 'print' })` in the theme test.

## Tests

- Unit: `resolveSettings` reads each theme and falls back to `'system'`; add `theme` to the `Settings` objects in
  `tests/unit/settings.test.ts` (the defaults check) and `tests/unit/backup.test.ts`, and check an old backup without
  `theme` still restores.
- Browser, `tests/e2e/theme.spec.ts` (one `test.describe` per colour scheme, each with `test.use({ colorScheme })`):
  - phone dark, no choice: Home's body background is dark;
  - choosing Light in Settings makes it light, and that survives a reload;
  - phone light, choosing Dark makes it dark; then block the app script with
    `page.route('**/assets/index-*.js', (route) => route.abort())`, reload, and check `<html data-theme="dark">` and a
    dark body background, which proves the inline script works on its own;
  - a share picture made in dark mode has a light background: copy the fake share sheet from `share.spec.ts`, and in
    it run `createImageBitmap(file)`, draw it on an `OffscreenCanvas`, and push pixel (0,0) to the window array;
  - Taxes with print media in dark mode has a light background.
- `a11y.spec.ts`: wrap the existing groups and the onboarding test in `for (const scheme of ['light', 'dark'])`
  `test.describe(scheme, () => { test.use({ colorScheme: scheme }); ... })`, so axe checks contrast in both, with the
  same checks. Add axe checks, in dark only, for the number pad open, History's calendar, Taxes and the Settings page
  with the Appearance choice. Fix the colours, never the rules.
- Save a full-page dark screenshot of each screen the a11y spec visits, in dark only, to `screenshots/dark/` at the
  repo root (add it to `.gitignore`; Playwright empties `test-results/` on every run) for a person to look at.
- Existing tests change only in how they find things. Before your first change, save a few light screenshots (Home,
  Add turn with the pad, Paycheck, History calendar); after, compare them by eye and say in the report that the light
  look is unchanged.

## Done when

`pnpm gate` passes and the full browser suite passes with `--workers=2`.
