import { IconChevronDown, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState, type FocusEvent, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { db, type PaycheckRecord, type PaymentMethod } from '../../db/schema.ts'
import { isIsoDate, todayIso, type IsoDate } from '../../domain/dates.ts'
import { centsToInput, padAmount, parseCents } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { NumberPad } from '../../ui/NumberPad.tsx'
import {
  chip,
  chipOff,
  chipOn,
  errorText,
  field,
  label,
  primaryButton,
  secondaryButton,
} from '../../ui/styles.ts'
import { addPayment } from '../payday/paymentStore.ts'
import { loadPeriodSummaries, type PeriodSummary } from '../payday/periodStore.ts'
import { loadPaycheckRecord, saveStub } from './paycheckStore.ts'

const OTHER_METHODS: PaymentMethod[] = ['zelle', 'directDeposit', 'other']

const PAD_TARGETS = ['check', 'cash', 'other', 'stubServices', 'stubTips', 'stubDeductions']

interface AmountRead {
  ok: boolean
  cents: number | null
}

function readAmount(value: string): AmountRead {
  if (value.trim() === '') return { ok: true, cents: null }
  const cents = parseCents(value)
  return cents === null ? { ok: false, cents: null } : { ok: true, cents }
}

interface Errors {
  date?: string
  check?: string
  cash?: string
  other?: string
  nothing?: string
  stubServices?: string
  stubTips?: string
  stubDeductions?: string
}

interface Props {
  periodId: string
  onDone: () => void
}

interface Loaded {
  summary: PeriodSummary | null
  record: PaycheckRecord | null
}

export function RecordWhatYouGotForm({ periodId, onDone }: Props) {
  const { locale } = useSettings()

  const loaded = useLiveQuery(async (): Promise<Loaded> => {
    const summaries = await loadPeriodSummaries(db)
    const summary = summaries.find((item) => item.period.id === periodId) ?? null
    const record = await loadPaycheckRecord(db, periodId)
    return { summary, record: record ?? null }
  }, [periodId])

  if (loaded === undefined) return null

  if (loaded.summary === null) {
    return (
      <>
        <p>{t(locale, 'entryNotFound')}</p>
        <Link href={paths.payday} replace className="text-brand-600 underline">
          {t(locale, 'paydayTitle')}
        </Link>
      </>
    )
  }

  return (
    <RecordFields
      periodId={periodId}
      record={loaded.record}
      onDone={onDone}
    />
  )
}

interface FieldsProps {
  periodId: string
  record: PaycheckRecord | null
  onDone: () => void
}

function RecordFields({ periodId, record, onDone }: FieldsProps) {
  const { locale, numberPad } = useSettings()
  const id = useId()
  const [date, setDate] = useState<IsoDate>(todayIso())
  const [checkText, setCheckText] = useState('')
  const [cashText, setCashText] = useState('')
  const [otherText, setOtherText] = useState('')
  const [otherMethod, setOtherMethod] = useState<PaymentMethod>('zelle')
  const [stubOpen, setStubOpen] = useState(false)
  const [stubServicesText, setStubServicesText] = useState(
    record?.stubServicesCents != null ? centsToInput(record.stubServicesCents) : '',
  )
  const [stubTipsText, setStubTipsText] = useState(
    record?.stubTipsCents != null ? centsToInput(record.stubTipsCents) : '',
  )
  const [stubDeductionsText, setStubDeductionsText] = useState(
    record?.stubDeductionsCents != null ? centsToInput(record.stubDeductionsCents) : '',
  )
  const [errors, setErrors] = useState<Errors>({})
  const [padTarget, setPadTarget] = useState<string | null>(null)
  const [padReplace, setPadReplace] = useState(false)
  const saveInFlight = useRef(false)

  const padShown = numberPad && padTarget !== null && PAD_TARGETS.includes(padTarget)

  function padTextFor(target: string): string {
    if (target === 'check') return checkText
    if (target === 'cash') return cashText
    if (target === 'other') return otherText
    if (target === 'stubServices') return stubServicesText
    if (target === 'stubTips') return stubTipsText
    return stubDeductionsText
  }

  function setPadText(target: string, value: string): void {
    if (target === 'check') setCheckText(value)
    else if (target === 'cash') setCashText(value)
    else if (target === 'other') setOtherText(value)
    else if (target === 'stubServices') setStubServicesText(value)
    else if (target === 'stubTips') setStubTipsText(value)
    else setStubDeductionsText(value)
  }

  function clearError(fieldName: keyof Errors): void {
    setErrors((previous) =>
      previous[fieldName] === undefined ? previous : { ...previous, [fieldName]: undefined },
    )
  }

  function change(target: string, value: string): void {
    setPadText(target, value)
    clearError(target as keyof Errors)
    clearError('nothing')
  }

  /** One key from the app's pad: a digit or dot appends, `back` removes the last character. */
  function typeOnPad(key: string): void {
    if (!padTarget) return
    const current = padTextFor(padTarget)
    const next =
      key === 'back'
        ? current.slice(0, -1)
        : padReplace
          ? padAmount('', key)
          : padAmount(current, key)
    setPadReplace(false)
    if (next !== current) change(padTarget, next)
  }

  function focusPad(target: string, element: HTMLInputElement): void {
    if (!numberPad) return
    setPadTarget(target)
    setPadReplace(true)
    requestAnimationFrame(() => element.scrollIntoView({ block: 'nearest' }))
  }

  function blurPad(event: FocusEvent<HTMLInputElement>): void {
    const next = event.relatedTarget
    if (next instanceof Element) {
      if (next.closest('[data-number-pad]')) return
      if (next.matches('[data-pad-target]')) return
    }
    setPadTarget(null)
    setPadReplace(false)
  }

  function focusNextPadTarget(): void {
    if (!padTarget) return
    const index = PAD_TARGETS.indexOf(padTarget)
    const next = index === -1 ? undefined : PAD_TARGETS[index + 1]
    if (!next) {
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
      setPadTarget(null)
      setPadReplace(false)
      return
    }
    setPadTarget(next)
    setPadReplace(true)
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLInputElement>(`[data-pad-target="${next}"]`)
      element?.focus()
      element?.scrollIntoView({ block: 'nearest' })
    })
  }

  const check = readAmount(checkText)
  const cash = readAmount(cashText)
  const other = readAmount(otherText)
  const stubServices = readAmount(stubServicesText)
  const stubTips = readAmount(stubTipsText)
  const stubDeductions = readAmount(stubDeductionsText)

  const gotSomething = [check, cash, other].some(
    (amount) => amount.ok && amount.cents !== null && amount.cents > 0,
  )
  const hasStubText =
    stubServicesText.trim() !== '' ||
    stubTipsText.trim() !== '' ||
    stubDeductionsText.trim() !== ''

  async function save(): Promise<void> {
    if (saveInFlight.current) return

    const next: Errors = {}
    const dateOk = isIsoDate(date)
    if (!dateOk) next.date = t(locale, 'errorDate')
    if (!check.ok) next.check = t(locale, 'errorAmount')
    if (!cash.ok) next.cash = t(locale, 'errorAmount')
    if (!other.ok) next.other = t(locale, 'errorAmount')
    if (!stubServices.ok) next.stubServices = t(locale, 'errorAmount')
    if (!stubTips.ok) next.stubTips = t(locale, 'errorAmount')
    if (!stubDeductions.ok) next.stubDeductions = t(locale, 'errorAmount')
    if (!gotSomething && !hasStubText && record === null) {
      next.nothing = t(locale, 'errorNothingRecorded')
    }

    if (Object.values(next).some((value) => value !== undefined)) {
      setErrors(next)
      return
    }

    const payments: { method: PaymentMethod; cents: number }[] = []
    if (check.cents !== null && check.cents > 0) payments.push({ method: 'check', cents: check.cents })
    if (cash.cents !== null && cash.cents > 0) payments.push({ method: 'cash', cents: cash.cents })
    if (other.cents !== null && other.cents > 0) {
      payments.push({ method: otherMethod, cents: other.cents })
    }

    setErrors({})
    saveInFlight.current = true
    try {
      for (const payment of payments) {
        await addPayment(db, {
          paymentDate: date,
          amountCents: payment.cents,
          paymentMethod: payment.method,
          allocations: [{ payPeriodId: periodId, amountCents: payment.cents }],
        })
      }
      await saveStub(db, periodId, {
        servicesCents: stubServices.cents,
        tipsCents: stubTips.cents,
        deductionsCents: stubDeductions.cents,
      })
    } catch (error) {
      saveInFlight.current = false
      throw error
    }
    onDone()
  }

  function submit(event: FormEvent): void {
    event.preventDefault()
    void save()
  }

  return (
    <>
      <form
        onSubmit={submit}
        noValidate
        className={`flex min-h-[calc(100dvh-2rem)] flex-col gap-5 ${
          numberPad ? 'pb-[280px]' : ''
        }`}
      >
        <header className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDone}
            aria-label={t(locale, 'close')}
            className="flex min-h-11 min-w-11 items-center justify-center"
          >
            <IconX size={22} aria-hidden="true" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center font-medium">
            {t(locale, 'recordWhatYouGot')}
          </h1>
          <span className="w-11" />
        </header>

        <div>
          <label htmlFor={`${id}-date`} className={label}>
            {t(locale, 'paymentDate')}
          </label>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              clearError('date')
            }}
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? `${id}-date-error` : undefined}
            className={field}
          />
          {errors.date && (
            <p id={`${id}-date-error`} className={errorText}>
              {errors.date}
            </p>
          )}
        </div>

        <MoneyField
          label={t(locale, 'checkAmount')}
          value={checkText}
          onChange={(value) => change('check', value)}
          error={errors.check}
          usePad={numberPad}
          active={padShown && padTarget === 'check'}
          padTarget="check"
          onFieldFocus={(element) => focusPad('check', element)}
          onFieldBlur={blurPad}
        />

        <MoneyField
          label={t(locale, 'cashAmount')}
          value={cashText}
          onChange={(value) => change('cash', value)}
          error={errors.cash}
          usePad={numberPad}
          active={padShown && padTarget === 'cash'}
          padTarget="cash"
          onFieldFocus={(element) => focusPad('cash', element)}
          onFieldBlur={blurPad}
        />

        <div className="flex flex-col gap-3">
          <MoneyField
            label={t(locale, 'otherPayment')}
            value={otherText}
            onChange={(value) => change('other', value)}
            error={errors.other}
            usePad={numberPad}
            active={padShown && padTarget === 'other'}
            padTarget="other"
            onFieldFocus={(element) => focusPad('other', element)}
            onFieldBlur={blurPad}
          />
          <div>
            <p className={label}>{t(locale, 'paymentMethod')}</p>
            <div className="flex flex-wrap gap-2">
              {OTHER_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  aria-pressed={otherMethod === method}
                  className={`${chip} ${otherMethod === method ? chipOn : chipOff}`}
                  onClick={() => setOtherMethod(method)}
                >
                  {t(locale, method === 'zelle' ? 'methodZelle' : method === 'directDeposit' ? 'methodDirectDeposit' : 'methodOther')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            aria-expanded={stubOpen}
            aria-controls={`${id}-stub`}
            onClick={() => setStubOpen((open) => !open)}
            className={`${secondaryButton} flex items-center justify-center gap-2`}
          >
            {t(locale, 'stubTitle')}
            <IconChevronDown
              size={18}
              aria-hidden="true"
              className={stubOpen ? 'rotate-180' : undefined}
            />
          </button>

          {stubOpen && (
            <div id={`${id}-stub`} className="mt-3 flex flex-col gap-3">
              <MoneyField
                label={t(locale, 'stubServices')}
                value={stubServicesText}
                onChange={(value) => change('stubServices', value)}
                error={errors.stubServices}
                usePad={numberPad}
                active={padShown && padTarget === 'stubServices'}
                padTarget="stubServices"
                onFieldFocus={(element) => focusPad('stubServices', element)}
                onFieldBlur={blurPad}
              />
              <MoneyField
                label={t(locale, 'stubTips')}
                value={stubTipsText}
                onChange={(value) => change('stubTips', value)}
                error={errors.stubTips}
                usePad={numberPad}
                active={padShown && padTarget === 'stubTips'}
                padTarget="stubTips"
                onFieldFocus={(element) => focusPad('stubTips', element)}
                onFieldBlur={blurPad}
              />
              <MoneyField
                label={t(locale, 'stubDeductions')}
                value={stubDeductionsText}
                onChange={(value) => change('stubDeductions', value)}
                error={errors.stubDeductions}
                usePad={numberPad}
                active={padShown && padTarget === 'stubDeductions'}
                padTarget="stubDeductions"
                onFieldFocus={(element) => focusPad('stubDeductions', element)}
                onFieldBlur={blurPad}
              />
            </div>
          )}
        </div>

        {errors.nothing && <p className={errorText}>{errors.nothing}</p>}

        <div className="mt-auto">
          <button type="submit" className={primaryButton}>
            {t(locale, 'save')}
          </button>
        </div>
      </form>

      {padShown &&
        createPortal(
          <NumberPad
            locale={locale}
            onDigit={typeOnPad}
            onBackspace={() => typeOnPad('back')}
            onNext={focusNextPadTarget}
            onSave={() => {
              void save()
            }}
          />,
          document.body,
        )}
    </>
  )
}
