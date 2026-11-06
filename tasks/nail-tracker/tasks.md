# Nail Tracker

**Status key:** ⬜ pending · 🔄 in progress · ✅ verified · 🚫 blocked

Read `README.md` in this same folder first. It holds the rules, patterns and traps. This file is only the plan. Each task has its own brief, `T##-*.md`, which holds every detail the builder needs.

## Goal

Turn the Daftar fork into Nail Tracker: a free, private, offline phone app for one nail technician to record turns, tips and commission, and to check what the salon still owes. English and Vietnamese. The product document is `docs/product-spec.md`.

## Who does what

- **Builder (DeepSeek V4.1 Flash in the DeepSeek Harness):** one task per session, from one brief. Commits to the task branch. Does not push.
- **Manager:** starts each session, checks the work, pushes, opens the pull request, waits for checks, merges, updates this file.

Tasks run **one at a time, in order.** All builders share one checkout.

## Validation commands

- All four checks: `pnpm gate`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Unit tests: `pnpm test`
- Build: `pnpm build`
- Browser tests: `pnpm exec playwright test --workers=2`

## Manager's loop for each task

1. Confirm `main` is clean and up to date: `git checkout main`, `git pull`.
2. Start one builder session with this message, changing the task:
   ```
   You are the builder for the Nail Tracker app in "C:/Bay/Projects/Nail Tracker".
   Read tasks/nail-tracker/README.md, then tasks/nail-tracker/T01-identity.md.
   Do exactly that one task and follow the handbook's rules.
   Finish with the final report in the handbook's format.
   ```
3. On `Status: BLOCKED`, read the error, then either fix the brief and restart the task, or split the task.
4. On `Status: DONE`, check the work yourself. Do not trust the report:
   - `git log main..HEAD --stat` shows only the files the brief allows.
   - Run `pnpm gate`, then the brief's browser test command.
   - Read the diff against the brief, looking for skipped steps, changed tests, and money done with floats.
5. If it is wrong, start a new session for that task with the list of what to fix, on the same branch.
6. If it is right: `git push -u origin <branch>`, then `gh pr create --repo Unity7/nail-tracker --base main --head <branch>`. Always pass `--repo`.
7. Wait for the checks on GitHub to pass, then `gh pr merge --repo Unity7/nail-tracker --squash --delete-branch`.
8. Confirm the merge on GitHub. Update the status table and Execution Log below in a small commit on `main`.

## Tasks

### Milestone 1: Foundation

| # | Task | Depends on | Status | Verify |
|---|---|---|---|---|
| T01 | [Rename the app and give it its look](T01-identity.md) | none | ✅ | `pnpm gate` and all browser tests pass |
| T02 | [Money and date helpers](T02-money-dates.md) | T01 | ✅ | Ready-made tests pass, `pnpm gate` passes |
| T03 | [Commission and totals maths](T03-commission-totals.md) | T02 | ✅ | Ready-made tests pass, `pnpm gate` passes |
| T04 | [Swap to the new empty shell](T04-new-shell.md) | T03 | ✅ | `pnpm gate` and all browser tests pass, no old words left in `src` |
| T05 | [Database, seed data, turn store](T05-database.md) | T04 | ✅ | Store tests pass, `pnpm gate` passes |

### Milestone 2: Core tracking

| # | Task | Depends on | Status | Verify |
|---|---|---|---|---|
| T06 | [Add Turn form, basic](T06-add-turn-basic.md) | T05 | ✅ | `add-turn` browser tests pass |
| T07 | [Today dashboard](T07-today.md) | T06 | ✅ | `today` browser tests pass |
| T08 | [Several services, More options, Save & Add Another](T08-add-turn-full.md) | T07 | ✅ | `add-turn` and `today` browser tests pass |
| T09 | [Edit and delete a turn](T09-edit-delete.md) | T08 | ✅ | `edit-turn` browser tests pass |
| T10 | [History](T10-history.md) | T09 | ✅ | `history` browser tests pass |
| T11 | [Service presets screen](T11-presets.md) | T10 | ✅ | `presets` browser tests pass |
| T12 | [Adjustments](T12-adjustments.md) | T11 | ✅ | `adjustments` browser tests pass |

