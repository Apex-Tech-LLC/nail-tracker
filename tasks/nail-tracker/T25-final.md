# T25: Final sweep and turn deployment back on

- **Branch:** `task/T25-final`
- **Milestone:** M5 Testing and polish
- **Depends on:** T24
- **Size:** about 30 minutes

## Goal

No Daftar leftovers remain, and the deploy workflow runs on every push to main again.

## Steps

### 1. Leftover search

Run each of these. Fix every hit in app code. Hits inside `tasks/`, `LICENSE`, and the Credit section of `README.md` are fine.

```
git grep -il "daftar" -- . ":(exclude)tasks" ":(exclude)LICENSE" ":(exclude)README.md"
git grep -il "toman\|jalali\|vazirmatn\|persian" -- . ":(exclude)tasks" ":(exclude)docs"
git grep -n "console\.log" -- src
git grep -n "TODO\|FIXME" -- src tests
git grep -n ": any\|as any\|@ts-ignore\|@ts-expect-error" -- src tests
git grep -n "parseFloat\|toFixed" -- src
```

The `parseFloat` and `toFixed` search must print nothing. If it finds one on a money value, replace it with the helpers in `src/domain/money.ts`.

### 2. Every word comes from the dictionary

Search for words on screen that skip `t()`:
```
git grep -nE ">[A-Z][a-z]+( [a-z]+)*<" -- "src/**/*.tsx"
```
Allowed hits: the language names `Tiếng Việt` and `English`. Fix the others.

### 3. Unused strings

Create a throwaway script (do not commit it) that lists each key in `src/lib/i18n.ts` and checks that it appears in `src/`. Report unused keys in your final report, and remove them from **both** languages, then re-run the gate.

Keys used through a map (`ADJUSTMENT_LABEL`, `PAY_STATE_LABEL`, `PAYMENT_METHOD_LABEL`, `ERROR_TEXT`) count as used.

### 4. Turn deployment back on

In `.github/workflows/deploy.yml`, restore the push trigger:
```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

Do not change anything else in that file. The manager turns on GitHub Pages for the repository after merging.

### 5. Update README

In `README.md`, add under the first paragraph:
```markdown
**Try it:** https://unity7.github.io/nail-tracker/. Open it in Safari on an iPhone, tap Share, then Add to Home Screen.
```

### 6. Full run

```
pnpm gate
pnpm exec playwright test --workers=2
```

## Files

`.github/workflows/deploy.yml`, `README.md`, `src/lib/i18n.ts`, and any file the searches name.

## Done when

- All searches in step 1 print nothing outside the allowed hits.
- `pnpm gate` passes.
- `pnpm exec playwright test --workers=2` passes in full.

## After this task (manager only)

1. Merge.
2. Turn on GitHub Pages for `Unity7/nail-tracker`, source GitHub Actions.
3. Confirm the deploy workflow finished on GitHub.
4. Open https://unity7.github.io/nail-tracker/ and confirm it loads.
5. Tell Bay the site is live, and that a Vietnamese speaker should read the wording, because the translations have not been checked by one.
