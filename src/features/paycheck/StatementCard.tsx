import { useId, useState } from 'react'
import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import type { PayPeriod } from '../../db/schema.ts'
import { formatDayShort, formatRange } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import type { PayStateName } from '../../domain/payday.ts'
import type { Statement } from '../../domain/statement.ts'
import { t } from '../../lib/i18n.ts'
import { card, secondaryButton } from '../../ui/styles.ts'
import { PAY_STATE_COLOR, PAY_STATE_LABEL } from '../payday/payStateLabels.ts'
import {
  daysWorkedLabel,
  statementItems,
  type StatementEndRules,
} from './statementLines.ts'

interface Props {
  period: PayPeriod
  statement: Statement
  endRules: StatementEndRules
  status: PayStateName
}

export function StatementCard({ period, statement, endRules, status }: Props) {
  const { locale } = useSettings()
  const [showByDay, setShowByDay] = useState(false)
  const tableId = useId()

  const daysWorked = daysWorkedLabel(locale, statement.daysWorked)
  const items = statementItems(locale, statement, endRules)

  return (
    <div className={card}>
      <Link href={paths.period(period.id)} className="block">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">
            {t(locale, 'payPeriod')}:{' '}
            {formatRange(period.startDate, period.endDate, locale)}
          </span>
          <span className="shrink-0 text-sm text-text-secondary">{daysWorked}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-ink-strong">
            {t(locale, 'currentPeriod')}
          </span>
          <span className={`text-sm ${PAY_STATE_COLOR[status]}`}>
            {t(locale, PAY_STATE_LABEL[status])}
          </span>
        </div>
      </Link>

      <div className="mt-3">
        {items.map((item, index) =>
          item.kind === 'rule' ? (
            <div key={`rule-${index}`} className="my-1 border-t-2 border-text" />
          ) : (
            <StatementRow
              key={`line-${index}`}
              label={item.line.label}
              value={item.line.value}
              strong={item.line.strong}
              large={item.line.large}
              indent={item.line.indent}
            />
          ),
        )}
      </div>

      <button
        type="button"
        aria-expanded={showByDay}
        aria-controls={tableId}
        onClick={() => setShowByDay((open) => !open)}
        className={`${secondaryButton} mt-3`}
      >
        {t(locale, 'showByDay')}
      </button>

      {showByDay && (
        <table id={tableId} className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1 text-left font-medium text-text-secondary">
                {t(locale, 'date')}
              </th>
              <th scope="col" className="py-1 text-right font-medium text-text-secondary">
                {t(locale, 'statementServicesColumn')}
              </th>
              <th scope="col" className="py-1 text-right font-medium text-text-secondary">
                {t(locale, 'statementShare')}
              </th>
              <th scope="col" className="py-1 text-right font-medium text-text-secondary">
                {t(locale, 'cardTips')}
              </th>
            </tr>
          </thead>
          <tbody>
            {statement.byDay.map((day) => (
              <tr key={day.date} className="border-b border-border">
                <th scope="row" className="py-1 text-left font-normal">
                  {formatDayShort(day.date, locale)}
                </th>
                <td className="py-1 text-right tabular-nums">
                  {formatUsd(day.servicesTotalCents)}
                </td>
                <td className="py-1 text-right tabular-nums">{formatUsd(day.shareCents)}</td>
                <td className="py-1 text-right tabular-nums">{formatUsd(day.cardTipsCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-1">{t(locale, 'statementTotal')}</td>
              <td className="py-1 text-right tabular-nums">
                {formatUsd(statement.servicesTotalCents)}
              </td>
              <td className="py-1 text-right tabular-nums">{formatUsd(statement.shareCents)}</td>
              <td className="py-1 text-right tabular-nums">{formatUsd(statement.cardTipsCents)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

function StatementRow({
  label,
  value,
  strong,
  large,
  indent,
}: {
  label: string
  value: string
  strong?: boolean
  large?: boolean
  indent?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${indent ? 'pl-4' : ''}`}>
      <span className={`min-w-0 ${strong ? '' : 'text-text-secondary'}`}>{label}</span>
      <span
        className={`shrink-0 tabular-nums${
          large ? ' text-lg font-bold' : strong ? ' font-semibold' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
