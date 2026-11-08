import type { CheckResult } from '../../domain/paycheckCheck.ts'
import type { IsoDate } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'

export type CheckStatus = 'notChecked' | 'checked' | 'matches' | 'short' | 'over'

export function checkStatus(
  check: CheckResult | null,
  checkedDate: IsoDate | null,
): CheckStatus {
  // The result is known as soon as money was recorded; checking the period is
  // the technician's separate confirmation that they looked at it.
  if (check !== null) return check.kind
  if (checkedDate !== null) return 'checked'
  return 'notChecked'
}

export function checkStatusLabel(
  locale: Locale,
  check: CheckResult | null,
  checkedDate: IsoDate | null,
): string {
  const status = checkStatus(check, checkedDate)
  if (status === 'notChecked') return t(locale, 'notChecked')
  if (status === 'checked' || check === null) return t(locale, 'checkedStatus')
  if (status === 'matches') return t(locale, 'checkMatches')
  return tf(locale, status === 'short' ? 'checkShort' : 'checkOver', {
    amount: formatUsd(check.differenceCents),
  })
}

export function checkStatusColor(
  check: CheckResult | null,
  checkedDate: IsoDate | null,
): string {
  const status = checkStatus(check, checkedDate)
  if (status === 'matches') return 'text-positive-text'
  if (status === 'short') return 'text-warning-text'
  return 'text-text-secondary'
}
