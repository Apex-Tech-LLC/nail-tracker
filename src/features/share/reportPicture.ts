import { formatMonthShortYear, formatRange, type DateLocale, type IsoDate } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { ReportData } from '../reports/reportsData.ts'
import type { ReportChoice } from '../reports/reportsRange.ts'
import { changeText, previousLabel, rangeLabel } from '../reports/reportText.ts'
import type { ShareLayoutInput, ShareLine } from './shareLayout.ts'

interface ReportPictureInput {
  data: ReportData
  choice: ReportChoice
  date: IsoDate
  start: IsoDate
  end: IsoDate
  locale: DateLocale
}

/** The summary card, the trend bars and the top eight services, in the technician's language. */
export function reportPictureInput(input: ReportPictureInput): ShareLayoutInput {
  const { data, choice, date, start, end, locale } = input

  const title =
    choice === 'custom'
      ? formatRange(start, end, locale)
      : rangeLabel(choice, date, start, end, locale)

  const previousText =
    data.totals.earnedCents === 0 && data.previous.totals.turns === 0
      ? null
      : changeText(
          locale,
          data.previous.change.differenceCents,
          data.previous.change.percent,
          previousLabel(choice, locale),
        )
  const lastYearText =
    choice !== 'year' && data.lastYear.hasTurns
      ? changeText(
          locale,
          data.lastYear.change.differenceCents,
          data.lastYear.change.percent,
          formatMonthShortYear(data.lastYear.span.start, locale),
        )
      : null

  const summary: ShareLine[] = [
    { label: t(locale, 'totalEarned'), amount: formatUsd(data.totals.earnedCents), strong: true },
  ]
  if (previousText) summary.push({ label: previousText })
  if (lastYearText) summary.push({ label: lastYearText })
  summary.push(
    { label: t(locale, 'turns'), amount: String(data.totals.turns) },
    { label: t(locale, 'reportClients'), amount: String(data.totals.customers) },
    { label: t(locale, 'homeTips'), amount: formatUsd(data.totals.tipsCents) },
  )

  const services: ShareLine[] = data.serviceLines.slice(0, 8).map((line) => ({
    label: line.name,
    sub: `${tf(locale, 'reportServiceMeta', {
      count: line.count,
      price: formatUsd(line.priceCents),
      share: formatUsd(line.shareCents),
    })} · ${tf(locale, 'reportServiceAvg', { amount: formatUsd(line.averageCents) })}`,
  }))

  const sections: ShareLayoutInput['sections'] = [
    { heading: t(locale, 'reportSummaryTitle'), lines: summary },
  ]
  if (services.length > 0) {
    sections.push({ heading: t(locale, 'reportByService'), lines: services })
  }

  return {
    title,
    sections,
    bars: {
      heading: t(locale, 'reportTrend'),
      height: 300,
      bars: data.bars.map((bar, index) => ({
        label: bar.label,
        value: bar.earnedCents,
        current: index === data.currentBarIndex,
      })),
    },
    footer: t(locale, 'madeWithNailTracker'),
  }
}
