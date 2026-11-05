# T01: Rename the app and give it its look

- **Branch:** `task/T01-identity`
- **Milestone:** M1 Foundation
- **Depends on:** nothing
- **Size:** about 45 minutes

## Goal

The app still behaves like Daftar, but it is called Nail Tracker, uses a plum colour scheme and the Inter font, and has a new icon. No features change in this task.

## Steps

1. **Package name.** In `package.json` change `"name": "daftar"` to `"name": "nail-tracker"`.

2. **Font.** Run these two commands:
   ```
   pnpm add @fontsource-variable/inter
   pnpm remove @fontsource-variable/vazirmatn
   ```
   In `src/index.css` change `@import '@fontsource-variable/vazirmatn';` to `@import '@fontsource-variable/inter';`, and change the `--font-sans` line to:
   ```css
   --font-sans: 'Inter Variable', system-ui, sans-serif;
   ```

3. **Colours.** In `src/index.css` replace the whole `:root { ... }` block with:
   ```css
   :root {
     --brand-50: #f7eef5;
     --brand-100: #ecd6e6;
     --brand-200: #dcb6d2;
     --brand-400: #a8649a;
     --brand-600: #7a3b72;
     --brand-800: #5a2a54;
     --brand-900: #3d1c39;

     --page: #fbf8f4;
     --surface: #ffffff;
     --surface-subtle: #f3efe9;
     --text: #241f26;
     --text-secondary: #5e5862;
     --text-muted: #6b6570; /* 4.5:1 or better on surface, page and brand-50 */
     --border: rgb(36 31 38 / 0.12);
     --border-strong: rgb(36 31 38 / 0.24);

     --positive-bg: #e6f2ea;
     --positive-text: #2f6b46;
     --warning-bg: #faeeda;
     --warning-text: #854f0b;
     --danger-bg: #fcebeb;
     --danger-text: #a32d2d;
   }
   ```
   In the `@theme inline` block add these two lines just above `--color-warning-bg`:
   ```css
   --color-positive-bg: var(--positive-bg);
   --color-positive-text: var(--positive-text);
   ```
   In the comment above `:root`, change "Brand is an indigo ramp" to "Brand is a plum ramp".

4. **Vite config** (`vite.config.ts`):
   - Change `'/daftar/'` to `'/nail-tracker/'` in the `base` line, and change `/daftar/` to `/nail-tracker/` in the two comments.
   - In `manifest`, set these values and leave every other line alone:
     ```ts
     name: 'Nail Tracker',
     short_name: 'Nail Tracker',
     description: 'Track your turns, tips and pay. Private, works offline, no account.',
     lang: 'en',
     dir: 'ltr',
     theme_color: '#fbf8f4',
     background_color: '#fbf8f4',
     ```

5. **Playwright config** (`playwright.config.ts`): replace both `/daftar/` URLs and the comment with `/nail-tracker/`. Leave `locale: 'fa-IR'` for now; T04 changes it.

6. **index.html.** Replace the file with:
   ```html
   <!doctype html>
   <html lang="en" dir="ltr">
     <head>
       <meta charset="UTF-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
       <title>Nail Tracker</title>
       <meta name="description" content="Track your turns, tips and pay. Private, works offline, no account." />
       <meta name="theme-color" content="#fbf8f4" />
       <meta name="apple-mobile-web-app-capable" content="yes" />
       <meta name="apple-mobile-web-app-status-bar-style" content="default" />
       <meta name="apple-mobile-web-app-title" content="Nail Tracker" />
       <link rel="icon" href="/favicon.ico" sizes="48x48" />
       <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
       <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
     </head>
     <body>
       <div id="root"></div>
       <script type="module" src="/src/main.tsx"></script>
     </body>
   </html>
   ```

7. **Icon.** Replace `public/icon.svg` with exactly this, and write the same text to `public/favicon.svg`:
   ```svg
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
     <rect width="512" height="512" rx="112" fill="#7a3b72"/>
     <!-- A single nail, kept inside the central 80% so maskable crops never cut it. -->
     <path d="M176 392V232c0-66 36-120 80-120s80 54 80 120v160a24 24 0 0 1-24 24H200a24 24 0 0 1-24-24z" fill="#fbf8f4"/>
     <path d="M256 168c-30 0-48 36-48 76v12h96v-12c0-40-18-76-48-76z" fill="#dcb6d2"/>
   </svg>
   ```
   In `pwa-assets.config.ts` change both `'#534ab7'` to `'#7a3b72'`. Then run `pnpm generate-icons`. It rewrites the PNG files and `favicon.ico` in `public/`. Commit them.

8. **Remove Daftar's pictures:** delete `docs/demo.gif`, `docs/social-preview.png` and the folder `docs/screenshots/`. Keep `docs/product-spec.md`.

9. **README.md.** Replace the whole file with:
   ```markdown
   # Nail Tracker

   A free, private pay tracker for nail technicians. Record each turn, and see your commission, cash tips, card tips, what you earned, and what the salon still owes you. English and Vietnamese. Works offline. No account. Your data stays on your phone.

   ## Develop

       pnpm install
       pnpm dev
       pnpm gate

   `pnpm gate` runs lint, typecheck, unit tests and the build. Browser tests: `pnpm exec playwright test --workers=2`.

   The product document is [docs/product-spec.md](docs/product-spec.md). The build plan is in [tasks/nail-tracker](tasks/nail-tracker/tasks.md).

   ## Credit

   Started as a fork of [Daftar](https://github.com/atefeh-sa93/daftar) by atefeh-sa93, under the MIT license. See [LICENSE](LICENSE).
   ```
   Do not change the `LICENSE` file.

10. **Tests that change.**
    - `tests/e2e/manifest.spec.ts`, first test: change the expected values to `lang: 'en'` and `dir: 'ltr'`, and rename the test to `'the manifest is valid and every icon loads'`.
    - `tests/e2e/offline.spec.ts`: delete the last block of the "reloads, adds an expense" test that starts with the comment `// The font comes from the cache too`, down to `expect(fonts.join()).toContain('Vazirmatn')`. T21 brings a font check back.

## Files

`package.json`, `pnpm-lock.yaml` (changed by pnpm only), `src/index.css`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `pwa-assets.config.ts`, `public/*`, `docs/*`, `README.md`, `tests/e2e/manifest.spec.ts`, `tests/e2e/offline.spec.ts`

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test --workers=2` passes. One test named `welcome screen` in `a11y.spec.ts` is known to fail now and then because it runs during a fade animation. If only that test fails, run it again once; if it fails on colour contrast both times, write that in your report and carry on. T04 deletes that screen.
- `git grep -il daftar -- . ":(exclude)tasks" ":(exclude)LICENSE" ":(exclude)README.md"` may still list source files (those go in T04), but not `index.html`, `vite.config.ts`, `playwright.config.ts` or `package.json`.

## Not in this task

Language, currency, calendar, screens, database. Persian text stays on screen until T04.
