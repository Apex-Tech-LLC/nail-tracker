import { IconPlus } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'wouter'
import { PageHeader } from '../../app/PageHeader.tsx'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db } from '../../db/schema.ts'
import { formatDayLong, isIsoDate, type IsoDate } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import { numberTurns, sumTotals } from '../../domain/totals.ts'
import { t } from '../../lib/i18n.ts'
import { card, field, primaryButton, secondaryButton } from '../../ui/styles.ts'
import { loadRange, servicesByTurn } from '../turns/turnStore.ts'
import { TurnRow } from '../turns/TurnRow.tsx'

const RECENT_LIMIT = 10

export function TodayPage() {
  const { locale } = useSettings()
  const today = useToday()
  const [picked, setPicked] = useState<IsoDate | null>(null)
  const day = picked ?? today
  // Live query: saving a turn elsewhere updates this screen without a refresh.
  const data = useLiveQuery(() => loadRange(db, day, day), [day])
  // The most recent turn ever, not just on this day, so Repeat works on any day.
  const latestTurn = useLiveQuery(() => db.turns.orderBy('occurredAt').last(), [])

  if (data === undefined) return null

  const totals = sumTotals(data.turns, data.adjustments)
  const numbers = numberTurns(data.turns)
  const grouped = servicesByTurn(data.services)
  const recentTurns = [...data.turns]
    .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt)
    .slice(0, RECENT_LIMIT)
  const isToday = day === today
  const hasTurns = data.turns.length > 0

  return (
    <>
      <PageHeader title={t(locale, 'appName')} />

      <p className="text-sm text-text-secondary">
        {isToday
          ? `${t(locale, 'todayLabel')} — ${formatDayLong(day, locale)}`
          : formatDayLong(day, locale)}
      </p>

      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label={t(locale, 'viewAnotherDay')}
          max={today}
          value={day}
          onChange={(event) => {
            const value = event.target.value
            if (isIsoDate(value)) setPicked(value === today ? null : value)
          }}
          className={`${field} min-w-0 flex-1`}
        />
        {picked !== null && (
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="shrink-0 rounded-control border border-border-strong px-4 py-3 text-base"
          >
            {t(locale, 'backToTodayShort')}
          </button>
        )}
      </div>

      {/* ! needed: card's bg-surface is emitted after bg-brand-50 by Tailwind. */}
      <div className={`${card} bg-brand-50!`}>
        <p className="text-sm text-text-secondary">{t(locale, 'turns')}</p>
        <p className="text-3xl font-extrabold tracking-[-0.03em] tabular-nums">{totals.turns}</p>
        <p className="text-xl tabular-nums">
          {formatUsd(totals.serviceRevenueCents)} {t(locale, 'serviceRevenue')}
        </p>
      </div>

      <div className={`${card} flex flex-col gap-2`}>
        <Figure label={t(locale, 'customers')} value={String(totals.customers)} />
        <Figure label={t(locale, 'commission')} value={formatUsd(totals.commissionCents)} />
        <Figure label={t(locale, 'cashTips')} value={formatUsd(totals.cashTipsCents)} />
        <Figure label={t(locale, 'cardTips')} value={formatUsd(totals.cardTipsCents)} />
        {totals.adjustmentsCents !== 0 && (
          <Figure label={t(locale, 'adjustments')} value={formatUsd(totals.adjustmentsCents)} />
        )}
        <div className="flex justify-between gap-3 text-xl font-extrabold tracking-[-0.03em] text-positive-text">
          <span>{t(locale, 'totalEarned')}</span>
          <span className="tabular-nums">{formatUsd(totals.earnedCents)}</span>
        </div>
      </div>

      {!hasTurns && (
        <div>
          <p className="font-medium">{t(locale, 'noTurnsTitle')}</p>
          <p className="text-sm text-text-secondary">{t(locale, 'noTurnsHint')}</p>
        </div>
      )}

      <Link href={paths.add} className={`${primaryButton} flex items-center justify-center gap-2`}>
        <IconPlus size={20} aria-hidden="true" />
        {hasTurns ? t(locale, 'addTurn') : t(locale, 'addFirstTurn')}
      </Link>

      {latestTurn && (
        <Link
          href={paths.copy(latestTurn.id)}
          className={`${secondaryButton} flex min-h-11 items-center justify-center`}
        >
          {t(locale, 'repeatLastTurn')}
        </Link>
      )}

      {recentTurns.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t(locale, 'recentTurns')}</h2>
          <div className="flex flex-col gap-2">
            {recentTurns.map((turn) => (
              <TurnRow
                key={turn.id}
                turn={turn}
                services={grouped.get(turn.id) ?? []}
                number={numbers.get(turn.id) ?? null}
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
