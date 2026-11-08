import type { PayPeriod } from '../../db/schema.ts'
import { formatRange, type IsoDate } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import type { CheckResult, Received } from '../../domain/paycheckCheck.ts'
import type { Statement } from '../../domain/statement.ts'
import { t } from '../../lib/i18n.ts'
import { checkStatusLabel } from '../paycheck/paycheckStatus.ts'
import {
  daysWorkedLabel,
  statementItems,
  type StatementEndRules,
  type StatementItem,
} from '../paycheck/statementLines.ts'
import type { ShareLayoutInput, ShareLine } from './shareLayout.ts'

interface StatementPictureInput {
  period: PayPeriod
  statement: Statement
  endRules: StatementEndRules
  received: Received
  check: CheckResult | null
  checkedDate: IsoDate | null
}

/** Pairs the Vietnamese line with the English one, which goes underneath it. */
function bilingualLines(vi: StatementItem[], en: StatementItem[]): ShareLine[] {
  const lines: ShareLine[] = []
  const count = Math.max(vi.length, en.length)
  for (let index = 0; index < count; index += 1) {
    const viItem = vi[index]
    const enItem = en[index]
    if (viItem?.kind === 'rule') {
      lines.push({ label: '', rule: true })
      continue
    }
    if (viItem?.kind !== 'line') continue
    lines.push({
      label: viItem.line.label,
      sub: enItem?.kind === 'line' ? enItem.line.label : undefined,
      amount: viItem.line.value,
      strong: viItem.line.strong,
    })
  }
  return lines
}

/**
 * The Part 1 statement plus what was received, in both languages. The
 * statement words come from the same function the card uses.
 */
export function statementPictureInput(args: StatementPictureInput): ShareLayoutInput {
  const { period, statement, endRules, received, check, checkedDate } = args

  const periodLine: ShareLine = {
    label: `${t('vi', 'payPeriod')}: ${formatRange(period.startDate, period.endDate, 'vi')}`,
    sub: `${t('en', 'payPeriod')}: ${formatRange(period.startDate, period.endDate, 'en')}`,
  }
  const daysLine: ShareLine = {
    label: daysWorkedLabel('vi', statement.daysWorked),
    sub: daysWorkedLabel('en', statement.daysWorked),
  }

  const receivedLines: ShareLine[] = [
    {
      label: t('vi', 'methodCheck'),
      sub: t('en', 'methodCheck'),
      amount: formatUsd(received.checkCents),
    },
    {
      label: t('vi', 'methodCash'),
      sub: t('en', 'methodCash'),
      amount: formatUsd(received.cashCents),
    },
    {
      label: t('vi', 'methodOther'),
      sub: t('en', 'methodOther'),
      amount: formatUsd(received.otherCents),
    },
  ]

  if (check !== null || checkedDate !== null) {
    receivedLines.push({
      label: checkStatusLabel('vi', check, checkedDate),
      sub: checkStatusLabel('en', check, checkedDate),
    })
  }

  return {
    title: t('vi', 'statementPictureTitle'),
    titleSub: t('en', 'statementPictureTitle'),
    lines: [periodLine, daysLine],
    sections: [
      {
        lines: bilingualLines(
          statementItems('vi', statement, endRules),
          statementItems('en', statement, endRules),
        ),
      },
      {
        heading: t('vi', 'receivedSection'),
        headingSub: t('en', 'receivedSection'),
        lines: receivedLines,
      },
    ],
    footer: `${t('en', 'madeWithNailTracker')} · ${t('vi', 'madeWithNailTracker')}`,
  }
}
