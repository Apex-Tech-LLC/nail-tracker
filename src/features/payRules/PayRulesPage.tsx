import { IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState, type FormEvent } from 'react'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db } from '../../db/schema.ts'
import type { IsoDate } from '../../domain/dates.ts'
import {
  centsToInput,
  formatRate,
  formatUsd,
  formatUsdShort,
  padAmount,
  parseCents,
  parseRateBp,
  rateToInput,
} from '../../domain/money.ts'
import {
  defaultPayRules,
  type FeeWhen,
  type PayRules,
  type SupplyFee,
} from '../../domain/payRules.ts'
import { t, tf } from '../../lib/i18n.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { NumberPad } from '../../ui/NumberPad.tsx'
import { PercentField } from '../../ui/PercentField.tsx'
import { TileGroup } from '../../ui/TileGroup.tsx'
import { card, primaryButton } from '../../ui/styles.ts'
import { useToast } from '../../ui/useToast.ts'
import { sampleStatement, specStatement, type RuleValues } from './examples.ts'
import { loadPayRules, savePayRules } from './payRulesStore.ts'

type SupplyKind = SupplyFee['kind']
type RateChoice = '6000' | '5000' | 'custom'
type SplitChoice = 'none' | 'half' | 'custom'

interface FormErrors {
  supply?: string
  cardFee?: string
  check?: string
}

export function PayRulesPage({ onDone }: { onDone: () => void }) {
  const { locale } = useSettings()
  const today = useToday()
  const rules = useLiveQuery(() => loadPayRules(db))

  if (rules === undefined) return null

  const sorted = [...rules].sort(
    (a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt - a.createdAt,
  )
  const current = sorted[0] ?? defaultPayRules(today)

  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDone}
          aria-label={t(locale, 'close')}
          className="flex min-h-11 min-w-11 items-center justify-center"
        >
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-lg font-semibold">
          {t(locale, 'howImPaid')}
        </h1>
        <span className="w-11" />
      </header>

      <PayRulesForm
        key={`${current.id}:${current.updatedAt}`}
        initial={current}
        today={today}
      />
    </>
  )
}

interface FormProps {
  initial: PayRules
  today: IsoDate
}

