# Nail Tracker 2.0: builder's handbook

Read this file first, then `tasks/nail-tracker/README.md` (the version 1 handbook: its rules, code style, patterns and
traps all still apply), then your one brief in this folder (`V##-*.md`).

## What changed for version 2

- The product document is `docs/product-spec-v2.md`. Your brief names the sections you need.
- The picture to match is `docs/design/v2-mockup.html`. Open it with Playwright or read its CSS: colours, sizes and
  corner radii are written there in plain numbers. Section 4.1 of the spec lists the colours and interaction rules.
- You work in your own git worktree that starts from `main`. Create the branch your brief names, commit to it, do not
  push, do not run `gh`.
- `src/domain/` stays plain TypeScript with unit tests in `tests/unit/`. Every new money or date function gets tests.
- Every new word on screen goes in `src/lib/i18n.ts` in English and Vietnamese. Use the words in section 6 of the spec.
- Every browser test you add uses times with an explicit offset, like `2026-11-06T15:40:00-06:00`, because GitHub runs
  tests in UTC.

## Finishing

1. `pnpm gate` passes.
2. `pnpm exec playwright test --workers=2` passes (the whole suite, not only your file).
3. Commit. End with the final report shape from the version 1 handbook, using `Task: V##`.
