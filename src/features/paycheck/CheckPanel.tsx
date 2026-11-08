import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { formatDayShort, todayIso } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import type { CheckResult, Reason } from '../../domain/paycheckCheck.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { card, secondaryButton } from '../../ui/styles.ts'
import type { PeriodSummary } from '../payday/periodStore.ts'
import { setCheckedDate } from './paycheckStore.ts'

function reasonText(locale: Locale, reason: Reason): string {
  switch (reason.kind) {
    case 'servicesLess':
      return tf(locale, 'reasonServicesLess', { amount: formatUsd(reason.differenceCents) })
    case 'servicesMore':
      return tf(locale, 'reasonServicesMore', { amount: formatUsd(reason.differenceCents) })
    case 'deductionsMore':
      return tf(locale, 'reasonDeductionsMore', { amount: formatUsd(reason.differenceCents) })
    case 'deductionsLess':
      return tf(locale, 'reasonDeductionsLess', { amount: formatUsd(reason.differenceCents) })
    case 'cardTips':
      return tf(locale, 'reasonCardTips', {
        salon: formatUsd(reason.salonCents),
        yours: formatUsd(reason.yoursCents),
      })
    case 'partShort':
    case 'partOver': {
      const part = t(locale, reason.part === 'check' ? 'partCheck' : 'partCash')
      const other = t(locale, reason.part === 'check' ? 'partCash' : 'partCheck')
      const amount = formatUsd(reason.differenceCents)
      if (reason.otherPartMatches) {
        return tf(
          locale,
          reason.kind === 'partShort' ? 'reasonPartShortMatches' : 'reasonPartOverMatches',
          { part, other, amount },
        )
      }
      return tf(locale, reason.kind === 'partShort' ? 'reasonPartShort' : 'reasonPartOver', {
        part,
        amount,
      })
    }
  }
}

const BANNER: Record<CheckResult['kind'], string> = {
  matches: 'border-positive-text/30 bg-positive-bg text-positive-text',
  short: 'border-warning-text/30 bg-warning-bg text-warning-text',
  over: 'border-border bg-surface-subtle text-text',
}

function CheckBanner({ check }: { check: CheckResult }) {
  const { locale } = useSettings()
  const heading =
    check.kind === 'matches'
      ? t(locale, 'checkMatches')
      : tf(locale, check.kind === 'short' ? 'checkShort' : 'checkOver', {
          amount: formatUsd(check.differenceCents),
        })

  return (
    <div className={`rounded-card border p-4 ${BANNER[check.kind]}`}>
      <p className="text-lg font-bold">{heading}</p>
      {check.kind === 'over' && (
        <p className="mt-1 text-sm">
          {tf(locale, 'checkOverNote', { amount: formatUsd(check.differenceCents) })}
        </p>
      )}
      {check.reasons.length > 0 && (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
          {check.reasons.map((reason, index) => (
            <li key={`${reason.kind}-${index}`}>{reasonText(locale, reason)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface Props {
  summary: PeriodSummary
}

/** What the technician got, the check result, and the day it was checked. */
export function CheckPanel({ summary }: Props) {
  const { locale } = useSettings()
  const { period, check, record } = summary
  const checkedDate = record?.checkedDate ?? null

  async function toggleChecked(): Promise<void> {
    await setCheckedDate(db, period.id, checkedDate === null ? todayIso() : null)
  }

  return (
    <section className={`${card} flex flex-col gap-3`}>
      {check !== null && <CheckBanner check={check} />}

      <Link href={paths.record(period.id)} className={`${secondaryButton} block text-center`}>
        {t(locale, 'recordWhatYouGot')}
      </Link>

      {checkedDate === null ? (
        <button type="button" onClick={() => void toggleChecked()} className={secondaryButton}>
          {t(locale, 'markAsChecked')}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-positive-text">
            {tf(locale, 'checkedOn', { date: formatDayShort(checkedDate, locale) })}
          </p>
          <button
            type="button"
            onClick={() => void toggleChecked()}
            className="min-h-11 rounded-control px-3 text-sm font-semibold text-brand-600 underline"
          >
            {t(locale, 'uncheck')}
          </button>
        </div>
      )}
    </section>
  )
}
