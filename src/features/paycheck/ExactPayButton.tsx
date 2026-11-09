import { useRef } from 'react'
import { useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { todayIso } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import { primaryButton } from '../../ui/styles.ts'
import { useToast } from '../../ui/useToast.ts'
import type { PeriodSummary } from '../payday/periodStore.ts'
import {
  exactPaymentParts,
  recordExactPayment,
  undoExactPayment,
  type PeriodPaymentPart,
} from './paycheckStore.ts'

interface Props {
  summary: PeriodSummary
  /** Called once the payments are saved, for a screen that should close itself. */
  onRecorded?: () => void
}

/** "Got exactly this": records the statement's check and cash and marks the period checked. */
export function ExactPayButton({ summary, onRecorded }: Props) {
  const parts = exactPaymentParts(summary)
  if (parts === null) return null
  return <ExactPayTap periodId={summary.period.id} parts={parts} onRecorded={onRecorded} />
}

function ExactPayTap({
  periodId,
  parts,
  onRecorded,
}: {
  periodId: string
  parts: PeriodPaymentPart[]
  onRecorded?: () => void
}) {
  const { locale } = useSettings()
  const toast = useToast()
  // A quick double tap fires twice before the button can disappear.
  const inFlight = useRef(false)

  const check = parts.find((part) => part.method === 'check')
  const cash = parts.find((part) => part.method === 'cash')
  const text =
    check && cash
      ? tf(locale, 'gotExactlyBoth', {
          check: formatUsd(check.cents),
          cash: formatUsd(cash.cents),
        })
      : check
        ? tf(locale, 'gotExactlyCheck', { check: formatUsd(check.cents) })
        : tf(locale, 'gotExactlyCash', { cash: formatUsd(cash?.cents ?? 0) })

  async function record(): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    let ids: string[]
    try {
      ids = await recordExactPayment(db, periodId, todayIso(), parts)
    } catch (error) {
      inFlight.current = false
      throw error
    }
    toast.show({
      message: t(locale, 'exactRecorded'),
      actions: [
        {
          label: t(locale, 'undo'),
          onClick: () => void undoExactPayment(db, periodId, ids),
        },
      ],
    })
    onRecorded?.()
  }

  return (
    <button type="button" onClick={() => void record()} className={primaryButton}>
      {text}
    </button>
  )
}
