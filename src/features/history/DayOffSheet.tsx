import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { formatDayLong, type IsoDate } from '../../domain/dates.ts'
import { t, tf } from '../../lib/i18n.ts'
import { secondaryButton } from '../../ui/styles.ts'
import { setDayOff } from './workDays.ts'

interface Props {
  date: IsoDate
  dayOff: boolean
  onClose: () => void
}

/** A small bottom sheet: mark the day off, or undo that. */
export function DayOffSheet({ date, dayOff, onClose }: Props) {
  const { locale } = useSettings()
  const firstButton = useRef<HTMLButtonElement | null>(null)
  const dayText = formatDayLong(date, locale)

  useEffect(() => {
    firstButton.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function toggle() {
    await setDayOff(db, date, !dayOff)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tf(locale, 'dayActionsFor', { day: dayText })}
        className="absolute inset-x-4 bottom-4 flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="px-1 text-sm font-bold">{dayText}</p>
        <button
          ref={firstButton}
          type="button"
          className={secondaryButton}
          onClick={() => {
            void toggle()
          }}
        >
          {t(locale, dayOff ? 'notDayOff' : 'markDayOff')}
        </button>
        <button type="button" className={secondaryButton} onClick={onClose}>
          {t(locale, 'cancel')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
