import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useRef, useState } from 'react'
import {
  formatDayLong,
  formatMonthYear,
  formatWeekdayShort,
  monthRange,
  parseIsoDate,
  type IsoDate,
} from '../../domain/dates.ts'
import { formatUsdShort } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { calendarWeeks, colorStep, type ColorStep } from './calendar.ts'

const STEP_CLASSES: Record<ColorStep, string> = {
  0: 'bg-surface',
  1: 'bg-brand-50',
  2: 'bg-brand-100',
  3: 'bg-brand-200',
  4: 'bg-brand-400 text-white',
}

const LONG_PRESS_MS = 500

interface Props {
  month: IsoDate
  today: IsoDate
  weekStart: 0 | 1
  locale: Locale
  earnedByDate: Map<IsoDate, number>
  offDates: Set<IsoDate>
  onPrevious: () => void
  onNext: () => void
  onPick: (date: IsoDate) => void
  onMenu: (date: IsoDate) => void
}

/** One month: each worked day's earned total, darker for bigger days. */
export function CalendarView({
  month,
  today,
  weekStart,
  locale,
  earnedByDate,
  offDates,
  onPrevious,
  onNext,
  onPick,
  onMenu,
}: Props) {
  const weeks = calendarWeeks(month, weekStart)
  const bestCents = Math.max(0, ...earnedByDate.values())
  const range = monthRange(month)
  const firstWeek = weeks[0] ?? []

  return (
    <section className="rounded-card border border-border bg-surface p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={t(locale, 'previousMonth')}
          onClick={onPrevious}
          className="flex h-11 w-11 items-center justify-center rounded-control text-text-secondary"
        >
          <IconChevronLeft size={22} aria-hidden="true" />
        </button>
        <h2 className="text-base font-bold">{formatMonthYear(range.start, locale)}</h2>
        <button
          type="button"
          aria-label={t(locale, 'nextMonth')}
          onClick={onNext}
          className="flex h-11 w-11 items-center justify-center rounded-control text-text-secondary"
        >
          <IconChevronRight size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-text-muted">
        {firstWeek.map((date) => (
          <span key={date}>{formatWeekdayShort(date, locale)}</span>
        ))}
      </div>

      <div className="mt-1 flex flex-col gap-1">
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 gap-1">
            {week.map((date) => (
              <DayCell
                key={date}
                date={date}
                inMonth={date >= range.start && date <= range.end}
                earnedCents={earnedByDate.get(date)}
                bestCents={bestCents}
                isToday={date === today}
                isOff={offDates.has(date)}
                locale={locale}
                onPick={onPick}
                onMenu={onMenu}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

interface CellProps {
  date: IsoDate
  inMonth: boolean
  earnedCents: number | undefined
  bestCents: number
  isToday: boolean
  isOff: boolean
  locale: Locale
  onPick: (date: IsoDate) => void
  onMenu: (date: IsoDate) => void
}

function DayCell({
  date,
  inMonth,
  earnedCents,
  bestCents,
  isToday,
  isOff,
  locale,
  onPick,
  onMenu,
}: CellProps) {
  const timer = useRef<number | null>(null)
  const longPressed = useRef(false)
  const [pressing, setPressing] = useState(false)

  function clearPress() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setPressing(false)
  }

  function startPress() {
    longPressed.current = false
    setPressing(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      longPressed.current = true
      onMenu(date)
    }, LONG_PRESS_MS)
  }

  function finishPress() {
    clearPress()
  }

  function choose() {
    if (longPressed.current) {
      longPressed.current = false
      return
    }
    onPick(date)
  }

  const step: ColorStep = inMonth && earnedCents !== undefined ? colorStep(earnedCents, bestCents) : 0
  const spoken = [
    formatDayLong(date, locale),
    earnedCents === undefined ? null : formatUsdShort(earnedCents),
    isOff ? t(locale, 'dayOff') : null,
  ]
    .filter(Boolean)
    .join(' \u00b7 ')

  return (
    <button
      type="button"
      aria-label={spoken}
      onClick={choose}
      onPointerDown={startPress}
      onPointerUp={finishPress}
      onPointerLeave={finishPress}
      onPointerCancel={finishPress}
      onContextMenu={(event) => event.preventDefault()}
      className={`flex min-h-16 flex-col items-center justify-start rounded-[10px] border-2 px-0.5 py-1 ${
        isToday ? 'border-brand-ink' : 'border-transparent'
      } ${
        inMonth
          ? `${STEP_CLASSES[step]} ${step === 4 ? 'text-white' : 'text-text'}`
          : 'bg-surface-subtle/40 text-text-muted'
      } ${pressing ? 'opacity-80' : ''}`}
    >
      <span className="text-[12px] font-bold leading-tight">{parseIsoDate(date).day}</span>
      {earnedCents !== undefined && earnedCents > 0 && (
        <span className="text-[10px] font-bold leading-tight">{formatUsdShort(earnedCents)}</span>
      )}
      {isOff && (
        <span className="mt-auto rounded-full bg-surface px-1 text-[10px] font-bold leading-tight text-text-secondary">
          {t(locale, 'dayOff')}
        </span>
      )}
    </button>
  )
}
