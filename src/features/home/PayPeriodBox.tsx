import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { addDays, formatRange, type IsoDate } from '../../domain/dates.ts'
import type { DateSpan } from '../../domain/payPeriods.ts'
import { t } from '../../lib/i18n.ts'
import { useToast } from '../../ui/useToast.ts'
import { choosePaySchedule, setPayAnchor } from '../payday/paySchedule.ts'
import { ChartBox, MonthGrid } from './HomeCharts.tsx'

const SETUP_BUTTON =
  'min-h-14 rounded-button bg-brand-600 px-2 py-2 text-base font-bold leading-tight text-white focus-visible:outline-2 focus-visible:outline-brand-ink'
const LINK = 'inline-flex min-h-11 items-center text-sm font-semibold text-brand-ink underline'

/**
 * The Pay period chip's box. With a period it is that period's calendar and,
 * for a two-week schedule, a one-tap Move a week. Without one it asks how often
 * the technician is paid, and a tap saves the schedule.
 */
export function PayPeriodBox({
  today,
  current,
  earnedByDate,
  offDates,
}: {
  today: IsoDate
  current: DateSpan | null
  earnedByDate: ReadonlyMap<IsoDate, number>
  offDates: ReadonlySet<IsoDate>
}) {
  const { locale, payPeriodType, payPeriodAnchorDate } = useSettings()
  const toast = useToast()

  function moveWeek() {
    if (payPeriodAnchorDate === null) return
    void setPayAnchor(addDays(payPeriodAnchorDate, -7), today)
    toast.show({
      message: t(locale, 'payMovedWeek'),
      actions: [
        {
          label: t(locale, 'undo'),
          onClick: () => void setPayAnchor(payPeriodAnchorDate, today),
        },
      ],
    })
  }

  const change = (
    <Link href={paths.settings} className={`${LINK} ml-auto`}>
      {t(locale, 'payChange')}
    </Link>
  )

  if (current !== null) {
    return (
      <ChartBox
        testId="pay-chart-box"
        title={formatRange(current.startDate, current.endDate, locale)}
        hint={t(locale, 'chartTapDay')}
        footer={
          <>
            {payPeriodType === 'biweekly' && payPeriodAnchorDate !== null && (
              <button
                type="button"
                onClick={moveWeek}
                className="min-h-11 rounded-control px-1 text-sm font-semibold text-brand-ink"
              >
                {t(locale, 'payMoveWeek')}
              </button>
            )}
            {change}
          </>
        }
      >
        <MonthGrid
          today={today}
          start={current.startDate}
          end={current.endDate}
          locale={locale}
          earnedByDate={earnedByDate}
          offDates={offDates}
        />
      </ChartBox>
    )
  }

  if (payPeriodType === 'custom') {
    return (
      <ChartBox
        testId="pay-chart-box"
        title={t(locale, 'payPeriod')}
        hint=""
        footer={change}
      >
        <div className="m-auto flex flex-col items-center gap-1 px-6 text-center">
          <p className="text-[15px] text-text-secondary">{t(locale, 'payNoPeriodToday')}</p>
          <Link href={paths.payday} className={LINK}>
            {t(locale, 'addCustomPeriod')}
          </Link>
        </div>
      </ChartBox>
    )
  }

  return (
    <ChartBox
      testId="pay-chart-box"
      title={t(locale, 'payPeriod')}
      hint=""
      footer={
        <Link href={paths.settings} className={LINK}>
          {t(locale, 'paySetupOther')}
        </Link>
      }
    >
      <div className="m-auto flex w-full flex-col gap-3 px-2">
        <p className="text-center text-[17px] font-bold">{t(locale, 'paySetupQuestion')}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void choosePaySchedule('weekly', today)}
            className={SETUP_BUTTON}
          >
            {t(locale, 'scheduleWeekly')}
          </button>
          <button
            type="button"
            onClick={() => void choosePaySchedule('biweekly', today)}
            className={SETUP_BUTTON}
          >
            {t(locale, 'scheduleBiweekly')}
          </button>
        </div>
      </div>
    </ChartBox>
  )
}
