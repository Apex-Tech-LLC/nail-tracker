import { useId, useState } from 'react'
import { useSettings } from '../app/settings.ts'
import { useToday } from '../app/useToday.ts'
import { addDays, type IsoDate } from '../domain/dates.ts'
import { t } from '../lib/i18n.ts'
import { chip, chipOff, chipOn, errorText, field, label } from './styles.ts'

interface Props {
  value: IsoDate
  onChange: (value: IsoDate) => void
  error?: string
}

/** The date chips and date box shared by the turn and adjustment forms. */
export function WorkDateField({ value, onChange, error }: Props) {
  const { locale } = useSettings()
  const id = useId()
  const today = useToday()
  const yesterday = addDays(today, -1)
  const [pickOtherDay, setPickOtherDay] = useState(value !== today && value !== yesterday)

  function pick(date: IsoDate) {
    setPickOtherDay(false)
    onChange(date)
  }

  return (
    <div>
      <p className={label}>{t(locale, 'date')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!pickOtherDay && value === today}
          className={`${chip} ${!pickOtherDay && value === today ? chipOn : chipOff}`}
          onClick={() => pick(today)}
        >
          {t(locale, 'today')}
        </button>
        <button
          type="button"
          aria-pressed={!pickOtherDay && value === yesterday}
          className={`${chip} ${!pickOtherDay && value === yesterday ? chipOn : chipOff}`}
          onClick={() => pick(yesterday)}
        >
          {t(locale, 'yesterday')}
        </button>
        <button
          type="button"
          aria-pressed={pickOtherDay}
          className={`${chip} ${pickOtherDay ? chipOn : chipOff}`}
          onClick={() => setPickOtherDay(true)}
        >
          {t(locale, 'otherDay')}
        </button>
      </div>
      {pickOtherDay && (
        <div className="mt-3">
          <label htmlFor={`${id}-date`} className={label}>
            {t(locale, 'workDate')}
          </label>
          <input
            id={`${id}-date`}
            type="date"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-date-error` : undefined}
            className={field}
          />
          {error && (
            <p id={`${id}-date-error`} className={errorText}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
