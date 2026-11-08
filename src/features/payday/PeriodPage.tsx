import { IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { formatDayShort, formatRange } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'
import { Row } from '../../ui/Row.tsx'
import {
  card,
  dangerButton,
  errorText,
  primaryButton,
  secondaryButton,
} from '../../ui/styles.ts'
import { PAYMENT_METHOD_LABEL, PAY_STATE_COLOR, PAY_STATE_LABEL } from './payStateLabels.ts'
import { loadPaymentsForPeriod } from './paymentStore.ts'
import { deletePeriod, loadPeriodSummaries, setPeriodStatus } from './periodStore.ts'

interface Props {
  periodId: string
  onDone: () => void
}

export function PeriodPage({ periodId, onDone }: Props) {
  const { locale, payPeriodType } = useSettings()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteBlocked, setDeleteBlocked] = useState(false)

  const summary = useLiveQuery(async () => {
    const all = await loadPeriodSummaries(db)
    return all.find((item) => item.period.id === periodId) ?? null
  }, [periodId])

  const payments = useLiveQuery(
    () => loadPaymentsForPeriod(db, periodId),
    [periodId],
  )

  if (summary === undefined || payments === undefined) return null

  if (summary === null) {
    return (
      <>
        <p>{t(locale, 'entryNotFound')}</p>
        <Link href={paths.payday} replace className="text-brand-600 underline">
          {t(locale, 'paydayTitle')}
        </Link>
      </>
    )
  }

  const { period, totals, statement, paidCents, outstandingCents, state } = summary
  const open = period.status === 'open'

  async function toggleStatus(): Promise<void> {
    await setPeriodStatus(db, periodId, open ? 'closed' : 'open')
  }

  async function confirmDelete(): Promise<void> {
    const deleted = await deletePeriod(db, periodId)
    if (deleted) {
      onDone()
      return
    }
    setConfirmingDelete(false)
    setDeleteBlocked(true)
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDone}
          aria-label={t(locale, 'close')}
          className="flex min-h-11 min-w-11 items-center justify-center"
        >
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-medium">
          {formatRange(period.startDate, period.endDate, locale)}
        </h1>
        <span className="shrink-0 rounded-full border border-border-strong px-2 py-0.5 text-xs">
          {t(locale, open ? 'statusOpen' : 'statusClosed')}
        </span>
      </header>

      <div className={card}>
        <h2 className="font-medium">{t(locale, 'earnedSection')}</h2>
        <Row
          label={t(locale, 'serviceCommission')}
          value={formatUsd(totals.commissionCents)}
        />
        <Row label={t(locale, 'cardTips')} value={formatUsd(totals.cardTipsCents)} />
        <Row label={t(locale, 'cashTips')} value={formatUsd(totals.cashTipsCents)} />
        {totals.adjustmentsCents !== 0 && (
          <Row
            label={t(locale, 'adjustments')}
            value={formatUsd(totals.adjustmentsCents)}
          />
        )}
        <Row label={t(locale, 'totalEarned')} value={formatUsd(totals.earnedCents)} strong />
      </div>

      <div className={card}>
        <h2 className="font-medium">{t(locale, 'receivedSection')}</h2>
        <Row
          label={t(locale, 'tipsAlreadyReceived')}
          value={formatUsd(totals.tipsInHandCents)}
        />
        <Row label={t(locale, 'salonPaid')} value={formatUsd(paidCents)} />
      </div>

      <div className={card}>
        <h2 className="font-medium">{t(locale, 'owedSection')}</h2>
        <Row
          label={t(locale, 'expectedPayout')}
          value={formatUsd(statement.salonPaysCents)}
        />
        <Row label={t(locale, 'salonPaid')} value={formatUsd(paidCents)} />
        {outstandingCents >= 0 ? (
          <div className={outstandingCents > 0 ? 'text-warning-text' : undefined}>
            <Row
              label={t(locale, 'outstanding')}
              value={formatUsd(outstandingCents)}
              strong
            />
          </div>
        ) : (
          <p className="py-1 text-right font-semibold text-danger-text">
            {tf(locale, 'overpaidBy', { amount: formatUsd(-outstandingCents) })}
          </p>
        )}
        <p className={`mt-1 text-sm ${PAY_STATE_COLOR[state]}`}>
          {t(locale, PAY_STATE_LABEL[state])}
        </p>
      </div>

      <Link href={paths.pay(periodId)} className={`${primaryButton} block text-center`}>
        {t(locale, 'recordPayment')}
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t(locale, 'payments')}</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-text-secondary">{t(locale, 'noPayments')}</p>
        ) : (
          payments.map(({ payment, allocatedCents }) => (
            <Link
              key={payment.id}
              href={paths.payment(payment.id)}
              className={`${card} flex items-center justify-between gap-2`}
            >
              <span className="min-w-0">
                {formatDayShort(payment.paymentDate, locale)} ·{' '}
                {t(locale, PAYMENT_METHOD_LABEL[payment.paymentMethod])}
              </span>
              <span className="shrink-0 text-right">
                <span className="block tabular-nums">{formatUsd(allocatedCents)}</span>
                {payment.amountCents > allocatedCents && (
                  <span className="block text-xs text-text-secondary">
                    {formatUsd(payment.amountCents)}
                  </span>
                )}
              </span>
            </Link>
          ))
        )}
      </section>

      <button type="button" onClick={() => void toggleStatus()} className={secondaryButton}>
        {t(locale, open ? 'closePeriod' : 'reopenPeriod')}
      </button>

      {payPeriodType === 'custom' && (
        <>
          <button
            type="button"
            onClick={() => {
              setDeleteBlocked(false)
              setConfirmingDelete(true)
            }}
            className={dangerButton}
          >
            {t(locale, 'deletePeriod')}
          </button>
          {deleteBlocked && <p className={errorText}>{t(locale, 'deletePeriodBlocked')}</p>}
          <ConfirmDialog
            open={confirmingDelete}
            title={t(locale, 'deletePeriodTitle')}
            body={t(locale, 'deletePeriodBody')}
            confirmLabel={t(locale, 'delete')}
            cancelLabel={t(locale, 'cancel')}
            danger
            onConfirm={confirmDelete}
            onCancel={() => setConfirmingDelete(false)}
          />
        </>
      )}
    </>
  )
}
