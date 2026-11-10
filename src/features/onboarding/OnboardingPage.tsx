import { useState } from 'react'
import { useLocation } from 'wouter'
import { paths } from '../../app/navigation.ts'
import type { PayPeriodType, Settings } from '../../app/settings.ts'
import { getSettings, updateSettings, useSettings } from '../../app/settings.ts'
import { todayIso } from '../../domain/dates.ts'
import { parseRateBp, rateToInput } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { PercentField } from '../../ui/PercentField.tsx'
import { TileGroup } from '../../ui/TileGroup.tsx'
import { primaryButton } from '../../ui/styles.ts'
import { choosePaySchedule } from '../payday/paySchedule.ts'
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

  /** A custom commission that cannot be read stops here; every other answer is already saved. */
  function start() {
    if (payChoice === 'custom') {
      const bp = parseRateBp(customText)
      if (bp === null) {
        setCustomError(true)
        return
      }
      updateSettings({ defaultCommissionRateBp: bp })
    }
    finish()
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
    void choosePaySchedule(choice, todayIso())
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">{t(locale, 'onboardingTitle')}</h1>

      {/* Language names stay in their own language so anyone can find theirs. No flags. */}
      <TileGroup<Locale>
        compact
        legend={t(locale, 'language')}
        name="onboarding-language"
        value={locale}
        onChange={(value) => updateSettings({ locale: value })}
        options={[
          { value: 'vi', label: 'Tiếng Việt', lang: 'vi' },
          { value: 'en', label: 'English', lang: 'en' },
        ]}
      />

      <div className="flex flex-col gap-2">
        <TileGroup<PayChoice>
          compact
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
      </div>

      <div className="flex flex-col gap-2">
        <TileGroup<TipChoice>
          compact
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
        {tipChoice === 'custom' && (
          <p className="text-sm text-text-secondary">{t(locale, 'onboardingTipsCustomHint')}</p>
        )}
      </div>

      <TileGroup<PaydayChoice>
        compact
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={finish}
          className="min-h-14 flex-none rounded-button px-4 text-base font-semibold text-text-secondary focus-visible:outline-2 focus-visible:outline-brand-ink"
        >
          {t(locale, 'skip')}
        </button>
        <button type="button" onClick={start} className={`${primaryButton} flex-1`}>
          {t(locale, 'onboardingDone')}
        </button>
      </div>
    </div>
  )
}
