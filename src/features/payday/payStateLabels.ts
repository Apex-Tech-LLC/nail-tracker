import type { PayStateName } from '../../domain/payday.ts'
import type { StringKey } from '../../lib/i18n.ts'

export const PAY_STATE_LABEL: Record<PayStateName, StringKey> = {
  owed: 'statusOwed',
  paid: 'statusPaid',
  overpaid: 'statusOverpaid',
  empty: 'statusEmpty',
}

export const PAY_STATE_COLOR: Record<PayStateName, string> = {
  owed: 'text-warning-text',
  paid: 'text-positive-text',
  overpaid: 'text-danger-text',
  empty: 'text-text-secondary',
}