function PayRulesForm({ initial, today }: FormProps) {
  const {
    locale,
    defaultCommissionRateBp: rate,
    perServiceRates,
    numberPad,
  } = useSettings()
  const toast = useToast()
  const formRef = useRef<HTMLFormElement | null>(null)
  const perServiceHintId = useId()

  const [customOpen, setCustomOpen] = useState(rate !== 6000 && rate !== 5000)
  const [customText, setCustomText] = useState(() => rateToInput(rate))
  const [customInvalid, setCustomInvalid] = useState(false)

  const [supplyKind, setSupplyKind] = useState<SupplyKind>(initial.supplyFee.kind)
  const [supplyAmount, setSupplyAmount] = useState(() =>
    initial.supplyFee.kind === 'perService' ? centsToInput(initial.supplyFee.cents) : '',
  )
  const [supplyPercent, setSupplyPercent] = useState(() =>
    initial.supplyFee.kind === 'percent' ? rateToInput(initial.supplyFee.bp) : '',
  )
  const [supplyWhen, setSupplyWhen] = useState<FeeWhen>(
    initial.supplyFee.kind === 'none' ? 'beforeSplit' : initial.supplyFee.when,
  )
  const [cardFee, setCardFee] = useState(() =>
    initial.cardTipFeeBp === 0 ? '' : rateToInput(initial.cardTipFeeBp),
  )
  const [checkChoice, setCheckChoice] = useState<SplitChoice>(() =>
    initial.checkBp === null ? 'none' : initial.checkBp === 5000 ? 'half' : 'custom',
  )
  const [checkPercent, setCheckPercent] = useState(() =>
    initial.checkBp !== null && initial.checkBp !== 5000 ? rateToInput(initial.checkBp) : '',
  )
  const [cardTipsPaidIn, setCardTipsPaidIn] = useState(initial.cardTipsPaidIn)

  const [errors, setErrors] = useState<FormErrors>({})

  const [padOpen, setPadOpen] = useState(false)
  const [padReplace, setPadReplace] = useState(false)

  function chooseRate(choice: RateChoice) {
    setCustomInvalid(false)
    if (choice === 'custom') {
      setCustomText(rateToInput(rate))
      setCustomOpen(true)
      return
    }
    setCustomOpen(false)
    updateSettings({ defaultCommissionRateBp: Number(choice) })
  }

  function changeCustomRate(value: string) {
    setCustomText(value)
    const bp = parseRateBp(value)
    if (bp === null) {
      setCustomInvalid(true)
      return
    }
    setCustomInvalid(false)
    updateSettings({ defaultCommissionRateBp: bp })
  }

  function chooseSupplyKind(kind: SupplyKind) {
    setSupplyKind(kind)
    setErrors((previous) => ({ ...previous, supply: undefined }))
  }

  function typeOnPad(key: string) {
    const next =
      key === 'back'
        ? supplyAmount.slice(0, -1)
        : padReplace
          ? padAmount('', key)
          : padAmount(supplyAmount, key)
    setPadReplace(false)
    if (next === supplyAmount) return
    setSupplyAmount(next)
    setErrors((previous) => ({ ...previous, supply: undefined }))
  }

  const rateBp = customOpen ? (parseRateBp(customText) ?? rate) : rate
  const supplyFee: SupplyFee =
    supplyKind === 'none'
      ? { kind: 'none' }
      : supplyKind === 'perService'
        ? { kind: 'perService', cents: parseCents(supplyAmount) ?? 0, when: supplyWhen }
        : { kind: 'percent', bp: parseRateBp(supplyPercent) ?? 0, when: supplyWhen }
  const cardTipFeeBp = cardFee.trim() === '' ? 0 : (parseRateBp(cardFee) ?? 0)
  const checkBp =
    checkChoice === 'none'
      ? null
      : checkChoice === 'half'
        ? 5000
        : (parseRateBp(checkPercent) ?? 0)
  const draft: RuleValues = { supplyFee, cardTipFeeBp, checkBp, cardTipsPaidIn }

  const sample = sampleStatement(draft, rateBp, today)
  const rateOnly = sampleStatement({ ...draft, supplyFee: { kind: 'none' } }, rateBp, today)
  const spec = specStatement(draft, rateBp, today)

  function validate(): boolean {
    const next: FormErrors = {}
    if (supplyKind === 'perService' && parseCents(supplyAmount) === null) {
      next.supply = t(locale, 'errorAmount')
    }
    if (supplyKind === 'percent' && parseRateBp(supplyPercent) === null) {
      next.supply = t(locale, 'errorRate')
    }
    if (cardFee.trim() !== '' && parseRateBp(cardFee) === null) {
      next.cardFee = t(locale, 'errorRate')
    }
    if (checkChoice === 'custom' && parseRateBp(checkPercent) === null) {
      next.check = t(locale, 'errorRate')
    }
    setErrors(next)
    return Object.keys(next).length === 0 && !customInvalid
  }

  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!validate()) return
    void savePayRules(db, draft, today).then(() => {
      toast.show({ message: t(locale, 'rulesSaved') })
    })
  }

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-medium">{t(locale, 'yourCommission')}</h2>
        <TileGroup<RateChoice>
          legend={t(locale, 'defaultCommission')}
          name="commission"
          value={customOpen ? 'custom' : rate === 5000 ? '5000' : '6000'}
          onChange={chooseRate}
          options={[
            { value: '6000', label: '60%' },
            { value: '5000', label: '50%' },
            { value: 'custom', label: t(locale, 'customRate') },
          ]}
        />
        {customOpen && (
          <PercentField
            label={t(locale, 'customRateLabel')}
            value={customText}
            onChange={changeCustomRate}
            error={customInvalid ? t(locale, 'errorRate') : undefined}
          />
        )}
        <div>
          <label className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              className="size-5"
              checked={perServiceRates}
              onChange={(event) => updateSettings({ perServiceRates: event.target.checked })}
              aria-describedby={perServiceHintId}
            />
            <span>{t(locale, 'perServiceRates')}</span>
          </label>
          <p id={perServiceHintId} className="text-sm text-text-secondary">
            {t(locale, 'perServiceRatesHint')}
          </p>
        </div>
        <p className="text-sm text-text-secondary">
          {tf(locale, 'commissionExample', { amount: formatUsd(rateOnly.shareCents) })}
        </p>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-medium">{t(locale, 'supplyFeeTitle')}</h2>
        <TileGroup<SupplyKind>
          legend={t(locale, 'supplyFeeKind')}
          name="supply-kind"
          value={supplyKind}
          onChange={chooseSupplyKind}
          options={[
            { value: 'none', label: t(locale, 'supplyFeeNone') },
            { value: 'perService', label: t(locale, 'supplyFeePerService') },
            { value: 'percent', label: t(locale, 'supplyFeePercentOption') },
          ]}
        />
        {supplyKind === 'perService' && (
          <MoneyField
            label={t(locale, 'supplyFeeAmountLabel')}
            value={supplyAmount}
            onChange={(value) => {
              setSupplyAmount(value)
              setErrors((previous) => ({ ...previous, supply: undefined }))
            }}
            error={errors.supply}
            usePad={numberPad}
            active={padOpen}
            padTarget="supply"
            onFieldFocus={(element) => {
              if (!numberPad) return
              setPadOpen(true)
              setPadReplace(true)
              requestAnimationFrame(() => element.scrollIntoView({ block: 'nearest' }))
            }}
            onFieldBlur={(event) => {
              const next = event.relatedTarget
              if (
                next instanceof Element &&
                (next.closest('[data-number-pad]') || next.matches('[data-pad-target]'))
              ) {
                return
              }
              setPadOpen(false)
              setPadReplace(false)
            }}
          />
        )}
        {supplyKind === 'percent' && (
          <PercentField
            label={t(locale, 'supplyFeePercentLabel')}
            value={supplyPercent}
            onChange={(value) => {
              setSupplyPercent(value)
              setErrors((previous) => ({ ...previous, supply: undefined }))
            }}
            error={errors.supply}
          />
        )}
        {supplyKind !== 'none' && (
          <TileGroup<FeeWhen>
            legend={t(locale, 'supplyFeeWhen')}
            name="supply-when"
            value={supplyWhen}
            onChange={setSupplyWhen}
            options={[
              { value: 'beforeSplit', label: t(locale, 'feeBeforeSplit') },
              { value: 'afterSplit', label: t(locale, 'feeAfterSplit') },
            ]}
          />
        )}
        <p className="text-sm text-text-secondary">
          {supplyKind === 'none'
            ? tf(locale, 'supplyExampleNone', {
                rate: formatRate(rateBp),
                share: formatUsd(rateOnly.shareCents),
              })
            : supplyWhen === 'beforeSplit'
              ? tf(locale, 'supplyExampleBefore', {
                  fee: formatUsdShort(sample.supplyFeeCents),
                  rate: formatRate(rateBp),
                  base: formatUsdShort(sample.shareBaseCents),
                  share: formatUsd(sample.shareCents),
                })
              : tf(locale, 'supplyExampleAfter', {
                  rate: formatRate(rateBp),
                  gross: formatUsd(rateOnly.shareCents),
                  fee: formatUsdShort(sample.supplyFeeCents),
                  share: formatUsd(sample.shareCents),
                })}
        </p>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-medium">{t(locale, 'cardTipFeeTitle')}</h2>
        <PercentField
          label={t(locale, 'cardTipFeeLabel')}
          value={cardFee}
          onChange={(value) => {
            setCardFee(value)
            setErrors((previous) => ({ ...previous, cardFee: undefined }))
          }}
          error={errors.cardFee}
        />
        <p className="text-sm text-text-secondary">{t(locale, 'cardTipFeeNote')}</p>
        <p className="text-sm text-text-secondary">
          {cardTipFeeBp === 0
            ? tf(locale, 'cardTipFeeExampleNone', { net: formatUsd(1000) })
            : tf(locale, 'cardTipFeeExample', {
                fee: formatUsd(sample.cardTipFeeCents),
                net: formatUsd(1000 - sample.cardTipFeeCents),
              })}
        </p>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-medium">{t(locale, 'checkCashTitle')}</h2>
        <TileGroup<SplitChoice>
          legend={t(locale, 'splitKind')}
          name="check-split"
          value={checkChoice}
          onChange={(value) => {
            setCheckChoice(value)
            setErrors((previous) => ({ ...previous, check: undefined }))
          }}
          options={[
            { value: 'none', label: t(locale, 'splitNone') },
            { value: 'half', label: t(locale, 'splitHalf') },
            { value: 'custom', label: t(locale, 'splitCustom') },
          ]}
        />
        {checkChoice === 'custom' && (
          <PercentField
            label={t(locale, 'checkPercentLabel')}
            value={checkPercent}
            onChange={(value) => {
              setCheckPercent(value)
              setErrors((previous) => ({ ...previous, check: undefined }))
            }}
            error={errors.check}
          />
        )}
        <TileGroup<'check' | 'cash' | 'split'>
          legend={t(locale, 'cardTipsPaidIn')}
          name="card-tips-paid-in"
          value={cardTipsPaidIn}
          onChange={setCardTipsPaidIn}
          options={[
            { value: 'check', label: t(locale, 'paidInCheck') },
            { value: 'cash', label: t(locale, 'paidInCash') },
            { value: 'split', label: t(locale, 'paidInSplit') },
          ]}
        />
        <p className="text-sm text-text-secondary">
          {checkBp === null
            ? tf(locale, 'noSplitExample', { owed: formatUsdShort(spec.salonPaysCents) })
            : tf(locale, 'splitExample', {
                owed: formatUsdShort(spec.salonPaysCents),
                check: formatUsdShort(spec.checkCents ?? 0),
                cash: formatUsdShort(spec.cashCents ?? 0),
              })}
        </p>
      </section>

      <button type="submit" className={primaryButton}>
        {t(locale, 'save')}
      </button>

      {numberPad && padOpen && (
        <NumberPad
          locale={locale}
          onDigit={typeOnPad}
          onBackspace={() => typeOnPad('back')}
          onNext={() => {
            setPadOpen(false)
            setPadReplace(false)
          }}
          onSave={() => {
            setPadOpen(false)
            setPadReplace(false)
            formRef.current?.requestSubmit()
          }}
        />
      )}
      {padOpen && <div className="h-[280px]" aria-hidden="true" />}
    </form>
  )
}

