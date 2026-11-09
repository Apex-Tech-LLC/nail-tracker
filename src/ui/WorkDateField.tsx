import { useId } from 'react'
import { IconCalendar } from '@tabler/icons-react'
import { useSettings } from '../app/settings.ts'
import { useToday } from '../app/useToday.ts'
import { addDays, formatDatePill, isIsoDate, type IsoDate } from '../domain/dates.ts'
import { t } from '../lib/i18n.ts'
import { chip, chipOff, chipOn, errorText, label } from './styles.ts'

interface Props {
  value: IsoDate
  onChange: (value: IsoDate) => void
  error?: string
  /** Smaller buttons for the Add turn header, where the row shares a line with other pills. */
  compact?: boolean
  /** The heading above the row. Defaults to "Date". */
  label?: string
  /** What the date input is called to a screen reader and a test. Defaults to "Work date". */
  inputLabel?: string
}

const compactChip =
  'inline-flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-full border-[1.5px] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand-ink'

/**
 * The date row shared by the turn, voice and adjustment screens: Today and
 * Yesterday in one tap, and a pill showing the chosen day. The pill carries a
 * real date input laid over it, invisible but tappable, so one tap opens the
 * phone's own date picker.
 */
export function WorkDateField({
  value,
  onChange,
  error,
  compact = false,
  label: heading,
  inputLabel,
}: Props) {
  const { locale } = useSettings()
  const id = useId()
  const today = useToday()
  const yesterday = addDays(today, -1)

  const base = compact ? compactChip : `${chip} flex items-center justify-center`
  const other = value !== today && value !== yesterday
  const dateLabel = inputLabel ?? t(locale, 'workDate')
  const shown = isIsoDate(value) ? formatDatePill(value, locale) : dateLabel
  const errorId = `${id}-date-error`

  function openPicker(input: HTMLInputElement) {
    // Older iPhones have no showPicker; the tap itself opens their picker.
    try {
      input.showPicker()
    } catch {
      // Not supported, or not allowed right now: the tap is enough.
    }
  }

  const row = (
    // In the Add turn header the row takes its own line, under the Say and commission pills.
    <div className={`flex w-full items-center gap-2 ${compact ? 'order-3' : ''}`}>
      <button
        type="button"
        aria-pressed={value === today}
        className={`${base} ${value === today ? chipOn : chipOff}`}
        onClick={() => onChange(today)}
      >
        {t(locale, 'today')}
      </button>
      <button
        type="button"
        aria-pressed={value === yesterday}
        className={`${base} ${value === yesterday ? chipOn : chipOff}`}
        onClick={() => onChange(yesterday)}
      >
        {t(locale, 'yesterday')}
      </button>
      <span
        data-date-pill
        className={`${base} relative flex-1 gap-1.5 focus-within:outline-2 focus-within:outline-brand-ink ${
          other ? chipOn : chipOff
        }`}
      >
        <span aria-hidden="true">{shown}</span>
        <IconCalendar size={16} aria-hidden="true" />
        <input
          id={`${id}-date`}
          type="date"
          value={value}
          aria-label={dateLabel}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => openPicker(event.currentTarget)}
          className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
        />
      </span>
    </div>
  )

  const errorLine = error && (
    <p id={errorId} className={`${errorText} ${compact ? 'order-last basis-full' : ''}`}>
      {error}
    </p>
  )

  if (compact) {
    return (
      <>
        {row}
        {errorLine}
      </>
    )
  }

  return (
    <div>
      <p className={label}>{heading ?? t(locale, 'date')}</p>
      {row}
      {errorLine}
    </div>
  )
}
