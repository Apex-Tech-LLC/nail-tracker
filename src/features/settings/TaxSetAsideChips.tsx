import { useLocation } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { todayIso, parseIsoDate } from '../../domain/dates.ts'
import { formatRate } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import { chip, chipOff, chipOn } from '../../ui/styles.ts'

const PRESET_BP = [null, 1500, 2000, 2500] as const

/**
 * One row of tax set-aside answers. A tap saves at once, the same setting the
 * Taxes page edits. A saved percent that is not on the row shows as its own
 * selected chip, which opens the Taxes page to change it.
 */
export function TaxSetAsideChips({ labelledBy }: { labelledBy: string }) {
  const { locale, taxSetAsideBp } = useSettings()
  const [, navigate] = useLocation()
  const other = taxSetAsideBp !== null && !PRESET_BP.includes(taxSetAsideBp as 1500)

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {PRESET_BP.map((bp) => (
        <button
          key={bp ?? 'off'}
          type="button"
          aria-pressed={taxSetAsideBp === bp}
          onClick={() => updateSettings({ taxSetAsideBp: bp })}
          className={`${chip} ${taxSetAsideBp === bp ? chipOn : chipOff}`}
        >
          {bp === null ? t(locale, 'taxSetAsideOff') : formatRate(bp)}
        </button>
      ))}
      {other && (
        <button
          type="button"
          aria-pressed="true"
          onClick={() => navigate(paths.taxes(parseIsoDate(todayIso()).year))}
          className={`${chip} ${chipOn}`}
        >
          {tf(locale, 'taxSetAsideOther', { rate: formatRate(taxSetAsideBp) })}
        </button>
      )}
    </div>
  )
}
