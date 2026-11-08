import { formatRange } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import { useSettings } from '../../app/settings.ts'
import type { TrendPoint } from './reportsData.ts'

const CHART_HEIGHT = 128

interface Props {
  title: string
  bars: TrendPoint[]
  currentIndex: number
  selectedIndex: number | null
  onSelect: (index: number) => void
  onOpen: (bar: TrendPoint) => void
  /** V15 draws the goal line. Kept here so the chart shape does not change then. */
  goalCents?: number | null
}

function heightOf(value: number, max: number): number {
  if (value <= 0) return 0
  return Math.max((value / max) * 100, 3)
}

export function TrendChart({
  title,
  bars,
  currentIndex,
  selectedIndex,
  onSelect,
  onOpen,
  goalCents = null,
}: Props) {
  const { locale } = useSettings()
  const max = Math.max(1, ...bars.map((bar) => bar.earnedCents))
  const hasData = bars.some((bar) => bar.earnedCents > 0)
  const selected = selectedIndex === null ? null : bars[selectedIndex]

  return (
    <figure
      className="flex flex-col gap-2"
      data-goal-cents={goalCents === null ? undefined : goalCents}
    >
      <figcaption className="text-sm font-medium">{title}</figcaption>

      {hasData ? (
        <>
          <div
            role="group"
            aria-label={title}
            className="flex items-end gap-1"
            style={{ height: CHART_HEIGHT }}
            data-testid="trend-chart"
          >
            {bars.map((bar, index) => (
              <button
                key={bar.key}
                type="button"
                data-testid="trend-bar"
                aria-pressed={selectedIndex === index}
                aria-label={`${formatRange(bar.start, bar.end, locale)}: ${formatUsd(bar.earnedCents)}`}
                onClick={() => onSelect(index)}
                className="flex h-full min-w-0 flex-1 items-end justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <span
                  aria-hidden="true"
                  className="block w-full max-w-7 rounded-t"
                  style={{
                    height: `${heightOf(bar.earnedCents, max)}%`,
                    backgroundColor:
                      index === currentIndex ? 'var(--brand-600)' : 'var(--brand-200)',
                  }}
                />
              </button>
            ))}
          </div>

          <div className="flex justify-between text-xs text-text-muted" aria-hidden="true">
            <span>{bars[0]?.label}</span>
            <span>{bars[bars.length - 1]?.label}</span>
          </div>

          {selected && (
            <div data-testid="trend-detail" className="rounded-control bg-surface-subtle p-3 text-sm">
              <p className="font-medium">{formatRange(selected.start, selected.end, locale)}</p>
              <p className="tabular-nums">{formatUsd(selected.earnedCents)}</p>
              <button
                type="button"
                onClick={() => onOpen(selected)}
                className="mt-1 min-h-11 font-semibold text-brand-600 underline"
              >
                {t(locale, 'reportOpen')}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-text-secondary">{t(locale, 'chartNoData')}</p>
      )}
    </figure>
  )
}
