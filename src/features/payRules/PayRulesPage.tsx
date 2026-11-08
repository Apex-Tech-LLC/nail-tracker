import { IconPlus, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState, type FormEvent } from 'react'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db, type PayPeriod } from '../../db/schema.ts'
import {
  formatDayShort,
  isIsoDate,
  weekRange,
  type IsoDate,
} from '../../domain/dates.ts'
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
import { periodContaining, periodLengthDays, type PayPeriodType } from '../../domain/payPeriods.ts'
import {
  defaultPayRules,
  NO_RULES,
  ruleInForce,
  tierShare,
  type FeeWhen,
  type Guarantee,
  type PayRules,
  type SupplyFee,
  type Tiers,
  type TierLevel,
} from '../../domain/payRules.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { NumberPad } from '../../ui/NumberPad.tsx'
import { PercentField } from '../../ui/PercentField.tsx'
import { Row } from '../../ui/Row.tsx'
import { TileGroup } from '../../ui/TileGroup.tsx'
import {
  card,
  dangerButton,
  errorText,
  field,
  label,
  primaryButton,
  secondaryButton,
} from '../../ui/styles.ts'
import { useToast } from '../../ui/useToast.ts'
import { sampleStatement, specStatement, type RuleValues } from './examples.ts'
import { deletePayRules, loadPayRules, savePayRules } from './payRulesStore.ts'
import {
  cardTipFeeSummary,
  payRulesSummary,
  splitSummary,
  supplyFeeSummary,
} from './payRulesSummary.ts'

type SupplyKind = SupplyFee['kind']
type RateChoice = '6000' | '5000' | 'custom'
type SplitChoice = 'none' | 'half' | 'custom'
type StartChoice = 'today' | 'period' | 'other'

interface FormErrors {
  supply?: string
  cardFee?: string
  check?: string
  guarantee?: string
  minDays?: string
  tiers?: string
}

interface TierRow {
  from: string
  rate: string
}

function parseTierRows(rows: readonly TierRow[]): TierLevel[] | null {
  const levels: TierLevel[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const fromCents = index === 0 ? 0 : parseCents(rows[index].from)
    const rateBp = parseRateBp(rows[index].rate)
    if (fromCents === null || rateBp === null) return null
    levels.push({ fromCents, rateBp })
  }
  return levels
}

export function PayRulesPage({ onDone }: { onDone: () => void }) {
  const { locale, weekStartDay, payPeriodType, payPeriodAnchorDate } = useSettings()
  const today = useToday()
  const rules = useLiveQuery(() => loadPayRules(db))
  const periods = useLiveQuery(() => db.payPeriods.toArray())

  if (rules === undefined || periods === undefined) return null

  const sorted = [...rules].sort(
    (a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt - a.createdAt,
  )
  const current = sorted[0] ?? defaultPayRules(today)
  const periodStart = startOfPeriod(
    payPeriodType,
    payPeriodAnchorDate,
    periods,
    today,
    weekStartDay,
  )

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
        periodStart={periodStart}
      />

      <RulesList rules={sorted} today={today} />
    </>
  )
}

/** Start of the pay period that contains today, from the schedule the person set. */
function startOfPeriod(
  type: PayPeriodType,
  anchor: IsoDate | null,
  periods: readonly PayPeriod[],
  today: IsoDate,
  weekStartDay: 0 | 1,
): IsoDate {
  if ((type === 'weekly' || type === 'biweekly') && anchor !== null) {
    return periodContaining(today, anchor, periodLengthDays(type)).startDate
  }
  if (type === 'custom') {
    const period = periods.find((item) => item.startDate <= today && today <= item.endDate)
    return period?.startDate ?? today
  }
  return weekRange(today, weekStartDay).start
}

function ruleDate(iso: IsoDate, locale: Locale): string {
  return `${formatDayShort(iso, locale)}, ${iso.slice(0, 4)}`
}

/** The list's start line; the app's "from the beginning" marker is not a real date. */
function ruleStartText(iso: IsoDate, locale: Locale): string {
  if (iso === NO_RULES.startDate) return t(locale, 'fromTheStart')
  return tf(locale, 'ruleStarts', { date: ruleDate(iso, locale) })
}

interface FormProps {
  initial: PayRules
  today: IsoDate
  periodStart: IsoDate
}

