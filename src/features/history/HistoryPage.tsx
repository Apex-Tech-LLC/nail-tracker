import { IconDots, IconFilter, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { PageHeader } from '../../app/PageHeader.tsx'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db, type TurnService } from '../../db/schema.ts'
import {
  formatDayLong,
  isIsoDate,
  monthRange,
  monthShift,
  type IsoDate,
} from '../../domain/dates.ts'
import { formatUsdShort } from '../../domain/money.ts'
import { suggestionForDay } from '../../domain/hours.ts'
import { numberTurns, sumTotals } from '../../domain/totals.ts'
import { t, tf, type StringKey } from '../../lib/i18n.ts'
import { endLoad, startLoad } from '../../lib/loadMark.ts'
import {
  chip,
  chipOff,
  chipOn,
  errorText,
  field,
  label,
  list,
  secondaryButton,
} from '../../ui/styles.ts'
import { useToast } from '../../ui/useToast.ts'
import { AdjustmentRow } from '../adjustments/AdjustmentRow.tsx'
import { dayHoursText } from '../hours/hoursText.ts'
import { HoursSheet } from '../hours/HoursSheet.tsx'
import { loadRange, servicesByTurn } from '../turns/turnStore.ts'
import { TurnRow } from '../turns/TurnRow.tsx'
import { CalendarView } from './CalendarView.tsx'
import { DayOffSheet } from './DayOffSheet.tsx'
import { FilterSheet } from './FilterSheet.tsx'
import {
  groupByDay,
  hasFilters,
  matchesFilters,
  matchesSearch,
  NO_FILTERS,
  rangeFor,
  serviceNames,
  topServiceNames,
  type Filters,
  type RangeChoice,
} from './historyRange.ts'
import { dayOffDates, loadWorkDays, setDayOff } from './workDays.ts'

const CHOICES: { value: RangeChoice; key: StringKey }[] = [
  { value: 'today', key: 'rangeToday' },
  { value: 'yesterday', key: 'rangeYesterday' },
  { value: 'thisWeek', key: 'rangeThisWeek' },
  { value: 'lastWeek', key: 'rangeLastWeek' },
  { value: 'custom', key: 'rangeCustom' },
]

// How many of the range's most used services get a quick pill.
const QUICK_SERVICES = 2

function toggleIn<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

type View = 'list' | 'calendar'

// Remembered while the app stays open; a reload starts on the list.
let sessionView: View = 'list'

function rememberView(next: View): void {
  sessionView = next
}

interface ShownRange {
  choice: RangeChoice
  customStart: IsoDate
  customEnd: IsoDate
}

// The range chosen, kept the same way, so opening a turn and coming back
// returns to it.
let sessionRange: ShownRange | null = null

const VIEW_KEYS = {
  list: 'historyList',
  calendar: 'historyCalendar',
} as const satisfies Record<View, StringKey>

