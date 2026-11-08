import { formatRange } from '../../domain/dates.ts'
import { formatUsd, formatUsdShort } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
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

/** The goal line sits at its true share of the tallest bar, with no minimum height. */
function goalHeightOf(goalCents: number, max: number): number {
  if (goalCents <= 0) return 0
  return Math.min(100, (goalCents / max) * 100)
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
  // The goal line must fit over the bars, so the scale includes it.
  const max = Math.max(1, ...bars.map((bar) => bar.earnedCents), goalCents ?? 0)
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
          <div className="relative" style={{ height: CHART_HEIGHT }}>
            <div
              role="group"
              aria-label={title}
              className="flex h-full items-end gap-1"
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
                  className="flex h-full min-w-0 flex-1 items-end justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-brand-ink"
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

            {goalCents !== null && goalCents > 0 && (
              <div
                data-testid="goal-line"
                className="pointer-events-none absolute inset-x-0"
                style={{ bottom: `${goalHeightOf(goalCents, max)}%` }}
              >
                <div aria-hidden="true" className="border-t border-dashed border-text-secondary" />
                <span className="absolute right-0 top-0.5 rounded-sm bg-surface px-1 text-[11px] font-semibold text-text-secondary">
                  {tf(locale, 'goalLine', { amount: formatUsdShort(goalCents) })}
                </span>
              </div>
            )}
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
                className="mt-1 min-h-11 font-semibold text-brand-ink underline"
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
