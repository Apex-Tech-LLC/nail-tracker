import { IconMicrophone, IconPlus, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import { LanguageButton } from '../../app/PageHeader.tsx'
import { paths } from '../../app/navigation.ts'
import { getSettings, updateSettings, useSettings } from '../../app/settings.ts'
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
  diffDays,
  formatDayLong,
  formatDayShort,
  formatMonthShort,
  formatRange,
  formatWeekdayLong,
  formatWeekdayShort,
  monthRange,
  parseIsoDate,
  timeOf,
  weekRange,
  type IsoDate,
} from '../../domain/dates.ts'
import { goalMessageKey, goalProgress, type GoalKind } from '../../domain/goals.ts'
import { openDay, workMinutes } from '../../domain/hours.ts'
import { formatUsd, formatUsdShort } from '../../domain/money.ts'
import { dueReminder } from '../../domain/reminders.ts'
import { nextTaxQuarter } from '../../domain/taxes.ts'
import { numberTurns, sumTotals } from '../../domain/totals.ts'
import { t, tf, type StringKey } from '../../lib/i18n.ts'
import { endLoad, startLoad } from '../../lib/loadMark.ts'
import { OfflineBadge } from '../../pwa/OfflineBadge.tsx'
import { list, primaryButton, secondaryButton } from '../../ui/styles.ts'
import { saveBackupFile } from '../backup/saveBackup.ts'
import { durationText } from '../hours/hoursText.ts'
import { HoursSheet } from '../hours/HoursSheet.tsx'
import { loadWorkDays, setWorkHours } from '../history/workDays.ts'
import { ensurePayPeriods, loadPeriodPresence, loadPeriodSummary } from '../payday/periodStore.ts'
import { loadRange, loadTurnDates, servicesByTurn } from '../turns/turnStore.ts'
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
  const {
    locale,
    weekStartDay,
    payPeriodType,
    payPeriodAnchorDate,
    backupReminderDays,
    lastBackupDate,
    dismissedReminders,
    weeklyGoalCents,
    monthlyGoalCents,
    taxSetAsideBp,
    hoursOn,
  } = useSettings()
  const today = useToday()
  const backupBusy = useRef(false)
  const [hoursOpen, setHoursOpen] = useState(false)
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
  // The quarter whose tax date is next, read with its own indexed range. On
  // January 1 to 15 this is September to December of the year before.
  const taxQuarter = nextTaxQuarter(today)
  const taxStart = taxQuarter?.start ?? today
  const taxEnd = taxQuarter?.end ?? today

  useEffect(() => {
    void ensurePayPeriods(
      db,
      { type: payPeriodType, anchor: payPeriodAnchorDate },
      today,
    )
  }, [payPeriodType, payPeriodAnchorDate, today])

  const data = useLiveQuery(async () => {
    startLoad('load:home')
    const [current, previousData, todayData, weekData, firstTurn, taxData, workDays, presence] =
      await Promise.all([
        loadTurnDates(db, span.start, span.end),
        loadTurnDates(db, previous.start, previous.end),
        loadRange(db, today, today),
        loadTurnDates(db, weekLoadStart, week.end),
        db.turns.orderBy('localWorkDate').first(),
        loadTurnDates(db, taxStart, taxEnd),
        loadWorkDays(db, addDays(today, -1), today),
        loadPeriodPresence(db),
      ])
    // Only the period being worked in needs its statement; the rest of the
    // list only answers "has turns, was it checked".
    const currentPresence = presence.find(
      (item) => item.period.startDate <= today && today <= item.period.endDate,
    )
    const currentPayPeriod = currentPresence
      ? await loadPeriodSummary(db, currentPresence.period.id)
      : null
    endLoad('load:home')
    return {
      current,
      previousData,
      todayData,
      weekData,
      firstTurn,
      taxData,
      workDays,
      presence,
      currentPayPeriod,
    }
  }, [
    span.start,
    span.end,
    previous.start,
    previous.end,
    today,
    weekLoadStart,
    week.end,
    taxStart,
    taxEnd,
  ])

  if (data === undefined) return null

  const reminder = dueReminder({
    today,
    hasTurns: data.firstTurn !== undefined,
    backupReminderDays,
    lastBackupDate,
    firstTurnDate: data.firstTurn?.localWorkDate ?? null,
    dismissed: dismissedReminders,
    paycheckPeriods: data.presence.map((item) => ({
      id: item.period.id,
      startDate: item.period.startDate,
      endDate: item.period.endDate,
      hasTurns: item.statementTurns > 0,
      checkedDate: item.checkedDate,
    })),
    taxSetAsideBp,
    taxDue:
      taxQuarter === null
        ? null
        : {
            dueDate: taxQuarter.dueDate,
            start: taxQuarter.start,
            end: taxQuarter.end,
            earnedCents: sumTotals(data.taxData.turns, data.taxData.adjustments).earnedCents,
          },
  })
  const reminderStart = lastBackupDate ?? data.firstTurn?.localWorkDate ?? null
  const reminderDays = reminderStart === null ? 0 : diffDays(today, reminderStart)

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

  const currentPayPeriod = data.currentPayPeriod
  // "Salon owes" is what the statement says the salon should pay, less what it
  // has already paid: a paid period owes nothing.
  const salonOwesCents = currentPayPeriod
    ? Math.max(0, currentPayPeriod.statement.salonPaysCents - currentPayPeriod.paidCents)
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

  const openWorkDay = openDay(data.workDays, today)
  const todayDay = data.workDays.find((workDay) => workDay.date === today) ?? null
  const todayHours =
    todayDay !== null && todayDay.startTime !== null && todayDay.endTime !== null
      ? { start: todayDay.startTime, end: todayDay.endTime }
      : null

  function choosePeriod(next: HomePeriod) {
    setStoredPeriod({ key: periodKey, period: next })
    try {
      sessionStorage.setItem(periodKey, next)
    } catch {
      // Not remembered, but still applied for this visit.
    }
  }

  async function backUpNow() {
    if (backupBusy.current) return
    backupBusy.current = true
    try {
      await saveBackupFile(t(locale, 'exportBackup'))
    } finally {
      backupBusy.current = false
    }
  }

  function dismissReminder(key: string) {
    updateSettings({ dismissedReminders: { ...dismissedReminders, [key]: today } })
  }

  async function startDay() {
    await setWorkHours(db, today, timeOf(Date.now()), null)
  }

  async function endDay(day: { date: IsoDate; startTime: string | null }) {
    if (day.startTime === null) return
    await setWorkHours(db, day.date, day.startTime, timeOf(Date.now()))
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

      {reminder !== null && (
        <section className="flex items-start gap-2 rounded-card border border-border bg-surface p-3">
          <div className="min-w-0 flex-1">
            {reminder.id === 'paycheck' && reminder.periodId ? (
              <>
                <p className="text-sm">
                  {tf(locale, 'reminderPaycheckEnded', {
                    range: formatRange(reminder.startDate ?? '', reminder.endDate ?? '', locale),
                  })}
                </p>
                <Link
                  href={paths.period(reminder.periodId)}
                  className="mt-2 inline-flex min-h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white"
                >
                  {t(locale, 'checkNow')}
                </Link>
              </>
            ) : reminder.id === 'tax' && reminder.dueDate && reminder.quarter ? (
              <>
                <p data-testid="tax-reminder" className="text-sm">
                  {tf(locale, 'reminderTaxDue', {
                    date: formatDayShort(reminder.dueDate, locale),
                    amount: formatUsdShort(reminder.amountCents ?? 0),
                    quarter: `${formatMonthShort(reminder.quarter.start, locale)}–${formatMonthShort(
                      reminder.quarter.end,
                      locale,
                    )}`,
                  })}
                </p>
                <Link
                  href={paths.taxes(parseIsoDate(reminder.quarter.start).year)}
                  className="mt-2 inline-flex min-h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white"
                >
                  {t(locale, 'taxes')}
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm">
                  {lastBackupDate === null
                    ? t(locale, 'reminderNoBackup')
                    : tf(locale, 'reminderBackupOverdue', { n: reminderDays })}
                </p>
                <button
                  type="button"
                  onClick={backUpNow}
                  className="mt-2 min-h-11 rounded-control bg-brand-600 px-4 text-sm font-semibold text-white"
                >
                  {t(locale, 'backUpNow')}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            aria-label={t(locale, 'dismiss')}
            onClick={() => dismissReminder(reminder.key)}
            className="-mr-1 -mt-1 flex size-11 flex-none items-center justify-center rounded-control text-text-secondary"
          >
            <IconX size={18} aria-hidden="true" />
          </button>
        </section>
      )}

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
        {period !== 'today' && (
          <GoalBar
            kind={period}
            earnedCents={totals.earnedCents}
            goalCents={period === 'week' ? weeklyGoalCents : monthlyGoalCents}
            periodStart={period === 'week' ? week.start : monthRange(today).start}
            today={today}
          />
        )}
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
                      ? 'border-2 border-brand-ink'
                      : 'border-[1.5px] border-border-strong'
                  }`}
                >
                  <span
                    className={`week-fill absolute inset-x-0 bottom-0 ${
                      day.isFuture
                        ? 'bg-bottle-future'
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
                  day.isToday ? 'text-brand-ink' : 'text-text-muted'
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
          <span aria-hidden="true" className="mr-1 inline-block h-[9px] w-[9px] rounded-[3px] bg-bottle-future" />
          {t(locale, 'homeLastWeekLegend')}
        </span>
      </div>

      <div className="grid grid-cols-3 overflow-hidden rounded-card border border-border bg-surface">
        <Stat value={String(totals.turns)} label={t(locale, 'turns')} edge={false} />
        <Stat value={formatUsdShort(totals.tipsCents)} label={t(locale, 'homeTips')} edge />
        <Stat value={formatUsdShort(salonOwesCents)} label={t(locale, 'homeSalonOwes')} edge />
      </div>

      {currentPayPeriod?.statement.checkCents != null && (
        <p className="mt-2 text-sm text-text-secondary">
          {tf(locale, 'homeCheckCashLine', {
            check: formatUsdShort(currentPayPeriod.statement.checkCents),
            cash: formatUsdShort(currentPayPeriod.statement.cashCents ?? 0),
          })}
        </p>
      )}

      {hoursOn && period === 'today' && (
        <section>
          {openWorkDay !== null && openWorkDay.startTime !== null ? (
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                void endDay({ date: openWorkDay.date, startTime: openWorkDay.startTime })
              }}
            >
              {t(locale, 'endDay')}
            </button>
          ) : todayHours !== null ? (
            <div className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface px-4 py-2">
              <p className="text-sm">
                <span className="text-text-secondary">{t(locale, 'hoursTitle')}</span>{' '}
                <b>{durationText(locale, workMinutes(todayHours.start, todayHours.end))}</b>
              </p>
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-control px-3 text-sm font-semibold text-brand-ink underline"
                onClick={() => setHoursOpen(true)}
              >
                {t(locale, 'edit')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                void startDay()
              }}
            >
              {t(locale, 'startDay')}
            </button>
          )}
        </section>
      )}

      {hoursOpen && (
        <HoursSheet
          date={today}
          startTime={todayDay?.startTime ?? null}
          endTime={todayDay?.endTime ?? null}
          suggestion={null}
          onClose={() => setHoursOpen(false)}
        />
      )}

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
              className="text-sm font-semibold text-brand-ink underline"
            >
              {t(locale, 'seeAll')}
            </Link>
          </>
        )}
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40">
        <div className="mx-auto flex max-w-md gap-2.5 px-[18px]">
          <Link
            href={paths.add}
            className={`${primaryButton} pointer-events-auto flex min-h-[58px] flex-1 items-center justify-center gap-2.5`}
          >
            <IconPlus size={20} aria-hidden="true" />
            {t(locale, 'addTurn')}
          </Link>
          <Link
            href={paths.say}
            className={`${secondaryButton} pointer-events-auto flex min-h-[58px] flex-1 items-center justify-center gap-2`}
          >
            <IconMicrophone size={20} aria-hidden="true" />
            {t(locale, 'sayYourTurns')}
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

