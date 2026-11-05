# Nail Tracker: builder's handbook

Read this file first, then read only the one brief you were given (`T##-*.md` in this folder).
You should not need anything else. The full product document is `docs/product-spec.md`. Open it only if a brief tells you to.

## What we are building

A free, private phone app for one nail technician in the United States. They record each customer ("turn"), and the app works out commission, tips, what they earned, and what the salon still owes them. English and Vietnamese. Works offline. No account. No server. All data stays on the phone.

We start from a fork of an expense tracker called Daftar. Its bones are good (app shell, database, offline support, backup, tests). Its content (Persian language, Jalali calendar, Toman currency, expenses) gets replaced. The original code can always be read with `git show daftar-base:<path>`, for example `git show daftar-base:src/features/expenses/ExpenseForm.tsx`.

## Rules for every task

1. **One task per session.** Do only what your brief says. If you notice something else that is wrong, mention it in your final report. Do not fix it.
2. **Git.** The brief names your branch. Before you start, run `git checkout main` then `git checkout -b <branch>`. Commit to that branch. **Do not push. Do not run `gh`. Do not merge.** The manager does those.
3. **Do not edit anything under `tasks/`.** Copy from it when a brief says so. The manager updates it.
4. **No new packages** unless your brief says so by name. Never hand-edit `pnpm-lock.yaml`.
5. **The folder name has a space.** Always put paths in quotes: `"C:/Bay/Projects/Nail Tracker"`.
6. **Run the gate before you finish:** `pnpm gate`. It runs lint, typecheck, unit tests and the build. All four must pass. Fix what fails.
7. **End-to-end tests** run with `pnpm exec playwright test --workers=2`. Never raise the worker count: this computer is shared. To run one file: `pnpm exec playwright test tests/e2e/today.spec.ts --workers=2`.
8. **Do not run `pnpm dev` or any server in the background.** Playwright starts and stops its own.
9. **Stuck?** If the same error survives 3 honest attempts, stop. Commit nothing broken. Send the final report with `Status: BLOCKED`, the exact error, and what you tried.
10. **Never weaken a test to make it pass.** Ready-made tests in `tasks/nail-tracker/reference/unit/` are the definition of correct. If you think one is wrong, report BLOCKED.

### Final report (always end your session with exactly this shape)

```
Status: DONE or BLOCKED
Task: T##
Branch: task/T##-name
Commit: <short hash>
Gate: pass or fail (paste the last 5 lines of pnpm gate)
E2E: pass or fail or not run (paste the summary line)
Changed: <one line per file>
Notes: <anything the manager should know, or "none">
```

## Tech you will use

React 19, TypeScript 7, Vite 8, Tailwind 4, Dexie 4 (database on the phone), `dexie-react-hooks` (`useLiveQuery` re-renders a screen when data changes), wouter (routes in the URL hash), Vitest (unit tests in `tests/unit/`), Playwright (browser tests in `tests/e2e/`), oxlint, pnpm.

Do **not** add React Router, Zod, date-fns, Zustand or a chart library. We use what is already here on purpose.

## How the code is laid out

| Folder | What lives there | Rule |
|---|---|---|
| `src/domain/` | Money, dates, commission, totals, pay period maths | Plain TypeScript. Must not import React, Dexie or anything from `src/app`, `src/db`, `src/features` |
| `src/db/` | Database tables and seed data | |
| `src/features/<name>/` | Screens and their stores | One folder per screen area |
| `src/ui/` | Small shared components (added in T06 onward) | |
| `src/app/` | Shell, routes, navigation, settings | |
| `src/lib/i18n.ts` | Every word on screen | |
| `src/pwa/` | Offline badge, update prompt, storage permission | Leave alone unless told |

## Code style

- Imports include the `.ts` or `.tsx` ending: `import { t } from '../lib/i18n.ts'`. Use `import type` for types only.
- No semicolons, single quotes, 2 spaces. Match the file you are in.
- Function components with named exports. Comments only where the reason is not obvious.
- **No `any`.** No `// @ts-ignore`. `noUnusedLocals` is on, so delete what you stop using.
- Every word a user sees comes from `t(locale, 'key')`, or `tf(locale, 'key', { n: 8 })` for text with a `{n}` slot. `const { locale } = useSettings()` gives the language. **All needed keys are already in `src/lib/i18n.ts` after T04.** Do not rename them. If you truly need a new one, add it to both `en` and `vi` and say so in your report.

## Money rules (the part that must never be wrong)

