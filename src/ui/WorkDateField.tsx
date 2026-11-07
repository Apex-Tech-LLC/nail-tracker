import { useId, useState } from 'react'
import { useSettings } from '../app/settings.ts'
import { useToday } from '../app/useToday.ts'
import { addDays, formatDayShort, type IsoDate } from '../domain/dates.ts'
import { t } from '../lib/i18n.ts'
import { chip, chipOff, chipOn, errorText, field, label, pill } from './styles.ts'

interface Props {
  value: IsoDate
  onChange: (value: IsoDate) => void
  error?: string
  /** One pill at the top of the Add turn screen; the choices open under it. */
  compact?: boolean
}

/** The date chips and date box shared by the turn and adjustment forms. */
export function WorkDateField({ value, onChange, error, compact = false }: Props) {
  const { locale } = useSettings()
  const id = useId()
  const today = useToday()
  const yesterday = addDays(today, -1)
  const [pickOtherDay, setPickOtherDay] = useState(value !== today && value !== yesterday)
  const [open, setOpen] = useState(false)

  function pick(date: IsoDate) {
    setPickOtherDay(false)
    onChange(date)
    if (compact) setOpen(false)
  }

  function changeDate(date: IsoDate) {
    onChange(date)
    if (compact) setOpen(false)
  }

  const choices = (
    <>
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
            onChange={(event) => changeDate(event.target.value)}
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
    </>
  )

  if (compact) {
    const shown =
      value === today
        ? t(locale, 'today')
        : value === yesterday
          ? t(locale, 'yesterday')
          : formatDayShort(value, locale)
    return (
      <div className={open ? 'w-full' : undefined}>
        <div className="flex justify-end">
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${t(locale, 'date')}: ${shown}`}
            className={pill}
            onClick={() => setOpen((wasOpen) => !wasOpen)}
          >
            {shown}
            <span aria-hidden="true">▾</span>
          </button>
        </div>
        {open && <div className="mt-2">{choices}</div>}
      </div>
    )
  }

  return (
    <div>
      <p className={label}>{t(locale, 'date')}</p>
      {choices}
    </div>
  )
}
