import { Link } from 'wouter'
import { useSettings } from '../../app/settings.ts'
import { paths } from '../../app/navigation.ts'
import type { Turn, TurnService } from '../../db/schema.ts'
import { formatUsd } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import { card } from '../../ui/styles.ts'

interface Props {
  turn: Turn
  services: TurnService[]
  number: number | null
}

/** One turn in a list. Shared by Today and History. */
export function TurnRow({ turn, services, number }: Props) {
  const { locale } = useSettings()
  const extraServices = services.length - 1
  const tipCents = turn.cashTipCents + turn.cardTipCents

  return (
    <Link href={paths.edit(turn.id)} className={`${card} flex items-start justify-between gap-3`}>
      <div className="min-w-0">
        <p className="font-medium">
          {number === null ? t(locale, 'noTurnNumber') : tf(locale, 'turnNumber', { n: number })}
        </p>
        <p className="truncate text-sm text-text-secondary">
          {services[0]?.serviceNameSnapshot}
          {extraServices > 0 && ` ${tf(locale, 'moreServices', { n: extraServices })}`}
        </p>
        <p className="mt-1 text-sm tabular-nums">{formatUsd(turn.serviceRevenueTotalCents)}</p>
        {tipCents > 0 && (
          <p className="text-sm tabular-nums text-text-secondary">
            {tf(locale, 'tipShort', { amount: formatUsd(tipCents) })}
          </p>
        )}
      </div>
      <p className="shrink-0 font-medium tabular-nums">{formatUsd(turn.earnedTotalCents)}</p>
    </Link>
  )
}