- Money is **always a whole number of cents** in a `number`: $45.50 is `4550`. Never store or add dollars. Never use `parseFloat` or `toFixed` on money.
- Commission rates are **whole basis points**: 60% is `6000`, 62.5% is `6250`.
- Text to number: `parseCents`, `parseSignedCents`, `parseRateBp`. Number to text: `formatUsd`, `formatRate`, `centsToInput`, `rateToInput`. All in `src/domain/money.ts`.
- Commission is rounded half up **per service line**, then the rounded lines are added (`turnTotals` in `src/domain/commission.ts`).
- Every Turn stores its own rate, name and totals. Changing a default later must never change old turns.
- Earned, received and owed are three different numbers. Earned = commission + tips + adjustments. Received = tips already in hand plus payments. Owed = what the salon still has to pay. Never mix them. `sumTotals` in `src/domain/totals.ts` does this.

## Date rules

- A work day is text: `'2026-11-04'` (type `IsoDate`). Compare and sort these as text.
- All date maths goes through `src/domain/dates.ts`. Never add `86400000` to a timestamp; clock changes break that.
- `occurredAt`, `createdAt` and `updatedAt` are `Date.now()` numbers. `localWorkDate` is what decides which day a turn belongs to, so a shift past midnight can stay on the day it started.

## UI rules

Phone first, 375px wide. Page content sits inside `main` in `src/app/App.tsx` (`mx-auto max-w-md p-4 gap-4`).

Copy these class names exactly so screens match:

```ts
const card = 'rounded-card border border-border bg-surface p-4'
const field = 'w-full rounded-control border border-border-strong bg-surface px-3 py-3 text-base'
const label = 'mb-1 block text-sm text-text-secondary'
const chip = 'rounded-full border px-3 py-2 text-sm'
const chipOn = 'border-brand-400 bg-brand-50 text-brand-900'
const chipOff = 'border-border-strong'
const primaryButton = 'w-full rounded-control bg-brand-600 px-4 py-3 text-base font-medium text-white'
const secondaryButton = 'w-full rounded-control border border-border-strong px-4 py-3 text-base'
const dangerButton = 'w-full rounded-control border border-danger-text px-4 py-3 text-base text-danger-text'
const errorText = 'mt-1 text-sm text-danger-text'
```

- Inputs must be `text-base` (16px) or larger. Smaller text makes iPhones zoom in.
- Money and percent inputs: `<input type="text" inputMode="decimal" autoComplete="off">`. Never `type="number"`.
- Every input has a real `<label htmlFor>`. Generate ids with `useId()`.
- Buttons have `type="button"` unless they submit a form. Icon-only buttons need `aria-label`.
- Tap targets are at least 44px tall.
- Status is never shown by colour alone: always text too.
- Icons come from `@tabler/icons-react`, with `aria-hidden="true"`.
- Forms use `noValidate` and show errors with `errorText` under the field, joined by `aria-describedby`.
- Pattern to copy for a form: `git show daftar-base:src/features/expenses/ExpenseForm.tsx`. Pattern for loading: `useLiveQuery` returns `undefined` while loading, so `if (data === undefined) return null`.

## Words that mean something here

| Word | Meaning |
|---|---|
| Turn | One customer visit recorded by the technician. It can have several services |
| Service | One thing done: manicure, Gel-X and so on |
| Commission | The technician's share of the service price |
| Earned | Commission + tips + adjustments |
| Tips in hand | Tips already physically received |
| Expected payout | What the salon should pay: commission + tips not in hand + adjustments that affect pay |
| Outstanding | Expected payout minus payments |
| Adjustment | A separate signed money record, such as a bonus or a correction |
| Pay period | A date range the salon pays for |
| Payment allocation | The part of one payment that belongs to one pay period |

## Traps that have already caught someone

- `csvCell` in the old CSV code puts `'` in front of text starting with `-`. A money value like `-5.00` must not get that: use a separate numeric cell (T20 covers it).
- Accessibility tests can fail if run while `.animate-fade-in` is still moving. Do not put that animation on any screen that is audited.
- `tsconfig.app.json` checks `src` and `tests/unit`, so a broken test fails typecheck too.
- `tests/unit/money.test.ts` already exists in the old code and tests the old money file. T02 overwrites it on purpose.
- Tests that use the database need `import 'fake-indexeddb/auto'` as the first import, a fresh `createDb('test-' + n)` per test, and `await db.delete()` in `afterEach`. Pattern: `tests/unit/db.test.ts`.
- In Dexie, a `transaction` callback must only await Dexie calls. Doing `fetch` or `setTimeout` inside ends the transaction.
- Playwright's locale is set in `playwright.config.ts`. Tests set language themselves through `seedSettings` (see T04), so do not rely on the browser language.
- Windows: use `pnpm exec`, not `npx`.
