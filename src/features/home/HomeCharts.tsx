import type { ReactNode } from 'react'
import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { dayLabels, shortClock } from '../../domain/chartLabels.ts'
import { fillPercent, type WeekDay } from '../../domain/comparisons.ts'
import {
  formatDayLong,
  formatWeekdayLong,
  monthRange,
  type DateLocale,
  type IsoDate,
} from '../../domain/dates.ts'
import { formatUsdShort, formatUsdWhole } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import { calendarWeeks, colorStep, type ColorStep } from '../history/calendar.ts'

const MAX_TURN_BARS = 8

const STEP_CLASSES: Record<ColorStep, string> = {
  0: 'bg-surface',
  1: 'bg-brand-50',
  2: 'bg-brand-100',
  3: 'bg-brand-200',
  4: 'bg-brand-400',
}

/** The one box under the hero. It is the same height for every period, so nothing below it moves. */
export function ChartBox({
  testId,
  title,
  hint,
  footer,
  children,
}: {
  testId: string
  title: string
  hint: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      data-testid={testId}
      className="flex h-[312px] flex-none flex-col rounded-card border border-border bg-surface px-2.5 pb-2 pt-2.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-text-secondary">
          {title}
        </p>
        <p className="shrink-0 text-[11px] text-text-muted">{hint}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {footer !== undefined && (
        <div className="flex items-center gap-3 border-t border-border pt-1.5 text-[12px] text-text-muted">
          {footer}
        </div>
      )}
    </section>
  )
}

/** What a day's glass measures: this week's fill, or last week's when the day is still ahead. */
function bottleCents(day: WeekDay): number {
  return day.isFuture ? day.lastWeekEarnedCents : day.earnedCents
}

