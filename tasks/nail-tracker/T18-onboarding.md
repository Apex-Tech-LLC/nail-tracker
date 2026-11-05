# T18: First-launch onboarding

- **Branch:** `task/T18-onboarding`
- **Milestone:** M3 Earnings and payday
- **Depends on:** T17
- **Size:** about 40 minutes

## Goal

On first launch, four short steps set language, pay, tips and payday, then the person lands on Today. Every step can be skipped. It never shows again.

## Steps

### 1. Pure helpers: `src/features/onboarding/onboardingChoices.ts`

```ts
import type { Settings } from '../../app/settings.ts'

export type TipChoice = 'standard' | 'allPayday' | 'custom'

/** What each tip answer means for the two tip settings. Custom keeps what is there, and the person picks in Settings. */
export function tipSettings(choice: TipChoice, current: Settings): Pick<Settings, 'cashTipHandling' | 'cardTipHandling'> {
```
| Choice | Cash | Card |
|---|---|---|
| `standard` | `inHand` | `fromSalon` |
| `allPayday` | `fromSalon` | `fromSalon` |
| `custom` | current value | current value |

Add test file `tests/unit/onboardingChoices.test.ts` covering all three rows. Build the `current` argument with `resolveSettings(null, ['en-US'])` and set one field to a changed value for the `custom` row.

### 2. `src/features/onboarding/OnboardingPage.tsx`

State: `step` (1 to 4).

Every step shows:
- `tf(locale,'onboardingStep',{ n: step })` in `text-sm text-text-secondary`.
- An `<h1>` for the step's question.
- The choices, using `TileGroup`. Tiles should stack on a phone: add a prop `stacked?: boolean` to `TileGroup` that changes the wrapper to `flex flex-col gap-2`.
- `next` (`primaryButton`) and `skip` (`secondaryButton`). On step 4 the primary button says `onboardingDone`.

| Step | Heading | Choices | On change |
|---|---|---|---|
| 1 | `onboardingLanguage` | `Tiếng Việt`, `English`, as in Settings. Also show `onboardingNoAccount` below | `updateSettings({ locale })` right away, so the rest appears in that language |
| 2 | `onboardingPay` | `onboardingPay60`, `onboardingPay50`, `onboardingPayCustom`, `onboardingPayOther` | 60: rate `6000`. 50: rate `5000`. Custom: shows a `PercentField` labelled `customRateLabel`. Other: shows `onboardingPayOtherHint` and sets `6000` |
| 3 | `onboardingTips` | `onboardingTipsStandard`, `onboardingTipsAllPayday`, `onboardingTipsCustom` | `updateSettings(tipSettings(choice, getSettings()))`. Custom: also shows the same two groups as in Settings (cash, card) |
| 4 | `onboardingPayday` | `onboardingPaydayWeekly`, `onboardingPaydayBiweekly`, `onboardingPaydayCustom`, `onboardingPaydaySkip` | Weekly and biweekly: set `payPeriodType` and, if the anchor is null, `weekRange(todayIso(), weekStartDay).start`. Custom: `payPeriodType: 'custom'`. Skip: `'none'` |

Step 2 custom: **Next** does nothing and shows `errorRate` if `parseRateBp` returns null. **Skip** ignores the box and moves on.

**Skip** on any step moves to the next step. On step 4, it finishes. There is no separate "skip everything" button.

Finishing: `updateSettings({ onboardingDone: true })` then `navigate(paths.today, { replace: true })`.

To share the cash and card groups, move them from `SettingsPage.tsx` into `src/features/settings/TipHandlingFields.tsx` and use the same component in both places.

### 3. The gate

In `src/app/App.tsx`, inside `Shell`:
```ts
const { onboardingDone } = useSettings()
const onOnboarding = location === paths.onboarding

useEffect(() => {
  if (!onboardingDone && !onOnboarding) navigate(paths.onboarding, { replace: true })
}, [onboardingDone, onOnboarding, navigate])
```
Use `const [location, navigate] = useLocation()`. `TAB_PATHS` does not include the onboarding path, so the tabs hide by themselves.

Someone who restores a backup or already has data should not be stuck: T20 sets `onboardingDone` to true after a restore.

### 4. Route

`<Route path={paths.onboarding} component={OnboardingPage} />` in `src/app/routes.tsx`.

### 5. Today's first-turn button

After onboarding, Today already shows `addFirstTurn` from T07. No change.

### 6. Tests

All other e2e tests already pass `onboardingDone: true` through `seedSettings`. Any test that calls `page.goto` without `seedSettings` now lands on onboarding. `tests/e2e/manifest.spec.ts` has two such tests: they only check the manifest and installability, and still pass. Run it to confirm.

Create `tests/e2e/onboarding.spec.ts`. Do **not** use `seedSettings` here. Instead:
```ts
test.use({ locale: 'en-US' })
```

| Test | Steps | Expected |
|---|---|---|
| First launch | Open `./` | URL ends in `#/onboarding`. Shows `Choose your language` and `Step 1 of 4`. No `navigation` role on the page |
| Whole flow | Choose English, Next. Choose `50% commission`, Next. Choose first tip option, Next. Choose `Weekly`, press `Start tracking` | On Today, `Add your first turn` shows. Open `./#/add`: box holds `50`. Open `./#/payday`: no `Set your payday schedule` text |
| Vietnamese | Choose Tiếng Việt | Heading changes to `Chọn ngôn ngữ` |
| Skip all | Press Skip four times | On Today. Open `./#/add`: box holds `60` |
| Shown once | Finish the flow, then `page.reload()` | Stays on Today |
| Custom rate | Step 2, choose Custom, fill `abc`, Next | `Enter a percent from 0 to 100, like 60 or 62.5.` shows |
| All tips on payday | Step 3 choose `All tips on payday`, then finish. Open `./#/add`, open More options | `Cash tip already in my hand` is not checked |

## Files

Create `src/features/onboarding/onboardingChoices.ts`, `src/features/onboarding/OnboardingPage.tsx`, `src/features/settings/TipHandlingFields.tsx`, `tests/unit/onboardingChoices.test.ts`, `tests/e2e/onboarding.spec.ts`. Edit `src/app/App.tsx`, `src/app/routes.tsx`, `src/ui/TileGroup.tsx`, `src/features/settings/SettingsPage.tsx`.

## Done when

- `pnpm gate` passes.
- `pnpm exec playwright test --workers=2` passes in full, because the gate affects every screen.

## Not in this task

Backup (T19, T20).
