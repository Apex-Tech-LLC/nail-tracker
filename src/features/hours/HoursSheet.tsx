import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { formatDayLong, formatTime, type IsoDate } from '../../domain/dates.ts'
import type { HoursSuggestion } from '../../domain/hours.ts'
import { t, tf } from '../../lib/i18n.ts'
import { field, label, secondaryButton } from '../../ui/styles.ts'
import { setWorkHours } from '../history/workDays.ts'
import { clockText } from './hoursText.ts'

interface Props {
  date: IsoDate
  startTime: string | null
  endTime: string | null
  /** Filled in only when the day has turns and no hours yet. */
  suggestion: HoursSuggestion | null
  onClose: () => void
}

/** A small bottom sheet for one day's start and end time. Nothing is saved until Save. */
export function HoursSheet({ date, startTime, endTime, suggestion, onClose }: Props) {
  const { locale } = useSettings()
  const id = useId()
  const firstInput = useRef<HTMLInputElement | null>(null)
  const [start, setStart] = useState(startTime ?? suggestion?.start ?? '')
  const [end, setEnd] = useState(endTime ?? suggestion?.end ?? '')
  const dayText = formatDayLong(date, locale)
  const showSuggestion = suggestion !== null && startTime === null && endTime === null

  useEffect(() => {
    firstInput.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function save() {
    if (!start || !end) return
    await setWorkHours(db, date, start, end)
    onClose()
  }

  async function clear() {
    await setWorkHours(db, date, null, null)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tf(locale, 'hoursFor', { day: dayText })}
        className="absolute inset-x-4 bottom-4 flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="px-1 text-sm font-bold">{dayText}</p>

        {showSuggestion && suggestion && (
          <p className="px-1 text-sm text-text-secondary">
            {tf(locale, 'hoursSuggestion', {
              first: formatTime(suggestion.firstTurnAt, locale),
              last: formatTime(suggestion.lastTurnAt, locale),
              start: clockText(suggestion.start, locale),
              end: clockText(suggestion.end, locale),
            })}
          </p>
        )}

        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id}-start`} className={label}>
              {t(locale, 'hoursStart')}
            </label>
            <input
              ref={firstInput}
              id={`${id}-start`}
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className={field}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id}-end`} className={label}>
              {t(locale, 'hoursEnd')}
            </label>
            <input
              id={`${id}-end`}
              type="time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className={field}
            />
          </div>
        </div>

        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            void save()
          }}
          disabled={!start || !end}
        >
          {t(locale, 'save')}
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            void clear()
          }}
        >
          {t(locale, 'clearHours')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