export function HistoryPage() {
  const { locale, weekStartDay, hoursOn } = useSettings()
  const today = useToday()
  const [, navigate] = useLocation()
  const toast = useToast()
  // Home's week bottles open History on one day: /history?day=2026-11-04.
  const queryDay = new URLSearchParams(useSearch()).get('day')
  const openedDay = queryDay !== null && isIsoDate(queryDay) ? queryDay : null
  const [view, setViewState] = useState<View>(openedDay ? 'list' : sessionView)
  const [monthAnchor, setMonthAnchor] = useState<IsoDate>(openedDay ?? today)
  const [shown, setShown] = useState<ShownRange>(() =>
    openedDay
      ? { choice: 'custom', customStart: openedDay, customEnd: openedDay }
      : (sessionRange ?? { choice: 'thisWeek', customStart: today, customEnd: today }),
  )
  const { choice, customStart, customEnd } = shown
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [menuDay, setMenuDay] = useState<IsoDate | null>(null)
  const [hoursDay, setHoursDay] = useState<IsoDate | null>(null)
  const id = useId()

  function setView(next: View) {
    rememberView(next)
    setViewState(next)
  }

  function showRange(next: ShownRange) {
    sessionRange = next
    setShown(next)
  }

  /** Custom opens on the range that was just shown, so it can be widened from there. */
  function chooseRange(next: RangeChoice) {
    if (next === 'custom' && choice !== 'custom' && !invalidRange) {
      showRange({ choice: next, customStart: start, customEnd: end })
    } else {
      showRange({ ...shown, choice: next })
    }
  }

  const range =
    choice === 'custom'
      ? { start: customStart, end: customEnd }
      : rangeFor(choice, today, weekStartDay)
  const { start, end } = range
  const month = monthRange(monthAnchor)
  const invalidRange = view === 'list' && end < start
  const queryStart = view === 'calendar' ? month.start : start
  const queryEnd = view === 'calendar' ? month.end : end

  // useLiveQuery keeps the last result while a new range loads, so each
  // result carries its range. Otherwise a tapped calendar day would flash
  // the whole month in the list.
  const rangeKey = `${queryStart}..${queryEnd}`
  const loaded = useLiveQuery(async () => {
    startLoad('load:history')
    const [data, workDays] = await Promise.all([
      invalidRange ? null : loadRange(db, queryStart, queryEnd),
      loadWorkDays(db, queryStart, queryEnd),
    ])
    endLoad('load:history')
    return { key: rangeKey, data, workDays }
  }, [queryStart, queryEnd, invalidRange])
  // While a newer range loads, keep the page (and any focused date box) and
  // show no list, as for a rejected range.
  const data = loaded === undefined ? undefined : loaded.key === rangeKey ? loaded.data : null
  const workDays =
    loaded === undefined ? undefined : loaded.key === rangeKey ? loaded.workDays : []

  // A null result is a rejected range: keep the page and its date inputs
  // on screen, just without a list or an empty message.
  if (!invalidRange && data === undefined) return null
  if (view === 'calendar' && workDays === undefined) return null

  const hasSearch = search.trim() !== ''
  const grouped = data ? servicesByTurn(data.services) : new Map<string, TurnService[]>()
  // Numbers count every turn in the range, so hiding one with a search
  // does not renumber the others.
  const numbers = new Map<string, number | null>()
  if (data) {
    for (const group of groupByDay(data.turns, data.adjustments)) {
      for (const [turnId, number] of numberTurns(group.turns)) numbers.set(turnId, number)
    }
  }

  const filtersOn = hasFilters(filters)
  const hidingTurns = hasSearch || filtersOn
  const visibleTurns = data
    ? data.turns.filter(
        (turn) =>
          matchesSearch(grouped.get(turn.id) ?? [], search) &&
          matchesFilters(turn, grouped.get(turn.id) ?? [], filters),
      )
    : []
  const visibleAdjustments = data && !hidingTurns ? data.adjustments : []
  const groups = groupByDay(visibleTurns, visibleAdjustments)
  const totalTurns = visibleTurns.reduce((sum, turn) => sum + turn.turnCount, 0)
  const totalEarnedCents = sumTotals(visibleTurns, visibleAdjustments).earnedCents
  const serviceOptions = data ? serviceNames(data.services) : []
  const quickServices = data ? topServiceNames(data.services, QUICK_SERVICES) : []
  const quickPills: { key: string; label: string; on: boolean; toggle: () => void }[] = [
    {
      key: 'request',
      label: t(locale, 'clientRequest'),
      on: filters.clients.includes('request'),
      toggle: () => setFilters({ ...filters, clients: toggleIn(filters.clients, 'request') }),
    },
    {
      key: 'cash',
      label: t(locale, 'cashTip'),
      on: filters.tips.includes('cash'),
      toggle: () => setFilters({ ...filters, tips: toggleIn(filters.tips, 'cash') }),
    },
    {
      key: 'card',
      label: t(locale, 'cardTip'),
      on: filters.tips.includes('card'),
      toggle: () => setFilters({ ...filters, tips: toggleIn(filters.tips, 'card') }),
    },
    ...quickServices.map((name) => ({
      key: `service:${name}`,
      label: name,
      on: filters.services.includes(name),
      toggle: () => setFilters({ ...filters, services: toggleIn(filters.services, name) }),
    })),
  ]
  // A filter with a quick pill is shown (and removed) there, not as a chip.
  const activeFilters: { key: string; label: string; remove: () => void }[] = []
  for (const name of filters.services) {
    if (quickServices.includes(name)) continue
    activeFilters.push({
      key: `service:${name}`,
      label: name,
      remove: () =>
        setFilters({ ...filters, services: filters.services.filter((item) => item !== name) }),
    })
  }
  for (const type of filters.clients) {
    if (type === 'request') continue
    activeFilters.push({
      key: `client:${type}`,
      label: t(locale, 'clientWalkIn'),
      remove: () =>
        setFilters({ ...filters, clients: filters.clients.filter((item) => item !== type) }),
    })
  }
  for (const type of filters.tips) {
    if (type === 'cash' || type === 'card') continue
    activeFilters.push({
      key: `tip:${type}`,
      label: t(locale, 'filterNoTip'),
      remove: () => setFilters({ ...filters, tips: filters.tips.filter((item) => item !== type) }),
    })
  }
  if (filters.hasNote) {
    activeFilters.push({
      key: 'note',
      label: t(locale, 'filterHasNote'),
      remove: () => setFilters({ ...filters, hasNote: false }),
    })
  }

  const monthGroups = data ? groupByDay(data.turns, data.adjustments) : []
  const earnedByDate = new Map(monthGroups.map((group) => [group.date, group.earnedCents]))
  const offDates = dayOffDates(workDays ?? [])
  const hoursTextByDate = new Map<IsoDate, string>()
  for (const day of workDays ?? []) {
    if (day.startTime !== null && day.endTime !== null) {
      hoursTextByDate.set(day.date, dayHoursText(locale, day.startTime, day.endTime))
    }
  }

  const hoursDayWork = hoursDay === null ? null : ((workDays ?? []).find((day) => day.date === hoursDay) ?? null)
  const hoursSuggestion =
    hoursDay !== null &&
    (hoursDayWork === null || (hoursDayWork.startTime === null && hoursDayWork.endTime === null))
      ? suggestionForDay(
          (data?.turns ?? []).filter((turn) => turn.localWorkDate === hoursDay),
          hoursDay,
        )
      : null

  const rangeError = invalidRange ? t(locale, 'errorRange') : undefined

  /** One tap marks or clears the day; Undo puts it back the way it was. */
  async function toggleDayOff(date: IsoDate, wasOff: boolean) {
    await setDayOff(db, date, !wasOff)
    toast.show({
      message: t(locale, wasOff ? 'dayOffCleared' : 'dayOffMarked'),
      actions: [
        {
          label: t(locale, 'undo'),
          onClick: () => {
            void setDayOff(db, date, wasOff)
          },
        },
      ],
    })
  }

  function openDay(date: IsoDate) {
    setView('list')
    showRange({ choice: 'custom', customStart: date, customEnd: date })
    navigate(paths.historyDay(date), { replace: true })
  }

  return (
    <>
      <PageHeader title={t(locale, 'historyTitle')} />

      <div
        role="group"
        aria-label={t(locale, 'historyView')}
        className="grid grid-cols-2 gap-1 rounded-control border border-border bg-surface-subtle p-1"
      >
        {(['list', 'calendar'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
            className={`min-h-11 rounded-[9px] text-sm font-semibold ${
              view === value
                ? 'bg-surface text-text shadow-[0_1px_2px_rgb(29_24_34/0.12)]'
                : 'text-text-secondary'
            }`}
          >
            {t(locale, VIEW_KEYS[value])}
          </button>
        ))}
      </div>

      {view === 'calendar' ? (
        <CalendarView
          month={monthAnchor}
          today={today}
          weekStart={weekStartDay}
          locale={locale}
          earnedByDate={earnedByDate}
          offDates={offDates}
          onPrevious={() => setMonthAnchor(monthShift(monthAnchor, -1))}
          onNext={() => setMonthAnchor(monthShift(monthAnchor, 1))}
          onPick={openDay}
          onMenu={setMenuDay}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {CHOICES.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                aria-pressed={choice === value}
                className={`${chip} ${choice === value ? chipOn : chipOff}`}
                onClick={() => chooseRange(value)}
              >
                {t(locale, key)}
              </button>
            ))}
          </div>

          {choice === 'custom' && (
            <>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${id}-from`} className={label}>
                    {t(locale, 'from')}
                  </label>
                  <input
                    id={`${id}-from`}
                    type="date"
                    value={customStart}
                    onChange={(event) => showRange({ ...shown, customStart: event.target.value })}
                    aria-invalid={invalidRange}
                    aria-describedby={invalidRange ? `${id}-range-error` : undefined}
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
                    value={customEnd}
                    onChange={(event) => showRange({ ...shown, customEnd: event.target.value })}
                    aria-invalid={invalidRange}
                    aria-describedby={invalidRange ? `${id}-range-error` : undefined}
                    className={field}
                  />
                </div>
              </div>
              {rangeError && (
                <p id={`${id}-range-error`} className={errorText}>
                  {rangeError}
                </p>
              )}
            </>
          )}

          <div>
            <label htmlFor={`${id}-search`} className={label}>
              {t(locale, 'searchServices')}
            </label>
            <input
              id={`${id}-search`}
              type="search"
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(locale, 'searchPlaceholder')}
              className={field}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen(true)}
              className={`${chip} ${filtersOn ? chipOn : chipOff} inline-flex shrink-0 items-center gap-1`}
            >
              <IconFilter size={16} aria-hidden="true" />
              {t(locale, 'filter')}
            </button>
            <div
              role="group"
              aria-label={t(locale, 'filterQuick')}
              className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 [scrollbar-width:none]"
            >
              {quickPills.map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  aria-pressed={pill.on}
                  onClick={pill.toggle}
                  className={`${chip} shrink-0 whitespace-nowrap ${pill.on ? chipOn : chipOff}`}
                >
                  {pill.label}
                </button>
              ))}
              {filtersOn && (
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className={`${chip} ${chipOff} shrink-0 whitespace-nowrap`}
                >
                  {t(locale, 'filterClear')}
                </button>
              )}
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map((active) => (
                <button
                  key={active.key}
                  type="button"
                  onClick={active.remove}
                  className={`${chip} ${chipOn} inline-flex items-center gap-1`}
                >
                  {active.label}
                  <IconX size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {!invalidRange && data !== null && visibleTurns.length > 0 && (
            <p data-testid="history-total" className="text-sm font-semibold text-text-secondary">
              {tf(locale, totalTurns === 1 ? 'historyTotalOne' : 'historyTotal', {
                n: totalTurns,
                amount: formatUsdShort(totalEarnedCents),
              })}
            </p>
          )}

          <Link href={paths.adjustmentNew} className={`${secondaryButton} block text-center`}>
            {t(locale, 'addAdjustment')}
          </Link>

          {!invalidRange && data !== null && groups.length === 0 && (
            <p className="text-text-secondary">
              {t(locale, hidingTurns ? 'noMatches' : 'noEntries')}
            </p>
          )}

          {!invalidRange &&
            groups.map((group) => {
              const turnCount = group.turns.reduce((sum, turn) => sum + turn.turnCount, 0)
              const countText = tf(
                locale,
                turnCount === 1 ? 'dayTurnCountOne' : 'dayTurnCount',
                { n: turnCount },
              )
              return (
                <section key={group.date}>
                  <div className="mt-[18px] mb-[7px] flex items-center justify-between gap-2 px-1 text-sm font-bold">
                    <h2 className="min-w-0 flex-1">{formatDayLong(group.date, locale)}</h2>
                    <p className="shrink-0 font-semibold text-text-secondary">
                      {countText} · {formatUsdShort(group.earnedCents)}
                    </p>
                    <button
                      type="button"
                      aria-label={tf(locale, 'dayActionsFor', {
                        day: formatDayLong(group.date, locale),
                      })}
                      onClick={() => setMenuDay(group.date)}
                      className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-secondary"
                    >
                      <IconDots size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mb-1 flex items-center gap-2 px-1">
                    <button
                      type="button"
                      aria-pressed={offDates.has(group.date)}
                      aria-label={tf(locale, 'dayOffFor', {
                        day: formatDayLong(group.date, locale),
                      })}
                      onClick={() => {
                        void toggleDayOff(group.date, offDates.has(group.date))
                      }}
                      className={`${chip} shrink-0 whitespace-nowrap rounded-full ${
                        offDates.has(group.date) ? chipOn : chipOff
                      }`}
                    >
                      {t(locale, 'dayOffToggle')}
                    </button>
                    {hoursTextByDate.get(group.date) !== undefined && (
                      <p className="min-w-0 text-sm text-text-secondary">
                        {t(locale, 'hoursTitle')} {hoursTextByDate.get(group.date)}
                      </p>
                    )}
                  </div>
                  <div className={list}>
                    {group.turns.map((turn) => (
                      <TurnRow
                        key={turn.id}
                        turn={turn}
                        services={grouped.get(turn.id) ?? []}
                        number={numbers.get(turn.id) ?? null}
                      />
                    ))}
                    {group.adjustments.map((adjustment) => (
                      <AdjustmentRow key={adjustment.id} adjustment={adjustment} />
                    ))}
                  </div>
                </section>
              )
            }          )}
        </>
      )}

      {filterOpen && (
        <FilterSheet
          filters={filters}
          serviceOptions={serviceOptions}
          onChange={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {menuDay !== null && (
        <DayOffSheet
          date={menuDay}
          dayOff={offDates.has(menuDay)}
          hoursOn={hoursOn}
          hoursText={hoursTextByDate.get(menuDay) ?? null}
          onEditHours={() => {
            const day = menuDay
            setMenuDay(null)
            setHoursDay(day)
          }}
          onClose={() => setMenuDay(null)}
        />
      )}

      {hoursDay !== null && (
        <HoursSheet
          date={hoursDay}
          startTime={hoursDayWork?.startTime ?? null}
          endTime={hoursDayWork?.endTime ?? null}
          suggestion={hoursSuggestion}
          onClose={() => setHoursDay(null)}
        />
      )}
    </>
  )
}
