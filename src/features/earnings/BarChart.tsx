import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'
import { chartMax, type ChartBar } from './chartData.ts'

interface Props {
  title: string
  summary: string
  bars: ChartBar[]
  series: ('earned' | 'revenue')[]
}

const COLORS = {
  earned: 'var(--brand-600)',
  revenue: 'var(--brand-200)',
}

const LEGEND_KEYS = {
  earned: 'chartEarnedLegend',
  revenue: 'chartRevenueLegend',
} as const

/** Values are already in the cards above, so the SVG carries no numbers and needs no tooltip. */
function heightOf(value: number, max: number): number {
  if (value <= 0) return 0
  return Math.max((value / max) * 110, 2)
}

export function BarChart({ title, summary, bars, series }: Props) {
  const { locale } = useSettings()
  const max = chartMax(bars)
  const slot = bars.length === 0 ? 312 : 312 / bars.length
  // One series gets 70% of the slot; two sit side by side at 35% each.
  const barWidth = slot * (series.length === 2 ? 0.35 : 0.7)
  const left = 4 + slot * 0.15
  const labelEvery = bars.length > 12 ? Math.ceil(bars.length / 12) : 1

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <svg viewBox="0 0 320 140" role="img" aria-label={summary} className="w-full">
        {bars.map((bar, index) => (
          <g key={bar.key}>
            {series.map((name, seriesIndex) => {
              const height = heightOf(bar[name === 'earned' ? 'earnedCents' : 'revenueCents'], max)
              return (
                <rect
                  key={name}
                  x={left + index * slot + seriesIndex * barWidth}
                  y={118 - height}
                  width={barWidth}
                  height={height}
                  fill={COLORS[name]}
                />
              )
            })}
            {index % labelEvery === 0 && (
              <text
                x={left + index * slot + (slot * 0.7) / 2}
                y={134}
                fontSize="10"
                textAnchor="middle"
                fill="currentColor"
              >
                {bar.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {series.length === 2 && (
        <div className="flex gap-3 text-xs">
          {series.map((name) => (
            <span key={name} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: COLORS[name] }}
              />
              {t(locale, LEGEND_KEYS[name])}
            </span>
          ))}
        </div>
      )}
    </figure>
  )
}
