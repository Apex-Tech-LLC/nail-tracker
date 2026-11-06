import { useState } from 'react'
import { useLocation } from 'wouter'
import { paths } from '../../app/navigation.ts'
import type { PayPeriodType, Settings } from '../../app/settings.ts'
import { getSettings, updateSettings, useSettings } from '../../app/settings.ts'
import { todayIso, weekRange } from '../../domain/dates.ts'
import { parseRateBp, rateToInput } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { PercentField } from '../../ui/PercentField.tsx'
import { TileGroup } from '../../ui/TileGroup.tsx'
import { primaryButton, secondaryButton } from '../../ui/styles.ts'
import { TipHandlingFields } from '../settings/TipHandlingFields.tsx'
import type { TipChoice } from './onboardingChoices.ts'
import { tipSettings } from './onboardingChoices.ts'

type PayChoice = '6000' | '5000' | 'custom' | 'other'
type PaydayChoice = 'weekly' | 'biweekly' | 'custom' | 'none'

function initialPayChoice(rate: number): PayChoice {
  if (rate === 6000) return '6000'
  if (rate === 5000) return '5000'
  return 'custom'
}

function initialTipChoice({ cashTipHandling, cardTipHandling }: Settings): TipChoice {
  if (cardTipHandling === 'fromSalon') {
    return cashTipHandling === 'inHand' ? 'standard' : 'allPayday'
  }
  return 'custom'
}

function initialPaydayChoice(type: PayPeriodType): PaydayChoice {
  return type === 'weekly' || type === 'biweekly' || type === 'custom' ? type : 'none'
}

export function OnboardingPage() {
  const settings = useSettings()
  const { locale, defaultCommissionRateBp: rate } = settings
  const [, navigate] = useLocation()
  const [step, setStep] = useState(1)
  const [payChoice, setPayChoice] = useState<PayChoice>(() => initialPayChoice(rate))
  const [customText, setCustomText] = useState(() => rateToInput(rate))
  const [customError, setCustomError] = useState(false)
  const [tipChoice, setTipChoice] = useState<TipChoice>(() => initialTipChoice(settings))
  const [paydayChoice, setPaydayChoice] = useState<PaydayChoice>(() =>
    initialPaydayChoice(settings.payPeriodType),
  )

  function finish() {
    updateSettings({ onboardingDone: true })
    navigate(paths.today, { replace: true })
  }

  function next() {
    if (step === 4) {
      finish()
      return
    }
    if (step === 2 && payChoice === 'custom') {
      const bp = parseRateBp(customText)
      if (bp === null) {
        setCustomError(true)
        return
      }
      updateSettings({ defaultCommissionRateBp: bp })
    }
    setStep(step + 1)
  }

  function skip() {
    if (step === 4) {
      finish()
      return
    }
    setStep(step + 1)
  }

  function choosePay(choice: PayChoice) {
    setPayChoice(choice)
    setCustomError(false)
    if (choice === '6000') updateSettings({ defaultCommissionRateBp: 6000 })
    if (choice === '5000') updateSettings({ defaultCommissionRateBp: 5000 })
    if (choice === 'other') updateSettings({ defaultCommissionRateBp: 6000 })
  }

  function changeCustomRate(value: string) {
    setCustomText(value)
    if (customError && parseRateBp(value) !== null) setCustomError(false)
  }

  function chooseTips(choice: TipChoice) {
    setTipChoice(choice)
    updateSettings(tipSettings(choice, getSettings()))
  }

  function choosePayday(choice: PaydayChoice) {
    setPaydayChoice(choice)
    const current = getSettings()
    if ((choice === 'weekly' || choice === 'biweekly') && current.payPeriodAnchorDate === null) {
      updateSettings({
        payPeriodType: choice,
        payPeriodAnchorDate: weekRange(todayIso(), current.weekStartDay).start,
      })
      return
    }
    updateSettings({ payPeriodType: choice })
  }

  return (
    <>
      <p className="text-sm text-text-secondary">{tf(locale, 'onboardingStep', { n: step })}</p>

      {step === 1 && (
        <>
          <h1 className="text-lg font-medium">{t(locale, 'onboardingLanguage')}</h1>
          {/* Language names stay in their own language so anyone can find theirs. No flags. */}
          <TileGroup<Locale>
            stacked
            legend={t(locale, 'language')}
            name="onboarding-language"
            value={locale}
            onChange={(value) => updateSettings({ locale: value })}
            options={[
              { value: 'vi', glyph: 'Vi', label: 'Tiếng Việt', lang: 'vi' },
              { value: 'en', glyph: 'Aa', label: 'English', lang: 'en' },
            ]}
          />
          <p className="text-sm text-text-secondary">{t(locale, 'onboardingNoAccount')}</p>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-lg font-medium">{t(locale, 'onboardingPay')}</h1>
          <TileGroup<PayChoice>
            stacked
            legend={t(locale, 'defaultCommission')}
            name="onboarding-pay"
            value={payChoice}
            onChange={choosePay}
            options={[
              { value: '6000', label: t(locale, 'onboardingPay60') },
              { value: '5000', label: t(locale, 'onboardingPay50') },
              { value: 'custom', label: t(locale, 'onboardingPayCustom') },
              { value: 'other', label: t(locale, 'onboardingPayOther') },
            ]}
          />
          {payChoice === 'custom' && (
            <PercentField
              label={t(locale, 'customRateLabel')}
              value={customText}
              onChange={changeCustomRate}
              error={customError ? t(locale, 'errorRate') : undefined}
            />
          )}
          {payChoice === 'other' && (
            <p className="text-sm text-text-secondary">{t(locale, 'onboardingPayOtherHint')}</p>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="text-lg font-medium">{t(locale, 'onboardingTips')}</h1>
          <TileGroup<TipChoice>
            stacked
            legend={t(locale, 'totalTips')}
            name="onboarding-tips"
            value={tipChoice}
            onChange={chooseTips}
            options={[
              { value: 'standard', label: t(locale, 'onboardingTipsStandard') },
              { value: 'allPayday', label: t(locale, 'onboardingTipsAllPayday') },
              { value: 'custom', label: t(locale, 'onboardingTipsCustom') },
            ]}
          />
          {tipChoice === 'custom' && <TipHandlingFields />}
        </>
      )}

      {step === 4 && (
        <>
          <h1 className="text-lg font-medium">{t(locale, 'onboardingPayday')}</h1>
          <TileGroup<PaydayChoice>
            stacked
            legend={t(locale, 'paydaySchedule')}
            name="onboarding-payday"
            value={paydayChoice}
            onChange={choosePayday}
            options={[
              { value: 'weekly', label: t(locale, 'onboardingPaydayWeekly') },
              { value: 'biweekly', label: t(locale, 'onboardingPaydayBiweekly') },
              { value: 'custom', label: t(locale, 'onboardingPaydayCustom') },
              { value: 'none', label: t(locale, 'onboardingPaydaySkip') },
            ]}
          />
        </>
      )}

      <div className="flex flex-col gap-2">
        <button type="button" onClick={next} className={primaryButton}>
          {t(locale, step === 4 ? 'onboardingDone' : 'next')}
        </button>
        <button type="button" onClick={skip} className={secondaryButton}>
          {t(locale, 'skip')}
        </button>
      </div>
    </>
  )
}