/**
 * The slim goal bar under the hero. A met goal says so once per period: the
 * key is written in dismissedReminders the first time it is shown, so leaving
 * Home and coming back does not repeat it.
 */
function GoalBar({
  kind,
  earnedCents,
  goalCents,
  periodStart,
  today,
}: {
  kind: GoalKind
  earnedCents: number
  goalCents: number | null
  periodStart: IsoDate
  today: IsoDate
}) {
  const { locale, dismissedReminders } = useSettings()
  const [messageHidden, setMessageHidden] = useState(false)
  // What was already dismissed when the bar appeared, held still for this visit.
  const [dismissedAtMount] = useState(dismissedReminders)

  const progress = goalCents === null ? null : goalProgress(earnedCents, goalCents)
  const messageKey =
    goalCents !== null && earnedCents >= goalCents ? goalMessageKey(kind, periodStart) : null
  const showMessage =
    messageKey !== null && dismissedAtMount[messageKey] === undefined && !messageHidden

  useEffect(() => {
    if (!showMessage || messageKey === null) return
    updateSettings({
      dismissedReminders: { ...getSettings().dismissedReminders, [messageKey]: today },
    })
  }, [showMessage, messageKey, today])

  if (goalCents === null || progress === null) {
    return (
      <Link
        href={paths.goals}
        className="mt-3 inline-block text-sm font-semibold text-brand-ink underline"
      >
        {t(locale, 'setAGoal')}
      </Link>
    )
  }

  const met = earnedCents >= goalCents
  return (
    <div className="mt-3">
      <Link
        href={paths.goals}
        data-testid="goal-progress"
        data-fill={progress.fillPercent}
        className="block rounded-control focus-visible:outline-2 focus-visible:outline-brand-ink"
      >
        <span className="block h-2 overflow-hidden rounded-full bg-surface-subtle">
          <span
            data-testid="goal-fill"
            className="block h-full rounded-full bg-brand-600"
            style={{ width: `${progress.fillPercent}%` }}
          />
        </span>
        <span
          data-testid="goal-progress-text"
          className="mt-1.5 block text-sm text-text-secondary"
        >
          {met
            ? tf(locale, 'goalReached', {
                earned: formatUsdShort(earnedCents),
                goal: formatUsdShort(goalCents),
              })
            : tf(locale, 'goalProgress', {
                earned: formatUsdShort(earnedCents),
                goal: formatUsdShort(goalCents),
                toGo: formatUsdShort(progress.toGoCents),
              })}
        </span>
      </Link>

      {showMessage && (
        <div className="mt-2 flex items-start gap-2 rounded-control bg-positive-bg p-2">
          <p className="min-w-0 flex-1 text-sm text-positive-text">
            {t(locale, kind === 'week' ? 'goalHitWeek' : 'goalHitMonth')}
          </p>
          <button
            type="button"
            aria-label={t(locale, 'dismiss')}
            onClick={() => setMessageHidden(true)}
            className="-mr-1 -mt-1 flex size-9 flex-none items-center justify-center text-positive-text"
          >
            <IconX size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label, edge }: { value: string; label: string; edge: boolean }) {
  return (
    <div className={`px-3 py-3 ${edge ? 'border-l border-border' : ''}`}>
      <b className="block text-[18px] font-bold">{value}</b>
      <span className="text-[12px] text-text-muted">{label}</span>
    </div>
  )
}
