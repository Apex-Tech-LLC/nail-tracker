import { IconPlus } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { LanguageButton } from '../../app/PageHeader.tsx'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db } from '../../db/schema.ts'
import {
  compare,
  currentSpan,
  fillPercent,
  previousSpan,
  weekDays,
  type HomePeriod,
  type WeekDay,
} from '../../domain/comparisons.ts'
import {
  addDays,
  formatDayLong,
  formatWeekdayLong,
  formatWeekdayShort,
  weekRange,
  type IsoDate,
} from '../../domain/dates.ts'
import { formatUsd, formatUsdShort } from '../../domain/money.ts'
import { numberTurns, sumTotals } from '../../domain/totals.ts'
import { t, tf, type StringKey } from '../../lib/i18n.ts'
import { OfflineBadge } from '../../pwa/OfflineBadge.tsx'
import { list, primaryButton } from '../../ui/styles.ts'
import { ensurePayPeriods, loadPeriodSummaries } from '../payday/periodStore.ts'
import { loadRange, servicesByTurn } from '../turns/turnStore.ts'
import { TurnRow } from '../turns/TurnRow.tsx'

const RECENT_LIMIT = 10
const PERIOD_KEY = 'nail-tracker.home-period'

const PERIOD_KEYS: Record<HomePeriod, StringKey> = {
  today: 'homePeriodToday',
  week: 'homePeriodThisWeek',
  month: 'homePeriodThisMonth',
}

const EARNED_KEYS: Record<HomePeriod, StringKey> = {
  today: 'homeEarnedToday',
  week: 'homeEarnedThisWeek',
  month: 'homeEarnedThisMonth',
}

const COMPARISON_KEYS: Record<
  HomePeriod,
  Record<'more' | 'less' | 'same', StringKey>
> = {
  today: { more: 'homeMoreToday', less: 'homeLessToday', same: 'homeSameToday' },
  week: { more: 'homeMoreThisWeek', less: 'homeLessThisWeek', same: 'homeSameThisWeek' },
  month: { more: 'homeMoreThisMonth', less: 'homeLessThisMonth', same: 'homeSameThisMonth' },
}

const PERIODS: HomePeriod[] = ['today', 'week', 'month']

function readStoredPeriod(key: string): HomePeriod {
  try {
    const saved = sessionStorage.getItem(key)
    if (saved === 'today' || saved === 'week' || saved === 'month') return saved
  } catch {
    // Storage can be blocked; today is always a safe start.
  }
  return 'today'
}

/** $1,284.50 becomes ['$1,284', '.50'], so the cents can sit smaller on the hero. */
function splitMoney(text: string): [string, string] {
  const dot = text.lastIndexOf('.')
  return dot === -1 ? [text, ''] : [text.slice(0, dot), text.slice(dot)]
}

/** One day's earned money plus its adjustment, keyed by work date. */
function earnedByDate(
  turns: readonly { localWorkDate: IsoDate; earnedTotalCents: number }[],
  adjustments: readonly { localWorkDate: IsoDate; amountCents: number }[],
): Map<IsoDate, number> {
  const earned = new Map<IsoDate, number>()
  const add = (date: IsoDate, cents: number) =>
    earned.set(date, (earned.get(date) ?? 0) + cents)

  for (const turn of turns) add(turn.localWorkDate, turn.earnedTotalCents)
  for (const adjustment of adjustments) add(adjustment.localWorkDate, adjustment.amountCents)
  return earned
}

