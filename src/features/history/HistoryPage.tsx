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
import { numberTurns, sumTotals } from '../../domain/totals.ts'
import { t, tf, type StringKey } from '../../lib/i18n.ts'
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
import { AdjustmentRow } from '../adjustments/AdjustmentRow.tsx'
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
  type Filters,
  type RangeChoice,
} from './historyRange.ts'
import { dayOffDates, loadWorkDays } from './workDays.ts'

const CHOICES: { value: RangeChoice; key: StringKey }[] = [
  { value: 'today', key: 'rangeToday' },
  { value: 'yesterday', key: 'rangeYesterday' },
  { value: 'thisWeek', key: 'rangeThisWeek' },
  { value: 'lastWeek', key: 'rangeLastWeek' },
  { value: 'custom', key: 'rangeCustom' },
]

type View = 'list' | 'calendar'

// Remembered while the app stays open; a reload starts on the list.
let sessionView: View = 'list'

function rememberView(next: View): void {
  sessionView = next
}

const VIEW_KEYS = {
  list: 'historyList',
  calendar: 'historyCalendar',
} as const satisfies Record<View, StringKey>

export function HistoryPage() {
  const { locale, weekStartDay } = useSettings()
  const today = useToday()
  const [, navigate] = useLocation()
  // Home's week bottles open History on one day: /history?day=2026-11-04.
  const queryDay = new URLSearchParams(useSearch()).get('day')
  const openedDay = queryDay !== null && isIsoDate(queryDay) ? queryDay : null
  const [view, setViewState] = useState<View>(openedDay ? 'list' : sessionView)
  const [monthAnchor, setMonthAnchor] = useState<IsoDate>(openedDay ?? today)
  const [choice, setChoice] = useState<RangeChoice>(openedDay ? 'custom' : 'thisWeek')
  const [customStart, setCustomStart] = useState<IsoDate>(openedDay ?? today)
  const [customEnd, setCustomEnd] = useState<IsoDate>(openedDay ?? today)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [menuDay, setMenuDay] = useState<IsoDate | null>(null)
  const id = useId()

  function setView(next: View) {
    rememberView(next)
    setViewState(next)
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
  const loaded = useLiveQuery(
    async () => ({
      key: rangeKey,
      data: invalidRange ? null : await loadRange(db, queryStart, queryEnd),
    }),
    [queryStart, queryEnd, invalidRange],
  )
  const loadedDays = useLiveQuery(
    async () => ({ key: rangeKey, workDays: await loadWorkDays(db, queryStart, queryEnd) }),
    [queryStart, queryEnd],
  )
  // While a newer range loads, keep the page (and any focused date box) and
  // show no list, as for a rejected range.
  const data = loaded === undefined ? undefined : loaded.key === rangeKey ? loaded.data : null
  const workDays =
    loadedDays === undefined ? undefined : loadedDays.key === rangeKey ? loadedDays.workDays : []

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
  const activeFilters: { key: string; label: string; remove: () => void }[] = []
  for (const name of filters.services) {
    activeFilters.push({
      key: `service:${name}`,
      label: name,
      remove: () =>
        setFilters({ ...filters, services: filters.services.filter((item) => item !== name) }),
    })
  }
  for (const type of filters.clients) {
    activeFilters.push({
      key: `client:${type}`,
      label: t(locale, type === 'request' ? 'clientRequest' : 'clientWalkIn'),
      remove: () =>
        setFilters({ ...filters, clients: filters.clients.filter((item) => item !== type) }),
    })
  }
  for (const type of filters.tips) {
    activeFilters.push({
      key: `tip:${type}`,
      label: t(
        locale,
        type === 'cash' ? 'cashTip' : type === 'card' ? 'cardTip' : 'filterNoTip',
      ),
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

  const rangeError = invalidRange ? t(locale, 'errorRange') : undefined

  function openDay(date: IsoDate) {
    setView('list')
    setChoice('custom')
    setCustomStart(date)
    setCustomEnd(date)
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
                onClick={() => setChoice(value)}
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
                    onChange={(event) => setCustomStart(event.target.value)}
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
                    onChange={(event) => setCustomEnd(event.target.value)}
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen(true)}
              className={`${chip} ${filtersOn ? chipOn : chipOff} inline-flex items-center gap-1`}
            >
              <IconFilter size={16} aria-hidden="true" />
              {t(locale, 'filter')}
            </button>
          </div>

          {filtersOn && (
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
              <button
                type="button"
                onClick={() => setFilters(NO_FILTERS)}
                className={`${chip} ${chipOff}`}
              >
                {t(locale, 'filterClear')}
              </button>
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
                    {offDates.has(group.date) && (
                      <span className="shrink-0 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                        {t(locale, 'dayOff')}
                      </span>
                    )}
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
          onClose={() => setMenuDay(null)}
        />
      )}
    </>
  )
}
