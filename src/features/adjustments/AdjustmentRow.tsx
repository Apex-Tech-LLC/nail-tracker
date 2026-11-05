import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import type { Adjustment } from '../../db/schema.ts'
import { formatUsd } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import { card } from '../../ui/styles.ts'
import { ADJUSTMENT_LABEL } from './adjustmentLabels.ts'

/** One signed correction in a list. T12 adds the screen it opens. */
export function AdjustmentRow({ adjustment }: { adjustment: Adjustment }) {
  const { locale } = useSettings()

  return (
    <Link
      href={paths.adjustment(adjustment.id)}
      className={`${card} flex items-start justify-between gap-3`}
    >
      <div className="min-w-0">
        <p className="font-medium">{t(locale, ADJUSTMENT_LABEL[adjustment.category])}</p>
        {adjustment.note && (
          <p className="truncate text-sm text-text-secondary">{adjustment.note}</p>
        )}
      </div>
      <p className="shrink-0 font-medium tabular-nums">{formatUsd(adjustment.amountCents)}</p>
    </Link>
  )
}