export function HomePage() {
  const { locale, weekStartDay, payPeriodType, payPeriodAnchorDate } = useSettings()
  const today = useToday()
  const periodKey = `${PERIOD_KEY}.${today}`
  // The choice is remembered for the day; a new day's key starts on Today.
  const [storedPeriod, setStoredPeriod] = useState(() => ({
    key: periodKey,
    period: readStoredPeriod(periodKey),
  }))
  const period =
    storedPeriod.key === periodKey ? storedPeriod.period : readStoredPeriod(periodKey)

  const span = currentSpan(period, today, weekStartDay)
  const previous = previousSpan(period, today, weekStartDay)
  const week = weekRange(today, weekStartDay)
  // Last week and this week together, so future bottles can show last week's fill.
  const weekLoadStart = addDays(week.start, -7)

  useEffect(() => {
    void ensurePayPeriods(
      db,
      { type: payPeriodType, anchor: payPeriodAnchorDate },
      today,
    )
  }, [payPeriodType, payPeriodAnchorDate, today])

  const data = useLiveQuery(async () => {
    const [current, previousData, todayData, weekData] = await Promise.all([
      loadRange(db, span.start, span.end),
      loadRange(db, previous.start, previous.end),
      loadRange(db, today, today),
      loadRange(db, weekLoadStart, week.end),
    ])
    return { current, previousData, todayData, weekData }
  }, [span.start, span.end, previous.start, previous.end, today, weekLoadStart, week.end])

  const summaries = useLiveQuery(() => loadPeriodSummaries(db))

  if (data === undefined || summaries === undefined) return null

  const totals = sumTotals(data.current.turns, data.current.adjustments)
  const previousTotals = sumTotals(data.previousData.turns, data.previousData.adjustments)
  const comparison = compare(
    totals.earnedCents,
    previousTotals.earnedCents,
    data.previousData.turns.length,
  )

  const [earnedWhole, earnedCents] = splitMoney(formatUsd(totals.earnedCents))
  const previousWeekday = formatWeekdayLong(previous.start, locale)

  let comparisonText: string
  if (comparison.kind === 'nothingToCompare') {
    comparisonText = t(locale, 'homeNothingToCompare')
  } else if (comparison.kind === 'more' || comparison.kind === 'less') {
    comparisonText = tf(locale, COMPARISON_KEYS[period][comparison.kind], {
      amount: formatUsdShort(comparison.differenceCents),
      weekday: previousWeekday,
    })
  } else {
    comparisonText = tf(locale, COMPARISON_KEYS[period].same, {
      weekday: previousWeekday,
    })
  }

  const days = weekDays(
    today,
    weekStartDay,
    earnedByDate(data.weekData.turns, data.weekData.adjustments),
  )
  const weekMax = Math.max(
    0,
    ...days.map((day) => Math.max(day.earnedCents, day.lastWeekEarnedCents)),
  )

  const currentPayPeriod = summaries.find(
    (summary) => summary.period.startDate <= today && today <= summary.period.endDate,
  )
  // The same figure the Payday tab shows for the current period.
  const salonOwesCents = currentPayPeriod
    ? currentPayPeriod.state === 'empty' || currentPayPeriod.state === 'paid'
      ? currentPayPeriod.totals.expectedPayoutCents
      : Math.abs(currentPayPeriod.outstandingCents)
    : totals.expectedPayoutCents

  const todayTotals = sumTotals(data.todayData.turns, data.todayData.adjustments)
  const todayGroups = servicesByTurn(data.todayData.services)
  const todayNumbers = numberTurns(data.todayData.turns)
  const todayTurns = [...data.todayData.turns]
    .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt)
    .slice(0, RECENT_LIMIT)
  const todayCountText = tf(
    locale,
    todayTotals.turns === 1 ? 'dayTurnCountOne' : 'dayTurnCount',
    { n: todayTotals.turns },
  )

  function choosePeriod(next: HomePeriod) {
    setStoredPeriod({ key: periodKey, period: next })
    try {
      sessionStorage.setItem(periodKey, next)
    } catch {
      // Not remembered, but still applied for this visit.
    }
  }

  return (
    <>
      <h1 className="sr-only">{t(locale, 'appName')}</h1>

      <header className="flex items-center justify-between gap-2">
        <p className="text-[15px] text-text-secondary">{formatDayLong(today, locale)}</p>
        <div className="flex shrink-0 items-center gap-2">
          <OfflineBadge />
          <LanguageButton />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-1 rounded-control bg-surface-subtle p-[3px]">
        {PERIODS.map((option) => {
          const on = option === period
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => choosePeriod(option)}
              className={`min-h-11 rounded-[9px] px-1 text-sm font-semibold ${
                on
                  ? 'bg-surface text-text shadow-[0_1px_2px_rgb(29_24_34/0.12)]'
                  : 'text-text-secondary'
              }`}
            >
              {t(locale, PERIOD_KEYS[option])}
            </button>
          )
        })}
      </div>

      <section className="mt-[18px]">
        <p className="text-[15px] text-text-secondary">{t(locale, EARNED_KEYS[period])}</p>
        <p
          data-testid="hero-earned"
          className="mt-0.5 text-[52px] font-extrabold leading-[1.05] tracking-[-0.035em]"
        >
          {earnedWhole}
          <span className="text-[28px] font-bold text-text-muted">{earnedCents}</span>
        </p>
        <p
          className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] text-sm font-semibold ${
            comparison.kind === 'more'
              ? 'bg-positive-bg text-positive-text'
              : 'bg-surface-subtle text-text-secondary'
          }`}
        >
          {comparisonText}
        </p>
      </section>

      <ul
        aria-label={t(locale, 'homeWeekList')}
        className="mt-5 grid h-[150px] grid-cols-7 items-end gap-2"
      >
        {days.map((day) => (
          <li key={day.date} className="flex h-full items-end justify-center">
            <Link
              data-testid="week-bottle"
              href={paths.historyDay(day.date)}
              className="flex min-h-11 flex-col items-center justify-end gap-1.5"
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
                {day.isFuture ? '' : formatUsdShort(day.earnedCents)}
              </span>
              <span aria-hidden="true" className="flex flex-col items-center">
                <span className="h-3.5 w-3.5 rounded-[4px_4px_2px_2px] bg-text" />
                <span
                  className={`relative block h-[100px] w-[30px] overflow-hidden rounded-[10px_10px_12px_12px] bg-surface ${
                    day.isToday
                      ? 'border-2 border-brand-600'
                      : 'border-[1.5px] border-border-strong'
                  }`}
                >
                  <span
                    className={`week-fill absolute inset-x-0 bottom-0 ${
                      day.isFuture
                        ? 'bg-[#ecd9d1]'
                        : 'bg-gradient-to-b from-brand-400 via-brand-600 to-brand-800'
                    }`}
                    style={{ height: `${fillPercent(bottleCents(day), weekMax)}%` }}
                  >
                    {!day.isFuture && (
                      <span className="absolute bottom-1.5 left-[5px] top-1.5 w-1 rounded-sm bg-white/35" />
                    )}
                  </span>
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`text-[12px] font-semibold ${
                  day.isToday ? 'text-brand-600' : 'text-text-muted'
                }`}
              >
                {formatWeekdayShort(day.date, locale)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-[14px] text-[12px] text-text-muted">
        <span>
          <span aria-hidden="true" className="mr-1 inline-block h-[9px] w-[9px] rounded-[3px] bg-brand-600" />
          {t(locale, 'homeThisWeekLegend')}
        </span>
        <span>
          <span aria-hidden="true" className="mr-1 inline-block h-[9px] w-[9px] rounded-[3px] bg-[#ecd9d1]" />
          {t(locale, 'homeLastWeekLegend')}
        </span>
      </div>

      <div className="grid grid-cols-3 overflow-hidden rounded-card border border-border bg-surface">
        <Stat value={String(totals.turns)} label={t(locale, 'turns')} edge={false} />
        <Stat value={formatUsdShort(totals.tipsCents)} label={t(locale, 'homeTips')} edge />
        <Stat value={formatUsdShort(salonOwesCents)} label={t(locale, 'homeSalonOwes')} edge />
      </div>

      <section className="flex flex-col gap-2 pb-16">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-bold">{t(locale, 'homeTodayTurns')}</h2>
          {data.todayData.turns.length > 0 && (
            <p className="shrink-0 text-sm font-semibold text-text-secondary">
              {todayCountText} · {formatUsdShort(todayTotals.earnedCents)}
            </p>
          )}
        </div>

        {todayTurns.length === 0 ? (
          <p className="text-text-secondary">{t(locale, 'homeEmptyTurns')}</p>
        ) : (
          <>
            <div className={list}>
              {todayTurns.map((turn) => (
                <TurnRow
                  key={turn.id}
                  turn={turn}
                  services={todayGroups.get(turn.id) ?? []}
                  number={todayNumbers.get(turn.id) ?? null}
                />
              ))}
            </div>
            <Link
              href={paths.history}
              className="text-sm font-semibold text-brand-600 underline"
            >
              {t(locale, 'seeAll')}
            </Link>
          </>
        )}
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40">
        <div className="mx-auto max-w-md px-[18px]">
          <Link
            href={paths.add}
            className={`${primaryButton} pointer-events-auto flex min-h-[58px] items-center justify-center gap-2.5`}
          >
            <IconPlus size={20} aria-hidden="true" />
            {t(locale, 'addTurn')}
          </Link>
        </div>
      </div>
    </>
  )
}

/** What a day's glass measures: this week's fill, or last week's when the day is still ahead. */
function bottleCents(day: WeekDay): number {
  return day.isFuture ? day.lastWeekEarnedCents : day.earnedCents
}

function Stat({ value, label, edge }: { value: string; label: string; edge: boolean }) {
  return (
    <div className={`px-3 py-3 ${edge ? 'border-l border-border' : ''}`}>
      <b className="block text-[18px] font-bold">{value}</b>
      <span className="text-[12px] text-text-muted">{label}</span>
    </div>
  )
}