### Milestone 3: Earnings and payday

| # | Task | Depends on | Status | Verify |
|---|---|---|---|---|
| T13 | [Earnings screen](T13-earnings.md) | T12 | ✅ | `earnings` browser tests pass |
| T14 | [Pay period logic and store](T14-pay-periods.md) | T13 | ✅ | Ready-made tests and store tests pass |
| T15 | [Payday list and period detail](T15-payday-screens.md) | T14 | ✅ | `payday` browser tests pass |
| T16 | [Payments and allocations](T16-payments.md) | T15 | ✅ | `payday` and `earnings` browser tests pass |
| T17 | [Full Settings screen](T17-settings.md) | T16 | ✅ | `settings` browser tests pass |
| T18 | [First-launch onboarding](T18-onboarding.md) | T17 | ✅ | All browser tests pass |

### Milestone 4: Offline and backup

| # | Task | Depends on | Status | Verify |
|---|---|---|---|---|
| T19 | [JSON backup, restore, migrations](T19-backup-json.md) | T18 | ⬜ | `backup` unit tests pass |
| T20 | [CSV, backup buttons, delete all](T20-csv-backup-ui.md) | T19 | ⬜ | `backup` and `settings` browser tests pass |
| T21 | [Offline and install checks](T21-offline.md) | T20 | ⬜ | `offline` and `manifest` browser tests pass |

### Milestone 5: Testing and polish

| # | Task | Depends on | Status | Verify |
|---|---|---|---|---|
| T22 | [End-to-end acceptance and edge cases](T22-acceptance.md) | T21 | ⬜ | All browser tests pass |
| T23 | [Accessibility and iPhone width](T23-a11y-mobile.md) | T22 | ⬜ | All browser tests pass |
| T24 | [Charts on Earnings](T24-charts.md) | T23 | ⬜ | `earnings` and `a11y` browser tests pass, no new package |
| T25 | [Final sweep and deployment](T25-final.md) | T24 | ⬜ | All searches clean, all browser tests pass, site live |

## Definition of done

All 25 tasks are ✅, and on the live site at https://unity7.github.io/nail-tracker/ a person can:

- Open the app with no account, and pick Vietnamese or English.
- Set a 60/40 or custom commission.
- Add several turns with service amounts, cash tips and card tips.
- See correct daily and weekly earnings.
- Review and edit history.
- See what the salon still owes on payday.
- Export and restore all data.
- Use it offline, installed on an iPhone.

A Vietnamese speaker should read the wording before real users see it. The translations have not been checked by one.

## Execution Log

_(One row per attempted task.)_

