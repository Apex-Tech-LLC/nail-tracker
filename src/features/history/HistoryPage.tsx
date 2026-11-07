import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Link, useSearch } from 'wouter'
import { PageHeader } from '../../app/PageHeader.tsx'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db, type TurnService } from '../../db/schema.ts'
import { formatDayLong, isIsoDate, type IsoDate } from '../../domain/dates.ts'
import { formatUsdShort } from '../../domain/money.ts'
import { numberTurns } from '../../domain/totals.ts'
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
import { groupByDay, matchesSearch, rangeFor, type RangeChoice } from './historyRange.ts'

const CHOICES: { value: RangeChoice; key: StringKey }[] = [
  { value: 'today', key: 'rangeToday' },
  { value: 'yesterday', key: 'rangeYesterday' },
  { value: 'thisWeek', key: 'rangeThisWeek' },
  { value: 'lastWeek', key: 'rangeLastWeek' },
  { value: 'custom', key: 'rangeCustom' },
]

export function HistoryPage() {
  const { locale, weekStartDay } = useSettings()
  const today = useToday()
  // Home's week bottles open History on one day: /history?day=2026-11-04.
  const queryDay = new URLSearchParams(useSearch()).get('day')
  const openedDay = queryDay !== null && isIsoDate(queryDay) ? queryDay : null
  const [choice, setChoice] = useState<RangeChoice>(openedDay ? 'custom' : 'thisWeek')
  const [customStart, setCustomStart] = useState<IsoDate>(openedDay ?? today)
  const [customEnd, setCustomEnd] = useState<IsoDate>(openedDay ?? today)
  const [search, setSearch] = useState('')
  const id = useId()

  const range =
    choice === 'custom'
      ? { start: customStart, end: customEnd }
      : rangeFor(choice, today, weekStartDay)
  const { start, end } = range
  const invalidRange = end < start
  const data = useLiveQuery(
    () => (invalidRange ? null : loadRange(db, start, end)),
    [start, end, invalidRange],
  )

  // A null result is a rejected range: keep the page and its date inputs
  // on screen, just without a list or an empty message.
  if (!invalidRange && data === undefined) return null

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

  const visibleTurns = data
    ? hasSearch
      ? data.turns.filter((turn) => matchesSearch(grouped.get(turn.id) ?? [], search))
      : data.turns
    : []
  const visibleAdjustments = data && !hasSearch ? data.adjustments : []
  const groups = groupByDay(visibleTurns, visibleAdjustments)

  const rangeError = invalidRange ? t(locale, 'errorRange') : undefined

  return (
    <>
      <PageHeader title={t(locale, 'historyTitle')} />

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

      <Link href={paths.adjustmentNew} className={`${secondaryButton} block text-center`}>
        {t(locale, 'addAdjustment')}
      </Link>

      {!invalidRange && data !== null && groups.length === 0 && (
        <p className="text-text-secondary">
          {t(locale, hasSearch ? 'noMatches' : 'noEntries')}
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
              <div className="mt-[18px] mb-[7px] flex items-baseline justify-between gap-3 px-1 text-sm font-bold">
                <h2>{formatDayLong(group.date, locale)}</h2>
                <p className="font-semibold text-text-secondary">
                  {countText} · {formatUsdShort(group.earnedCents)}
                </p>
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
        })}
    </>
  )
}