export function WeekBottles({
  days,
  locale,
  listLabel,
}: {
  days: readonly WeekDay[]
  locale: DateLocale
  listLabel: string
}) {
  const max = Math.max(0, ...days.map((day) => Math.max(day.earnedCents, day.lastWeekEarnedCents)))

  return (
    <ul aria-label={listLabel} className="grid flex-1 grid-cols-7 items-end gap-1 pt-1.5">
      {days.map((day) => {
        const labels = dayLabels(day.date, locale)
        return (
          <li key={day.date} className="flex h-full items-end justify-center">
            <Link
              data-testid="week-bottle"
              href={paths.historyDay(day.date)}
              className="flex min-h-11 flex-col items-center justify-end gap-1"
            >
              {/* The visible amount and weekday read as one name for assistive tech. */}
              <span className="sr-only">
                {day.isFuture
                  ? tf(locale, 'homeDayLastWeek', {
                      weekday: formatWeekdayLong(day.date, locale),
                      amount: formatUsdShort(day.lastWeekEarnedCents),
                    })
                  : tf(locale, 'homeDayEarned', {
                      weekday: formatWeekdayLong(day.date, locale),
                      amount: formatUsdShort(day.earnedCents),
                    })}
              </span>
              <span aria-hidden="true" className="min-h-4 text-[11px] font-semibold text-text-secondary">
                {day.isFuture ? '' : formatUsdWhole(day.earnedCents)}
              </span>
              <span aria-hidden="true" className="flex flex-col items-center">
                <span className="h-3.5 w-3.5 rounded-[4px_4px_2px_2px] bg-text" />
                <span
                  className={`relative block h-[116px] w-[30px] overflow-hidden rounded-[10px_10px_12px_12px] bg-surface ${
                    day.isToday ? 'border-2 border-brand-ink' : 'border-[1.5px] border-border-strong'
                  }`}
                >
                  <span
                    className={`week-fill absolute inset-x-0 bottom-0 ${
                      day.isFuture
                        ? 'bg-bottle-future'
                        : 'bg-gradient-to-b from-brand-400 via-brand-600 to-brand-800'
                    }`}
                    style={{ height: `${fillPercent(bottleCents(day), max)}%` }}
                  >
                    {!day.isFuture && (
                      <span className="absolute bottom-1.5 left-[5px] top-1.5 w-1 rounded-sm bg-white/35" />
                    )}
                  </span>
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`flex flex-col items-center leading-tight ${
                  day.isToday ? 'text-brand-ink' : 'text-text-muted'
                }`}
              >
                <span className="text-[12px] font-semibold">{labels.weekday}</span>
                <span className="text-[11px]">{labels.date}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Swatch({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`mr-1 inline-block h-[9px] w-[9px] rounded-[3px] ${className}`}
    />
  )
}

export function WeekLegend({ locale }: { locale: DateLocale }) {
  return (
    <>
      <span>
        <Swatch className="bg-brand-600" />
        {t(locale, 'homeThisWeekLegend')}
      </span>
      <span>
        <Swatch className="bg-bottle-future" />
        {t(locale, 'homeLastWeekLegend')}
      </span>
    </>
  )
}

export function TodayLegend({ locale }: { locale: DateLocale }) {
  return (
    <>
      <span>
        <Swatch className="bg-brand-600" />
        {t(locale, 'commission')}
      </span>
      <span>
        <Swatch className="bg-positive-text" />
        {t(locale, 'homeTips')}
      </span>
    </>
  )
}

/** The current month: each worked day's whole dollars, darker for bigger days. */
export function MonthGrid({
  today,
  weekStart,
  locale,
  earnedByDate,
  offDates,
}: {
  today: IsoDate
  weekStart: 0 | 1
  locale: DateLocale
  earnedByDate: ReadonlyMap<IsoDate, number>
  offDates: ReadonlySet<IsoDate>
}) {
  const weeks = calendarWeeks(today, weekStart)
  const range = monthRange(today)
  const best = Math.max(0, ...earnedByDate.values())

  return (
    <div className="flex flex-1 flex-col pt-1">
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10.5px] font-bold text-text-muted">
        {(weeks[0] ?? []).map((date) => (
          <span key={date}>{dayLabels(date, locale).weekday}</span>
        ))}
      </div>
      <div
        className="mt-0.5 grid flex-1 grid-cols-7 gap-0.5"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(40px, 1fr))` }}
      >
        {weeks.flat().map((date) => {
          if (date < range.start || date > range.end) return <div key={date} aria-hidden="true" />

          const earned = earnedByDate.get(date) ?? 0
          const isOff = offDates.has(date)
          const isFuture = date > today
          const quiet = isOff || isFuture
          const step: ColorStep = quiet ? 0 : colorStep(earned, best)
          const spoken = [
            formatDayLong(date, locale),
            earned === 0 ? null : formatUsdShort(earned),
            isOff ? t(locale, 'dayOff') : null,
          ]
            .filter(Boolean)
            .join(' · ')

          return (
            <Link
              key={date}
              data-testid="month-day"
              href={paths.historyDay(date)}
              className={`flex flex-col justify-between rounded-md border-2 px-1 py-0.5 tabular-nums ${
                date === today ? 'border-brand-ink' : 'border-transparent'
              } ${
                quiet
                  ? 'bg-surface-subtle text-text-muted'
                  : `${STEP_CLASSES[step]} ${step === 4 ? 'text-white' : 'text-text'}`
              }`}
            >
              <span className="sr-only">{spoken}</span>
              <span aria-hidden="true" className="text-[11px] font-semibold leading-none">
                {Number(date.slice(8))}
              </span>
              <span aria-hidden="true" className="min-h-3 text-right text-[10px] font-bold leading-none">
                {isOff ? t(locale, 'dayOff') : !isFuture && earned !== 0 ? formatUsdWhole(earned) : ''}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export interface TurnBar {
  id: string
  number: number | null
  occurredAt: number
  commissionCents: number
  tipCents: number
}

/** Today's turns in time order, commission and tip stacked; the turns past eight fold into one +n bar. */
export function TodayBars({
  bars,
  today,
  locale,
}: {
  bars: readonly TurnBar[]
  today: IsoDate
  locale: DateLocale
}) {
  if (bars.length === 0) {
    return (
      <p
        data-testid="today-empty"
        className="m-auto px-6 text-center text-[15px] text-text-secondary"
      >
        {t(locale, 'chartEmptyToday')}
      </p>
    )
  }

  const shown = bars.slice(0, MAX_TURN_BARS)
  const rest = bars.slice(MAX_TURN_BARS)
  const restCents = rest.reduce((sum, bar) => sum + bar.commissionCents + bar.tipCents, 0)
  const max = Math.max(...shown.map((bar) => bar.commissionCents + bar.tipCents))
  const columns = Math.max(6, shown.length + (rest.length > 0 ? 1 : 0))

  return (
    <div
      className="grid flex-1 items-end gap-1.5 pt-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {shown.map((bar) => {
        const total = bar.commissionCents + bar.tipCents
        const time = shortClock(bar.occurredAt, locale)
        return (
          <Link
            key={bar.id}
            data-testid="turn-bar"
            href={paths.edit(bar.id)}
            className="flex min-h-11 flex-col items-center justify-end gap-0.5"
          >
            <span className="sr-only">
              {bar.number === null
                ? tf(locale, 'chartBarNoNumber', { amount: formatUsdShort(total), time })
                : tf(locale, 'chartTurnBar', {
                    n: bar.number,
                    amount: formatUsdShort(total),
                    time,
                  })}
            </span>
            <span aria-hidden="true" className="text-[11px] font-bold">
              {formatUsdWhole(total)}
            </span>
            <span
              aria-hidden="true"
              className="flex h-[150px] w-full max-w-9 flex-col justify-end overflow-hidden rounded-[7px] border-[1.5px] border-border-strong bg-surface-subtle"
            >
              <span
                className="block w-full bg-positive-text"
                style={{ height: `${fillPercent(bar.tipCents, max)}%` }}
              />
              <span
                className="block w-full bg-gradient-to-t from-brand-600 to-brand-400"
                style={{ height: `${fillPercent(bar.commissionCents, max)}%` }}
              />
            </span>
            <span aria-hidden="true" className="text-[11px] font-bold leading-tight text-text-secondary">
              {bar.number === null ? '–' : `#${bar.number}`}
            </span>
            <span aria-hidden="true" className="text-[10px] leading-tight text-text-muted">
              {time}
            </span>
          </Link>
        )
      })}
      {rest.length > 0 && (
        <Link
          data-testid="turn-bar-more"
          href={paths.historyDay(today)}
          className="flex min-h-11 flex-col items-center justify-end gap-0.5"
        >
          <span className="sr-only">
            {tf(locale, 'chartMoreTurns', { n: rest.length, amount: formatUsdShort(restCents) })}
          </span>
          <span aria-hidden="true" className="text-[11px] font-bold text-brand-ink">
            {formatUsdWhole(restCents)}
          </span>
          <span
            aria-hidden="true"
            className="block h-[150px] w-full max-w-9 rounded-[7px] border-[1.5px] border-dashed border-brand-ink"
          />
          <span aria-hidden="true" className="text-[11px] font-bold leading-tight text-brand-ink">
            +{rest.length}
          </span>
          <span aria-hidden="true" className="text-[10px] leading-tight text-text-muted">
            {t(locale, 'chartMore')}
          </span>
        </Link>
      )}
    </div>
  )
}
