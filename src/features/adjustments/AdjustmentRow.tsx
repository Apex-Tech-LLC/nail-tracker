import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import type { Adjustment } from '../../db/schema.ts'
import { formatUsdShort } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import { ADJUSTMENT_LABEL } from './adjustmentLabels.ts'

/** One signed correction in a list, the same height as a turn row but without a copy button. */
export function AdjustmentRow({ adjustment }: { adjustment: Adjustment }) {
  const { locale } = useSettings()

  return (
    <Link
      href={paths.adjustment(adjustment.id)}
      className="flex min-h-[60px] items-center gap-3 py-[11px] pl-3.5 pr-1.5"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">
          {t(locale, ADJUSTMENT_LABEL[adjustment.category])}
        </p>
        {adjustment.note && (
          <p className="mt-px truncate text-[13px] text-text-secondary" data-testid="truncate-ok">
            {adjustment.note}
          </p>
        )}
      </div>
      <p className="shrink-0 text-[16px] font-bold tabular-nums">
        {formatUsdShort(adjustment.amountCents)}
      </p>
    </Link>
  )
}