| Date | Task | Outcome | Agent | Evidence / notes |
|---|---|---|---|---|
| 2026-11-05 | T01 | ✅ merged as PR #1 | DeepSeek V4.1 Flash (DeepSeek Harness) | Manager re-ran gate and browser tests: 16 of 17 passed first run, welcome screen passed on the allowed re-run. GitHub CI passed. CI did not start on this fork until the Actions permission was re-saved. Builder ran the harness sandbox repair on the project folder; backups in C:/Bay/Projects/_acl-recovery. The manager added Nail Tracker to the kit pause config on Bay's instruction, so the FRAMELINE and MeanSpy pause does not hold its merges. |
| 2026-11-05 | T02 | ✅ merged as PR #2 | DeepSeek V4.1 Flash (DeepSeek Harness) | Manager re-ran the gate: 225 unit tests pass, test files identical to the ready-made ones. GitHub CI passed and started by itself. |
| 2026-11-05 | T03 | ✅ merged as PR #3 | DeepSeek V4.1 Flash (DeepSeek Harness) | Manager re-ran the gate: 259 unit tests pass, test files identical to the ready-made ones, maths read line by line against the brief. GitHub CI passed. |
| 2026-11-05 | T04 | ✅ merged as PR #4 | DeepSeek V4.1 Flash (DeepSeek Harness) | Manager re-ran the gate (156 unit tests) and all 4 browser tests, compared the brief's code blocks to the files, and found no old words left. GitHub CI passed. Leftovers for a later task: stale comments in src/pwa/persistStorage.ts and src/main.tsx, unused fade-in animation in src/index.css. |
| 2026-11-05 | T05 | ✅ merged as PR #5 | DeepSeek V4.1 Flash (DeepSeek Harness) | Manager re-ran the gate (167 unit tests), compared schema and seed to the brief (identical), read the store and tests against it. GitHub CI passed. |
| 2026-11-05 | T06 | ✅ merged as PR #6 | DeepSeek V4.1 Flash (DeepSeek Harness) | Manager re-ran the gate (167 unit tests) and all 10 browser tests and read the form against the brief. GitHub CI passed. Known gap: a double tap on Save can record a turn twice; to be fixed in T08. |
| 2026-11-05 | T07 | ✅ merged as PR #7 | DeepSeek V4.1 Flash (DeepSeek Harness) | Today dashboard. Midnight test uses the real browser clock; gate and all 16 browser tests pass. |
| 2026-11-05 | T08 | ✅ merged as PR #8 | DeepSeek V4.1 Flash (DeepSeek Harness) | Full Add Turn form, plus the double-tap Save guard the manager added. Gate and all 23 browser tests pass. |
| 2026-11-05 | T09 | ✅ merged as PR #9 | DeepSeek V4.1 Flash (DeepSeek Harness) | Edit and delete a turn. Gate and all 28 browser tests pass. |
| 2026-11-05 | T10 | ✅ merged as PR #10 | DeepSeek V4.1 Flash (DeepSeek Harness) | History screen. Took a second builder round: closing a screen now returns to where it was opened, and fixing a bad date range no longer blanks the page. Gate and all 35 browser tests pass. |
| 2026-11-05 | T11 | ✅ merged as PR #11 | DeepSeek V4.1 Flash (DeepSeek Harness) | Service presets screen. Second builder round stopped a double tap on Save adding a service twice. Gate and all 40 browser tests pass. |
| 2026-11-05 | T12 | ✅ merged as PR #12 | DeepSeek V4.1 Flash (DeepSeek Harness) | Adjustments, with the double-tap Save guard the manager added. Gate and all 46 browser tests pass. |
| 2026-11-05 | T13 | ✅ merged as PR #13 | DeepSeek V4.1 Flash (DeepSeek Harness) | First builder stopped at the sandbox block; second finished. Gate and 51 browser tests pass; invalid custom range, cleared dates and 375px Vietnamese checked |
| 2026-11-05 | T14 | ✅ merged as PR #14 | DeepSeek V4.1 Flash (DeepSeek Harness) | Ready-made tests unchanged. Schedule start date added to the earliest-date rule, because the brief's own test needs it |
| 2026-11-05 | T15 | ✅ merged as PR #15 | DeepSeek V4.1 Flash (DeepSeek Harness) | Two rounds: payout tests now read the payout row itself, proved with a deliberately wrong payout. Save double tap guarded |
| 2026-11-05 | T16 | ✅ merged as PR #16 | DeepSeek V4.1 Flash (DeepSeek Harness) | Two rounds: cleared date and missing period are now refused. Save double tap guarded; 73 browser tests pass |
| 2026-11-05 | T17 | ✅ merged as PR #17 | DeepSeek V4.1 Flash (DeepSeek Harness) | Two rounds: a mistyped year froze Payday, so pay periods now reach back ten years at most. 84 browser tests pass |
| 2026-11-05 | T18 | ✅ merged as PR #18 | DeepSeek V4.1 Flash (DeepSeek Harness) | Passed review first time. 91 browser tests pass |
