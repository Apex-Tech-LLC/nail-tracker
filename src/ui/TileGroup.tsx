import type { ReactNode } from 'react'
import type { Locale } from '../lib/locale.ts'

export interface TileOption<T extends string> {
  value: T
  glyph?: string
  label: string
  lang?: Locale
}

export function TileGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  stacked = false,
  compact = false,
}: {
  legend: string
  name: string
  value: T
  options: TileOption<T>[]
  onChange: (value: T) => void
  stacked?: boolean
  /** Short tiles with no glyph, two to a row, and the legend as a heading (first-time setup). */
  compact?: boolean
}): ReactNode {
  return (
    <fieldset>
      <legend className={`${compact ? 'mb-1' : 'mb-2'} text-xs text-text-secondary`}>
        {compact ? <h2 className="text-sm font-semibold text-text">{legend}</h2> : legend}
      </legend>
      <div className={compact ? (stacked ? 'flex flex-col gap-1.5' : 'grid grid-cols-2 gap-1.5') : stacked ? 'flex flex-col gap-2' : 'flex gap-2'}>
        {options.map((option) => {
          const on = option.value === value
          return (
            <label
              key={option.value}
              lang={option.lang}
              className={`flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-card border ${compact ? 'min-h-11 justify-center px-2 py-1 text-center' : 'p-3'} has-focus-visible:outline-2 has-focus-visible:outline-brand-ink ${on ? 'border-brand-ink bg-brand-50' : 'border-border-strong bg-surface'}`}
            >
              <input type="radio" name={name} value={option.value} checked={on} onChange={() => onChange(option.value)} className="sr-only" />
              {option.glyph !== undefined && (
                <span aria-hidden="true" className={`text-xl ${on ? 'text-brand-ink' : 'text-text-secondary'}`}>
                  {option.glyph}
                </span>
              )}
              <span className={`text-sm ${on ? 'text-brand-ink-strong' : ''}`}>{option.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
