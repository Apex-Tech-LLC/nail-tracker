import { IconTrash, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { db, type Adjustment } from '../../db/schema.ts'
import { isIsoDate, localDateTimeToMs, todayIso, type IsoDate } from '../../domain/dates.ts'
import { centsToInput, parseSignedCents } from '../../domain/money.ts'
import type { AdjustmentCategory } from '../../domain/totals.ts'
import { t } from '../../lib/i18n.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { useToast } from '../../ui/useToast.ts'
import {
  chip,
  chipOff,
  chipOn,
  field,
  label,
  primaryButton,
} from '../../ui/styles.ts'
import { WorkDateField } from '../../ui/WorkDateField.tsx'
import { ADJUSTMENT_LABEL } from './adjustmentLabels.ts'
import {
  addAdjustment,
  deleteAdjustment,
  restoreAdjustment,
  updateAdjustment,
  type AdjustmentInput,
} from './adjustmentStore.ts'

const CATEGORIES: AdjustmentCategory[] = [
  'bonus',
  'commissionCorrection',
  'tipCorrection',
  'bookkeepingDeduction',
]

interface Errors {
  amount?: string
  date?: string
}

interface Props {
  adjustmentId?: string
  onDone: () => void
}

/** Loads a saved adjustment before the form starts. */
export function AdjustmentForm({ adjustmentId, onDone }: Props) {
  const { locale } = useSettings()
  const existing = useLiveQuery(async () => {
    if (!adjustmentId) return null
    return (await db.adjustments.get(adjustmentId)) ?? null
  }, [adjustmentId])

  if (existing === undefined) return null

  if (adjustmentId && existing === null) {
    return (
      <>
        <p>{t(locale, 'entryNotFound')}</p>
        <Link href={paths.today} replace className="text-brand-600 underline">
          {t(locale, 'backToToday')}
        </Link>
      </>
    )
  }

  return <AdjustmentFormFields adjustment={existing} onDone={onDone} />
}

interface FieldsProps {
  adjustment: Adjustment | null
  onDone: () => void
}

function AdjustmentFormFields({ adjustment, onDone }: FieldsProps) {
  const { locale } = useSettings()
  const id = useId()
  const [date, setDate] = useState<IsoDate>(adjustment?.localWorkDate ?? todayIso())
  const [amountText, setAmountText] = useState(
    adjustment ? centsToInput(adjustment.amountCents) : '',
  )
  const [category, setCategory] = useState<AdjustmentCategory>(
    adjustment?.category ?? 'bonus',
  )
  const [noteText, setNoteText] = useState(adjustment?.note ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  // A quick double tap submits twice before React can re-render. The ref is
  // set synchronously, so the second submit does nothing.
  const saveInFlight = useRef(false)

  async function save(): Promise<boolean> {
    if (saveInFlight.current) return false

    const amountCents = parseSignedCents(amountText)
    const next: Errors = {}
    if (amountCents === null || amountCents === 0) {
      next.amount = t(locale, 'errorAdjustmentAmount')
    }
    if (!isIsoDate(date)) next.date = t(locale, 'errorDate')
    if (amountCents === null || amountCents === 0 || !isIsoDate(date)) {
      setErrors(next)
      return false
    }

    setErrors({})
    saveInFlight.current = true
    const input: AdjustmentInput = {
      occurredAt: adjustment
        ? date === adjustment.localWorkDate
          ? adjustment.occurredAt
          : localDateTimeToMs(date, '12:00')
        : Date.now(),
      localWorkDate: date,
      amountCents,
      category,
      note: noteText,
    }
    try {
      if (adjustment) await updateAdjustment(db, adjustment.id, input)
      else await addAdjustment(db, input)
    } catch (error) {
      saveInFlight.current = false
      throw error
    }
    return true
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (await save()) onDone()
  }

  async function deleteNow() {
    if (!adjustment || deleting) return
    setDeleting(true)
    try {
      const removed = await deleteAdjustment(db, adjustment.id)
      if (removed) {
        toast.show({
          message: t(locale, 'adjustmentDeleted'),
          actions: [
            {
              label: t(locale, 'undo'),
              onClick: () => {
                void restoreAdjustment(db, removed)
              },
            },
          ],
        })
      }
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
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDone}
          aria-label={t(locale, 'close')}
          className="flex min-h-11 min-w-11 items-center justify-center"
        >
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="font-medium">
          {t(locale, adjustment ? 'editAdjustment' : 'newAdjustment')}
        </h1>
        {adjustment ? (
          <button
            type="button"
            aria-label={t(locale, 'delete')}
            disabled={deleting}
            onClick={() => {
              void deleteNow()
            }}
            className="flex min-h-11 min-w-11 items-center justify-center text-danger-text"
          >
            <IconTrash size={22} aria-hidden="true" />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </header>

      <WorkDateField
        value={date}
        onChange={(value) => {
          setDate(value)
          setErrors((previous) =>
            previous.date ? { ...previous, date: undefined } : previous,
          )
        }}
        error={errors.date}
      />

      <div>
        <MoneyField
          label={t(locale, 'amountSigned')}
          inputMode="text"
          value={amountText}
          onChange={(value) => {
            setAmountText(value)
            setErrors((previous) =>
              previous.amount ? { ...previous, amount: undefined } : previous,
            )
          }}
          error={errors.amount}
        />
        <p className="mt-1 text-sm text-text-secondary">{t(locale, 'amountSignedHint')}</p>
      </div>

      <div>
        <p className={label}>{t(locale, 'category')}</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              className={`${chip} ${category === value ? chipOn : chipOff}`}
              onClick={() => setCategory(value)}
            >
              {t(locale, ADJUSTMENT_LABEL[value])}
            </button>
          ))}
        </div>
        {category === 'bookkeepingDeduction' && (
          <p className="mt-1 text-sm text-text-secondary">{t(locale, 'adjBookkeepingHint')}</p>
        )}
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

      <div className="mt-auto">
        <button type="submit" className={primaryButton}>
          {t(locale, 'save')}
        </button>
      </div>

    </form>
  )
}
