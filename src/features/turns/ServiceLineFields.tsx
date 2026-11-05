import { IconTrash } from '@tabler/icons-react'
import type { RefObject } from 'react'
import type { ServicePreset } from '../../db/schema.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { PercentField } from '../../ui/PercentField.tsx'
import { chip, chipOff, chipOn, errorText, field, label } from '../../ui/styles.ts'

export interface LineState {
  key: string
  choice: string
  customName: string
  amount: string
  rate: string
  rateTouched: boolean
  // What the saved line was, so editing a tip does not rewrite a saved name.
  originalChoice: string
  originalName: string
}

export interface LineErrors {
  amount?: string
  rate?: string
  serviceName?: string
}

interface Props {
  line: LineState
  presets: ServicePreset[]
  locale: Locale
  showPerLine: boolean
  canRemove: boolean
  errors?: LineErrors
  amountRef?: RefObject<HTMLInputElement | null>
  autoFocus?: boolean
  onChoose: (choice: string) => void
  onCustomName: (value: string) => void
  onAmount: (value: string) => void
  onRate: (value: string) => void
  onRemove: () => void
}

/** One service on the turn: its chips, optional custom name, amount and (sometimes) rate. */
export function ServiceLineFields({
  line,
  presets,
  locale,
  showPerLine,
  canRemove,
  errors,
  amountRef,
  autoFocus,
  onChoose,
  onCustomName,
  onAmount,
  onRate,
  onRemove,
}: Props) {
  const nameId = `${line.key}-service-name`

  return (
    <div data-testid="service-line" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className={label}>{t(locale, 'service')}</p>
        {canRemove && (
          <button
            type="button"
            aria-label={t(locale, 'removeService')}
            onClick={onRemove}
            className="p-1"
          >
            <IconTrash size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={line.choice === preset.id}
            className={`${chip} ${line.choice === preset.id ? chipOn : chipOff}`}
            onClick={() => onChoose(preset.id)}
          >
            {locale === 'vi' ? preset.nameVi : preset.nameEn}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={line.choice === 'other'}
          className={`${chip} ${line.choice === 'other' ? chipOn : chipOff}`}
          onClick={() => onChoose('other')}
        >
          {t(locale, 'presetOther')}
        </button>
      </div>

      {line.choice === 'other' && (
        <div>
          <label htmlFor={nameId} className={label}>
            {t(locale, 'serviceName')}
          </label>
          <input
            id={nameId}
            type="text"
            autoComplete="off"
            value={line.customName}
            onChange={(event) => onCustomName(event.target.value)}
            aria-invalid={!!errors?.serviceName}
            aria-describedby={errors?.serviceName ? `${nameId}-error` : undefined}
            className={field}
          />
          {errors?.serviceName && (
            <p id={`${nameId}-error`} className={errorText}>
              {errors.serviceName}
            </p>
          )}
        </div>
      )}

      <MoneyField
        label={t(locale, 'serviceAmount')}
        value={line.amount}
        onChange={onAmount}
        error={errors?.amount}
        inputRef={amountRef}
        autoFocus={autoFocus}
      />

      {showPerLine && (
        <PercentField
          label={t(locale, 'commissionPercent')}
          value={line.rate}
          onChange={onRate}
          error={errors?.rate}
        />
      )}
    </div>
  )
}
