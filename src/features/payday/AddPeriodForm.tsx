import { useId, useRef, useState } from 'react'
import { useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { isIsoDate, type IsoDate } from '../../domain/dates.ts'
import { customPeriodProblem, type DateSpan } from '../../domain/payPeriods.ts'
import { t } from '../../lib/i18n.ts'
import {
  card,
  errorText,
  field,
  label,
  primaryButton,
  secondaryButton,
} from '../../ui/styles.ts'
import { addCustomPeriod } from './periodStore.ts'

interface Props {
  existing: readonly (DateSpan & { id: string })[]
  onDone: () => void
}

/** The add form for a custom pay period, shown in place of the add button. */
export function AddPeriodForm({ existing, onDone }: Props) {
  const { locale } = useSettings()
  const id = useId()
  const [from, setFrom] = useState<IsoDate>('')
  const [to, setTo] = useState<IsoDate>('')
  const [error, setError] = useState<string | undefined>()

  // A quick double tap submits twice before React can re-render. The ref is
  // set synchronously, so the second submit does nothing and cannot report
  // the period it just added as an overlap.
  const saveInFlight = useRef(false)

  function problemText(problem: 'endBeforeStart' | 'overlap'): string {
    return t(locale, problem === 'endBeforeStart' ? 'errorPeriodOrder' : 'errorPeriodOverlap')
  }

  async function save(): Promise<void> {
    if (saveInFlight.current) return

    if (!isIsoDate(from) || !isIsoDate(to)) {
      setError(t(locale, 'errorDate'))
      return
    }

    const problem = customPeriodProblem(from, to, existing)
    if (problem) {
      setError(problemText(problem))
      return
    }

    setError(undefined)
    saveInFlight.current = true
    try {
      await addCustomPeriod(db, from, to)
    } catch (thrown) {
      saveInFlight.current = false
      const problem = thrown instanceof Error ? thrown.message : ''
      // The store checks again against fresh data; report its answer instead
      // of letting a race escape as an unhandled error.
      if (problem === 'endBeforeStart' || problem === 'overlap') {
        setError(problemText(problem))
        return
      }
      throw thrown
    }
    onDone()
  }

  const errorId = `${id}-error`

  return (
    <section className={card}>
      <h2 className="font-medium">{t(locale, 'newPeriod')}</h2>

      <div className="mt-3 flex gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-from`} className={label}>
            {t(locale, 'from')}
          </label>
          <input
            id={`${id}-from`}
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value)
              setError(undefined)
            }}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={field}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-to`} className={label}>
            {t(locale, 'to')}
          </label>
          <input
            id={`${id}-to`}
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value)
              setError(undefined)
            }}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={field}
          />
        </div>
      </div>

      {error && (
        <p id={errorId} className={errorText}>
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <button type="button" onClick={() => void save()} className={primaryButton}>
          {t(locale, 'save')}
        </button>
        <button type="button" onClick={onDone} className={secondaryButton}>
          {t(locale, 'cancel')}
        </button>
      </div>
    </section>
  )
}
