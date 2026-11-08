import { useId, useState } from 'react'
import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import type { PayPeriod } from '../../db/schema.ts'
import { formatDayShort, formatRange } from '../../domain/dates.ts'
import { formatRate, formatUsd, formatUsdShort } from '../../domain/money.ts'
import type { PayRules } from '../../domain/payRules.ts'
import type { PayStateName } from '../../domain/payday.ts'
import type { Statement } from '../../domain/statement.ts'
import { t, tf } from '../../lib/i18n.ts'
import { card, secondaryButton } from '../../ui/styles.ts'
import { PAY_STATE_COLOR, PAY_STATE_LABEL } from '../payday/payStateLabels.ts'

interface Props {
  period: PayPeriod
  statement: Statement
  endRules: Omit<PayRules, 'id' | 'createdAt' | 'updatedAt'>
  status: PayStateName
}

export function StatementCard({ period, statement, endRules, status }: Props) {
  const { locale } = useSettings()
  const [showByDay, setShowByDay] = useState(false)
  const tableId = useId()

  const daysWorked =
    statement.daysWorked === 1
      ? t(locale, 'daysWorkedOne')
      : tf(locale, 'daysWorked', { n: statement.daysWorked })

  let supplyFeeLabel: string | null = null
  if (endRules.supplyFee.kind === 'perService') {
    supplyFeeLabel = tf(
      locale,
      statement.services === 1
        ? 'statementSupplyFeePerServiceOne'
        : 'statementSupplyFeePerService',
      { amount: formatUsdShort(endRules.supplyFee.cents), n: statement.services },
    )
  } else if (endRules.supplyFee.kind === 'percent') {
    supplyFeeLabel = tf(locale, 'statementSupplyFeePercent', {
      rate: formatRate(endRules.supplyFee.bp),
    })
  }

  const shareLabel =
    statement.shareRateBp !== null && statement.supplyFeeWhen !== 'afterSplit'
      ? tf(locale, 'statementShareWithRate', {
          rate: formatRate(statement.shareRateBp),
          base: formatUsd(statement.shareBaseCents),
        })
      : t(locale, 'statementShare')

  const checkBp = endRules.checkBp
  const cashBp = checkBp === null ? null : 10_000 - checkBp

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
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-900">
            {t(locale, 'currentPeriod')}
          </span>
          <span className={`text-sm ${PAY_STATE_COLOR[status]}`}>
            {t(locale, PAY_STATE_LABEL[status])}
          </span>
        </div>
      </Link>

      <div className="mt-3">
        <StatementRow
          label={
            statement.services === 1 && statement.turns === 1
              ? t(locale, 'statementServicesLineOne')
              : tf(locale, 'statementServicesLine', {
                  services: statement.services,
                  turns: statement.turns,
                })
          }
          value={formatUsd(statement.servicesTotalCents)}
        />
        {supplyFeeLabel !== null && (
          <StatementRow
            label={supplyFeeLabel}
            value={`− ${formatUsd(statement.supplyFeeCents)}`}
          />
        )}
        <StatementRow label={shareLabel} value={formatUsd(statement.shareCents)} />
        <StatementRow label={t(locale, 'cardTips')} value={formatUsd(statement.cardTipsCents)} />
        {endRules.cardTipFeeBp > 0 && (
          <StatementRow
            label={tf(locale, 'statementCardTipFee', {
              rate: formatRate(endRules.cardTipFeeBp),
            })}
            value={`− ${formatUsd(statement.cardTipFeeCents)}`}
          />
        )}
        {statement.cashTipsHeldCents > 0 && (
          <StatementRow
            label={t(locale, 'cashTipsSalonHolds')}
            value={formatUsd(statement.cashTipsHeldCents)}
          />
        )}
        {statement.adjustmentsCents !== 0 && (
          <StatementRow
            label={t(locale, 'adjustments')}
            value={formatUsd(statement.adjustmentsCents)}
          />
        )}

        <div className="my-1 border-t-2 border-text" />

        <StatementRow
          label={t(locale, 'salonShouldPay')}
          value={formatUsd(statement.salonPaysCents)}
          strong
          large
        />
        {checkBp !== null && cashBp !== null && (
          <>
            <StatementRow
              label={tf(locale, 'statementAsCheck', { rate: formatRate(checkBp) })}
              value={formatUsd(statement.checkCents ?? 0)}
              indent
            />
            <StatementRow
              label={tf(locale, 'statementAsCash', { rate: formatRate(cashBp) })}
              value={formatUsd(statement.cashCents ?? 0)}
              indent
            />
          </>
        )}
        {statement.cashTipsInHandCents > 0 && (
          <StatementRow
            label={t(locale, 'cashTipsAlreadyHave')}
            value={formatUsd(statement.cashTipsInHandCents)}
          />
        )}
        <StatementRow
          label={t(locale, 'earnedInTotal')}
          value={formatUsd(statement.earnedTotalCents)}
        />
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
        className={`shrink-0 tabular-nums${strong ? ' font-semibold' : ''}${
          large ? ' text-lg font-bold' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