function PayRulesForm({ initial, today, periodStart }: FormProps) {
  const {
    locale,
    defaultCommissionRateBp: rate,
    perServiceRates,
    numberPad,
  } = useSettings()
  const toast = useToast()
  const formRef = useRef<HTMLFormElement | null>(null)
  const perServiceHintId = useId()
  const startDateId = useId()
  const minDaysId = useId()

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

  const [guaranteeOn, setGuaranteeOn] = useState(initial.guarantee.kind !== 'none')
  const [guaranteeKind, setGuaranteeKind] = useState<'perDay' | 'perPeriod'>(
    initial.guarantee.kind === 'perPeriod' ? 'perPeriod' : 'perDay',
  )
  const [guaranteeAmount, setGuaranteeAmount] = useState(() =>
    initial.guarantee.kind === 'none' ? '' : centsToInput(initial.guarantee.cents),
  )
  const [minDays, setMinDays] = useState(() =>
    initial.guarantee.kind === 'none' || initial.guarantee.minDays === null
      ? ''
      : String(initial.guarantee.minDays),
  )

  const [tiersOn, setTiersOn] = useState(initial.tiers !== null)
  const [tierMode, setTierMode] = useState<Tiers['mode']>(initial.tiers?.mode ?? 'eachPart')
  const [tierRows, setTierRows] = useState<TierRow[]>(() =>
    initial.tiers === null
      ? [
          { from: centsToInput(0), rate: '' },
          { from: '', rate: '' },
        ]
      : initial.tiers.levels.map((level) => ({
          from: centsToInput(level.fromCents),
          rate: rateToInput(level.rateBp),
        })),
  )

  const [errors, setErrors] = useState<FormErrors>({})
  const [askingStart, setAskingStart] = useState(false)
  const [startChoice, setStartChoice] = useState<StartChoice>('today')
  const [otherDate, setOtherDate] = useState<IsoDate>(today)
  const [startError, setStartError] = useState(false)

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

  function updateTierRow(index: number, patch: Partial<TierRow>) {
    setTierRows((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
    setErrors((previous) => ({ ...previous, tiers: undefined }))
  }

  function addTierRow() {
    setTierRows((rows) => (rows.length >= 5 ? rows : [...rows, { from: '', rate: '' }]))
    setErrors((previous) => ({ ...previous, tiers: undefined }))
  }

  function removeTierRow(index: number) {
    setTierRows((rows) => (rows.length <= 2 ? rows : rows.filter((_, rowIndex) => rowIndex !== index)))
    setErrors((previous) => ({ ...previous, tiers: undefined }))
  }

  const parsedLevels = tiersOn ? parseTierRows(tierRows) : null
  const tiers: Tiers | null =
    parsedLevels === null ? null : { mode: tierMode, levels: parsedLevels }
  const guaranteeCents = parseCents(guaranteeAmount) ?? 0
  const guarantee: Guarantee = guaranteeOn
    ? {
        kind: guaranteeKind,
        cents: guaranteeCents,
        minDays: minDays.trim() === '' ? null : Number(minDays),
      }
    : { kind: 'none' }

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
  const draft: RuleValues = {
    supplyFee,
    cardTipFeeBp,
    checkBp,
    cardTipsPaidIn,
    guarantee,
    tiers,
  }

  const sample = sampleStatement(draft, rateBp, today)
  const rateOnly = sampleStatement({ ...draft, supplyFee: { kind: 'none' } }, rateBp, today)
  const spec = specStatement(draft, rateBp, today)

  const guaranteeExample = !guaranteeOn
    ? ''
    : guaranteeKind === 'perDay'
      ? tf(locale, 'guaranteeExamplePerDay', {
          amount: formatUsdShort(guaranteeCents),
          total: formatUsdShort(guaranteeCents * 6),
        })
      : tf(locale, 'guaranteeExamplePerPeriod', { amount: formatUsdShort(guaranteeCents) })
  const tiersExample =
    parsedLevels === null
      ? ''
      : tf(locale, 'tiersExample', {
          base: formatUsdShort(120_000),
          share: formatUsdShort(tierShare(120_000, { mode: tierMode, levels: parsedLevels })),
        })

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
    if (guaranteeOn && parseCents(guaranteeAmount) === null) {
      next.guarantee = t(locale, 'errorAmount')
    }
    if (guaranteeOn && minDays.trim() !== '' && !/^\d+$/.test(minDays.trim())) {
      next.minDays = t(locale, 'errorMinDays')
    }
    if (guaranteeOn && minDays.trim() !== '' && Number(minDays) < 1) {
      next.minDays = t(locale, 'errorMinDays')
    }
    if (tiersOn) {
      if (tierRows.length < 2 || tierRows.length > 5) {
        next.tiers = t(locale, 'errorTierCount')
      } else if (parsedLevels === null) {
        next.tiers = t(locale, 'errorRate')
      } else if (
        parsedLevels.some(
          (level, index) => index > 0 && level.fromCents <= parsedLevels[index - 1].fromCents,
        )
      ) {
        next.tiers = t(locale, 'errorTierOrder')
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0 && !customInvalid
  }

  function startSaving(event?: FormEvent) {
    event?.preventDefault()
    if (!validate()) return
    setStartChoice('today')
    setStartError(false)
    setAskingStart(true)
  }

  async function confirmSave() {
    const startDate =
      startChoice === 'today' ? today : startChoice === 'period' ? periodStart : otherDate
    if (!isIsoDate(startDate)) {
      setStartError(true)
      return
    }
    await savePayRules(db, draft, startDate)
    setAskingStart(false)
    setStartError(false)
    toast.show({ message: t(locale, 'rulesSaved') })
  }

  return (
    <form ref={formRef} noValidate onSubmit={startSaving} className="flex flex-col gap-4">
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
        {tiersOn && (
          <p className="text-sm text-text-secondary">{t(locale, 'tiersOnNote')}</p>
        )}
        <p className="text-sm text-text-secondary">
          {tf(locale, 'commissionExample', { amount: formatUsd(rateOnly.shareCents) })}
        </p>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-medium">{t(locale, 'tiersTitle')}</h2>
        <label className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            className="size-5"
            checked={tiersOn}
            onChange={(event) => {
              setTiersOn(event.target.checked)
              setErrors((previous) => ({ ...previous, tiers: undefined }))
            }}
          />
          <span>{t(locale, 'tiersOn')}</span>
        </label>
        {tiersOn && (
          <>
            <div className="flex flex-col gap-2">
              {tierRows.map((row, index) => (
                <TierRowFields
                  key={index}
                  index={index}
                  from={row.from}
                  rate={row.rate}
                  canRemove={tierRows.length > 2}
                  onChange={(patch) => updateTierRow(index, patch)}
                  onRemove={() => removeTierRow(index)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addTierRow}
              disabled={tierRows.length >= 5}
              className={`${secondaryButton} disabled:opacity-50`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <IconPlus size={18} aria-hidden="true" />
                {t(locale, 'tierAddLevel')}
              </span>
            </button>
            <TileGroup<'eachPart' | 'wholeAtTop'>
              legend={t(locale, 'tierMode')}
              name="tier-mode"
              value={tierMode}
              onChange={setTierMode}
              options={[
                { value: 'eachPart', label: t(locale, 'tierEachPart') },
                { value: 'wholeAtTop', label: t(locale, 'tierWholeAtTop') },
              ]}
            />
            {errors.tiers && <p className={errorText}>{errors.tiers}</p>}
            {tiersExample !== '' && (
              <p className="text-sm text-text-secondary">{tiersExample}</p>
            )}
          </>
        )}
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
        <h2 className="font-medium">{t(locale, 'guaranteeTitle')}</h2>
        <label className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            className="size-5"
            checked={guaranteeOn}
            onChange={(event) => {
              setGuaranteeOn(event.target.checked)
              setErrors((previous) => ({
                ...previous,
                guarantee: undefined,
                minDays: undefined,
              }))
            }}
          />
          <span>{t(locale, 'guaranteeOn')}</span>
        </label>
        {guaranteeOn && (
          <>
            <TileGroup<'perDay' | 'perPeriod'>
              legend={t(locale, 'guaranteeKind')}
              name="guarantee-kind"
              value={guaranteeKind}
              onChange={setGuaranteeKind}
              options={[
                { value: 'perDay', label: t(locale, 'guaranteePerDay') },
                { value: 'perPeriod', label: t(locale, 'guaranteePerPeriod') },
              ]}
            />
            <MoneyField
              label={t(locale, 'guaranteeAmountLabel')}
              value={guaranteeAmount}
              onChange={(value) => {
                setGuaranteeAmount(value)
                setErrors((previous) => ({ ...previous, guarantee: undefined }))
              }}
              error={errors.guarantee}
            />
            <div>
              <label htmlFor={minDaysId} className={label}>
                {t(locale, 'guaranteeMinDaysLabel')}
              </label>
              <input
                id={minDaysId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={minDays}
                onChange={(event) => {
                  setMinDays(event.target.value)
                  setErrors((previous) => ({ ...previous, minDays: undefined }))
                }}
                className={field}
              />
              {errors.minDays && <p className={errorText}>{errors.minDays}</p>}
            </div>
            {guaranteeExample !== '' && (
              <p className="text-sm text-text-secondary">{guaranteeExample}</p>
            )}
          </>
        )}
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
            ? t(locale, 'noSplitExample')
            : tf(locale, 'splitExample', {
                owed: formatUsdShort(spec.salonPaysCents),
                check: formatUsdShort(spec.checkCents ?? 0),
                cash: formatUsdShort(spec.cashCents ?? 0),
              })}
        </p>
      </section>

      {askingStart ? (
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="font-medium">{t(locale, 'whenDidThisStart')}</h2>
          <TileGroup<StartChoice>
            legend={t(locale, 'startDate')}
            name="start-choice"
            value={startChoice}
            onChange={(value) => {
              setStartChoice(value)
              setStartError(false)
            }}
            stacked
            options={[
              { value: 'today', label: t(locale, 'startToday') },
              { value: 'period', label: t(locale, 'startOfPayPeriod') },
              { value: 'other', label: t(locale, 'startOtherDay') },
            ]}
          />
          {startChoice === 'other' && (
            <div>
              <label htmlFor={startDateId} className={label}>
                {t(locale, 'startDate')}
              </label>
              <input
                id={startDateId}
                type="date"
                value={otherDate}
                onChange={(event) => {
                  if (isIsoDate(event.target.value)) {
                    setOtherDate(event.target.value)
                    setStartError(false)
                  }
                }}
                className="w-full rounded-control border-[1.5px] border-border-strong bg-surface px-3.5 py-3 text-base focus:border-brand-600 focus:outline-none"
              />
            </div>
          )}
          {startError && <p className={errorText}>{t(locale, 'errorStartDate')}</p>}
          <button type="button" onClick={() => void confirmSave()} className={primaryButton}>
            {t(locale, 'saveRules')}
          </button>
          <button type="button" onClick={() => setAskingStart(false)} className={secondaryButton}>
            {t(locale, 'cancel')}
          </button>
        </section>
      ) : (
        <button type="submit" className={primaryButton}>
          {t(locale, 'save')}
        </button>
      )}

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

function TierRowFields({
  index,
  from,
  rate,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number
  from: string
  rate: string
  canRemove: boolean
  onChange: (patch: Partial<TierRow>) => void
  onRemove: () => void
}) {
  const { locale } = useSettings()
  return (
    <div className="flex items-end gap-2">
      {index === 0 ? (
        <div className="flex-1">
          <span className={label}>{t(locale, 'tierFrom')}</span>
          <p className="rounded-control border border-border bg-surface-subtle px-3 py-3 text-base">
            $0.00
          </p>
        </div>
      ) : (
        <div className="flex-1">
          <MoneyField
            label={t(locale, 'tierFrom')}
            value={from}
            onChange={(value) => onChange({ from: value })}
          />
        </div>
      )}
      <div className="flex-1">
        <PercentField
          label={t(locale, 'tierRate')}
          value={rate}
          onChange={(value) => onChange({ rate: value })}
        />
      </div>
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={tf(locale, 'tierRemoveLevel', { n: index + 1 })}
          className="flex min-h-11 min-w-11 items-center justify-center"
        >
          <IconX size={18} aria-hidden="true" />
        </button>
      ) : (
        <span className="w-11" aria-hidden="true" />
      )}
    </div>
  )
}

function RulesList({ rules, today }: { rules: PayRules[]; today: IsoDate }) {
  const { locale, defaultCommissionRateBp: rate } = useSettings()
  const toast = useToast()
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const currentId = ruleInForce(rules, today)?.id ?? null

  if (rules.length === 0) return null

  async function remove(id: string) {
    const deleted = await deletePayRules(db, id)
    setConfirmingId(null)
    if (!deleted) return
    setViewingId(null)
    toast.show({ message: t(locale, 'ruleDeleted') })
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">{t(locale, 'earlierPayRules')}</h2>
      {rules.map((rule) => {
        const open = viewingId === rule.id
        return (
          <div key={rule.id} className={`${card} flex flex-col gap-2`}>
            <button
              type="button"
              onClick={() => setViewingId(open ? null : rule.id)}
              className="flex flex-col items-start gap-1 text-left"
            >
              <span className="flex items-center gap-2">
                <span>{ruleStartText(rule.startDate, locale)}</span>
                {rule.id === currentId && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-900">
                    {t(locale, 'ruleNow')}
                  </span>
                )}
              </span>
              <span className="text-sm text-text-secondary">
                {payRulesSummary(locale, rate, rule)}
              </span>
            </button>
            {open && (
              <div className="flex flex-col gap-2 border-t border-border pt-2">
                <Row
                  label={t(locale, 'supplyFeeTitle')}
                  value={supplyFeeSummary(locale, rule.supplyFee)}
                />
                <Row
                  label={t(locale, 'cardTipFeeTitle')}
                  value={cardTipFeeSummary(locale, rule.cardTipFeeBp)}
                />
                <Row
                  label={t(locale, 'checkCashTitle')}
                  value={splitSummary(locale, rule.checkBp)}
                />
                {rules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(rule.id)}
                    className={dangerButton}
                  >
                    {t(locale, 'delete')}
                  </button>
                )}
              </div>
            )}
            <ConfirmDialog
              open={confirmingId === rule.id}
              title={t(locale, 'deleteRuleTitle')}
              body={t(locale, 'deleteRuleBody')}
              confirmLabel={t(locale, 'delete')}
              cancelLabel={t(locale, 'cancel')}
              danger
              onConfirm={() => void remove(rule.id)}
              onCancel={() => setConfirmingId(null)}
            />
          </div>
        )
      })}
    </section>
  )
}
