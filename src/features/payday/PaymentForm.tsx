import { IconTrash, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import {
  db,
  type Payment,
  type PaymentAllocation,
  type PaymentMethod,
} from '../../db/schema.ts'
import { formatRange, isIsoDate, todayIso, type IsoDate } from '../../domain/dates.ts'
import { centsToInput, formatUsd, parseCents } from '../../domain/money.ts'
import {
  allocationProblem,
  suggestAllocations,
  type AllocationLine,
} from '../../domain/payday.ts'
import { t, tf } from '../../lib/i18n.ts'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'
import { MoneyField } from '../../ui/MoneyField.tsx'
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
import { PAYMENT_METHOD_LABEL } from './payStateLabels.ts'
import { addPayment, deletePayment, updatePayment, type PaymentInput } from './paymentStore.ts'
import { loadPeriodSummaries, type PeriodSummary } from './periodStore.ts'

const METHODS: PaymentMethod[] = ['cash', 'check', 'directDeposit', 'zelle', 'other']

interface Errors {
  date?: string
  amount?: string
  allocation?: string
}

interface LineState {
  key: string
  payPeriodId: string
  amount: string
  error?: string
}

function toLineState(line: AllocationLine): LineState {
  return {
    key: crypto.randomUUID(),
    payPeriodId: line.payPeriodId,
    amount: centsToInput(line.amountCents),
  }
}

interface Props {
  periodId?: string
  paymentId?: string
  onDone: () => void
}

interface Loaded {
  summaries: PeriodSummary[]
  payment: Payment | null
  allocations: PaymentAllocation[]
}

export function PaymentForm({ periodId, paymentId, onDone }: Props) {
  const { locale } = useSettings()

  const loaded = useLiveQuery(async (): Promise<Loaded> => {
    const summaries = await loadPeriodSummaries(db)
    if (!paymentId) return { summaries, payment: null, allocations: [] }

    const payment = (await db.payments.get(paymentId)) ?? null
    if (!payment) return { summaries, payment: null, allocations: [] }

    const allocations = await db.paymentAllocations
      .where('paymentId')
      .equals(paymentId)
      .toArray()
    return { summaries, payment, allocations }
  }, [paymentId])

  if (loaded === undefined) return null

  const missingPayment = paymentId != null && loaded.payment === null
  const missingPeriod =
    periodId != null && !loaded.summaries.some((summary) => summary.period.id === periodId)

  if (missingPayment || missingPeriod) {
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
    <PaymentFormFields
      summaries={loaded.summaries}
      payment={loaded.payment}
      allocations={loaded.allocations}
      periodId={periodId}
      onDone={onDone}
    />
  )
}

interface FieldsProps {
  summaries: PeriodSummary[]
  payment: Payment | null
  allocations: PaymentAllocation[]
  periodId?: string
  onDone: () => void
}

function PaymentFormFields({
  summaries,
  payment,
  allocations,
  periodId,
  onDone,
}: FieldsProps) {
  const { locale } = useSettings()
  const id = useId()
  const [date, setDate] = useState<IsoDate>(payment?.paymentDate ?? todayIso())
  const [amountText, setAmountText] = useState(
    payment ? centsToInput(payment.amountCents) : '',
  )
  const [method, setMethod] = useState<PaymentMethod>(
    payment?.paymentMethod ?? 'directDeposit',
  )
  const [noteText, setNoteText] = useState(payment?.notes ?? '')
  const [lines, setLines] = useState<LineState[]>(() =>
    payment ? allocations.map(toLineState) : [],
  )
  const [linesTouched, setLinesTouched] = useState(!!payment)
  const [errors, setErrors] = useState<Errors>({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // A quick double tap submits twice before React can re-render. The ref is
  // set synchronously, so the second submit does nothing and saves once.
  const saveInFlight = useRef(false)

  // The payment's own allocation still counts as paid in the summaries, so
  // add it back before suggesting lines, or editing would double-count it.
  const mineByPeriod = new Map(
    allocations.map((allocation) => [allocation.payPeriodId, allocation.amountCents]),
  )
  const owing = summaries.map((summary) => ({
    payPeriodId: summary.period.id,
    outstandingCents:
      summary.outstandingCents + (payment ? (mineByPeriod.get(summary.period.id) ?? 0) : 0),
  }))
  const fallback =
    periodId ?? allocations[0]?.payPeriodId ?? summaries[0]?.period.id ?? ''

  // Newest first in the dropdown, so the period being paid is easy to find.
  const periodOptions = [...summaries].reverse()

  function changeAmount(value: string): void {
    setAmountText(value)
    setErrors((previous) => ({ ...previous, amount: undefined }))

    if (linesTouched) return
    const cents = parseCents(value)
    if (cents !== null && cents > 0) {
      setLines(suggestAllocations(cents, owing, fallback).map(toLineState))
    } else {
      setLines([])
    }
  }

  function changeLine(key: string, patch: Partial<LineState>): void {
    setLinesTouched(true)
    setErrors((previous) => ({ ...previous, allocation: undefined }))
    setLines((previous) =>
      previous.map((line) =>
        line.key === key ? { ...line, ...patch, error: undefined } : line,
      ),
    )
  }

  function removeLine(key: string): void {
    setLinesTouched(true)
    setErrors((previous) => ({ ...previous, allocation: undefined }))
    setLines((previous) => previous.filter((line) => line.key !== key))
  }

  function addLine(): void {
    const used = new Set(lines.map((line) => line.payPeriodId))
    const next = periodOptions.find((summary) => !used.has(summary.period.id))
    if (!next) return

    setLinesTouched(true)
    setErrors((previous) => ({ ...previous, allocation: undefined }))
    setLines((previous) => [
      ...previous,
      { key: crypto.randomUUID(), payPeriodId: next.period.id, amount: '' },
    ])
  }

  const amountCents = parseCents(amountText) ?? 0
  const readableCents = lines.reduce((sum, line) => {
    const cents = parseCents(line.amount)
    return cents === null ? sum : sum + cents
  }, 0)
  const leftCents = amountCents - readableCents

  async function save(): Promise<void> {
    if (saveInFlight.current) return

    const cents = parseCents(amountText)
    const dateOk = isIsoDate(date)
    const next: Errors = {}
    if (cents === null || cents <= 0) next.amount = t(locale, 'errorPaymentAmount')
    if (!dateOk) next.date = t(locale, 'errorDate')

    let badLine = false
    const checked = lines.map((line) => {
      if (parseCents(line.amount) === null) {
        badLine = true
        return { ...line, error: t(locale, 'errorAmount') }
      }
      return { ...line, error: undefined }
    })
    setLines(checked)

    if (badLine || cents === null || cents <= 0 || !dateOk) {
      setErrors(next)
      return
    }

    // Two lines for the same period are one allocation.
    const merged: AllocationLine[] = []
    for (const line of checked) {
      const lineCents = parseCents(line.amount)
      if (lineCents === null) continue
      const existing = merged.find((item) => item.payPeriodId === line.payPeriodId)
      if (existing) existing.amountCents += lineCents
      else merged.push({ payPeriodId: line.payPeriodId, amountCents: lineCents })
    }

    const problem = allocationProblem(cents, merged)
    if (problem) {
      setErrors({
        amount: problem === 'amount' ? t(locale, 'errorPaymentAmount') : undefined,
        allocation:
          problem === 'line'
            ? t(locale, 'errorAllocationLine')
            : problem === 'mismatch'
              ? t(locale, 'errorAllocationMismatch')
              : undefined,
      })
      return
    }

    setErrors({})
    const input: PaymentInput = {
      paymentDate: date,
      amountCents: cents,
      paymentMethod: method,
      notes: noteText,
      allocations: merged,
    }

    saveInFlight.current = true
    try {
      if (payment) await updatePayment(db, payment.id, input)
      else await addPayment(db, input)
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

  async function confirmDelete(): Promise<void> {
    if (!payment || deleting) return
    setDeleting(true)
    try {
      await deletePayment(db, payment.id)
      onDone()
    } catch (error) {
      setDeleting(false)
      throw error
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex min-h-[calc(100dvh-2rem)] flex-col gap-5"
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
        <h1 className="min-w-0 flex-1 break-words text-center font-medium leading-tight">
          {t(locale, payment ? 'editPayment' : 'newPayment')}
        </h1>
        {payment ? (
          <button
            type="button"
            aria-label={t(locale, 'delete')}
            onClick={() => setConfirmingDelete(true)}
            className="flex min-h-11 min-w-11 items-center justify-center text-danger-text"
          >
            <IconTrash size={22} aria-hidden="true" />
          </button>
        ) : (
          <span className="w-11" />
        )}
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
            setErrors((previous) =>
              previous.date ? { ...previous, date: undefined } : previous,
            )
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
        label={t(locale, 'paymentAmount')}
        value={amountText}
        onChange={changeAmount}
        error={errors.amount}
      />

      <div>
        <p className={label}>{t(locale, 'paymentMethod')}</p>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={method === value}
              className={`${chip} ${method === value ? chipOn : chipOff}`}
              onClick={() => setMethod(value)}
            >
              {t(locale, PAYMENT_METHOD_LABEL[value])}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-note`} className={label}>
          {t(locale, 'note')}
        </label>
        <textarea
          id={`${id}-note`}
          rows={2}
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          className={field}
        />
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">{t(locale, 'allocationTitle')}</h2>
          <p className="text-sm text-text-secondary">{t(locale, 'allocationHint')}</p>
        </div>

        {lines.map((line) => (
          <div
            key={line.key}
            data-testid="allocation-line"
            className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
          >
            <div>
              <label htmlFor={`${id}-period-${line.key}`} className={label}>
                {t(locale, 'payPeriod')}
              </label>
              <select
                id={`${id}-period-${line.key}`}
                value={line.payPeriodId}
                onChange={(event) => changeLine(line.key, { payPeriodId: event.target.value })}
                className={field}
              >
                {periodOptions.map((summary) => (
                  <option key={summary.period.id} value={summary.period.id}>
                    {formatRange(summary.period.startDate, summary.period.endDate, locale)}
                  </option>
                ))}
              </select>
            </div>

            <MoneyField
              label={t(locale, 'paymentAmount')}
              value={line.amount}
              onChange={(value) => changeLine(line.key, { amount: value })}
              error={line.error}
            />

            {lines.length > 1 && (
              <button
                type="button"
                aria-label={t(locale, 'remove')}
                onClick={() => removeLine(line.key)}
                className="flex min-h-11 min-w-11 items-center justify-center self-start text-danger-text"
              >
                <IconTrash size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={addLine} className={secondaryButton}>
          {t(locale, 'addAllocation')}
        </button>

        {leftCents !== 0 && (
          <p className="text-sm text-text-secondary">
            {tf(locale, 'allocationLeft', { amount: formatUsd(leftCents) })}
          </p>
        )}
        {errors.allocation && <p className={errorText}>{errors.allocation}</p>}
      </section>

      <div className="mt-auto">
        <button type="submit" className={primaryButton}>
          {t(locale, 'save')}
        </button>
      </div>

      {payment && (
        <ConfirmDialog
          open={confirmingDelete}
          title={t(locale, 'deletePaymentTitle')}
          body={t(locale, 'deletePaymentBody')}
          confirmLabel={t(locale, 'delete')}
          cancelLabel={t(locale, 'cancel')}
          danger
          confirmDisabled={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </form>
  )
}
