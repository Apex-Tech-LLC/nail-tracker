import type { AdjustmentCategory } from '../../domain/totals.ts'
import type { StringKey } from '../../lib/i18n.ts'

export const ADJUSTMENT_LABEL: Record<AdjustmentCategory, StringKey> = {
  bonus: 'adjBonus',
  commissionCorrection: 'adjCommissionCorrection',
  tipCorrection: 'adjTipCorrection',
  bookkeepingDeduction: 'adjBookkeepingDeduction',
}
