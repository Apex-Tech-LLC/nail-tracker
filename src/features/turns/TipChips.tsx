import { updateSettings, useSettings } from '../../app/settings.ts'
import { formatUsdShort } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'

const TIP_VALUES = [500, 1000, 1500, 2000] as const

/**
 * The Cash/Card switch and the quick tip chips ($5 to $20, then 18% of the
 * services when `percentCents` is given). The switch is stored in the settings.
 * `pressedCents` is the tip now in the chosen box; tapping that chip again
 * hands the same amount back, and the screen empties the box.
 */
export function TipChips({
  percentCents,
  pressedCents,
  onPick,
}: {
  percentCents: number | null
  pressedCents: number | null
  onPick: (cents: number, percent: boolean) => void
}) {
  const { locale, tipButtonsTarget } = useSettings()
  const options = [
    ...TIP_VALUES.map((cents) => ({ label: formatUsdShort(cents), cents, percent: false })),
    ...(percentCents === null ? [] : [{ label: '18%', cents: percentCents, percent: true }]),
  ]

  return (
    <>
      <div className="flex overflow-hidden rounded-control border-[1.5px] border-border-strong">
        {(['cash', 'card'] as const).map((target) => (
          <button
            key={target}
            type="button"
            aria-pressed={tipButtonsTarget === target}
            onClick={() => updateSettings({ tipButtonsTarget: target })}
            className={`min-h-11 px-2.5 text-sm font-semibold ${
              tipButtonsTarget === target
                ? 'bg-brand-50 text-brand-ink-strong'
                : 'bg-surface text-text-secondary'
            }${target === 'cash' ? ' border-r-[1.5px] border-border-strong' : ''}`}
          >
            {t(locale, target === 'cash' ? 'methodCash' : 'methodCard')}
          </button>
        ))}
      </div>
      {options.map((option) => {
        const on = pressedCents === option.cents
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(option.cents, option.percent)}
            className={`min-h-11 min-w-11 rounded-control border-[1.5px] px-3 text-sm font-semibold ${
              on ? 'border-positive-text bg-positive-bg text-positive-text' : 'border-border bg-surface'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </>
  )
}
