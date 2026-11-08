import { IconTrash } from '@tabler/icons-react'
import type { FocusEvent, RefObject } from 'react'
import type { ServicePreset } from '../../db/schema.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { PercentField } from '../../ui/PercentField.tsx'
import { errorText, field, label } from '../../ui/styles.ts'

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
  // A new turn starts on the last service used. Until a price is typed, that
  // is only a guess, and the first chip tapped replaces it.
  guess?: boolean
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
  errors?: LineErrors
  amountRef?: RefObject<HTMLInputElement | null>
  autoFocus?: boolean
  usePad?: boolean
  activePad?: boolean
  onAmountFocus?: (element: HTMLInputElement) => void
  onAmountBlur?: (event: FocusEvent<HTMLInputElement>) => void
  onCustomName: (value: string) => void
  onAmount: (value: string) => void
  onRate: (value: string) => void
  onRemove: () => void
}

/** One service on the turn: its name, amount and (sometimes) rate. */
export function ServiceLineFields({
  line,
  presets,
  locale,
  showPerLine,
  errors,
  amountRef,
  autoFocus,
  usePad,
  activePad,
  onAmountFocus,
  onAmountBlur,
  onCustomName,
  onAmount,
  onRate,
  onRemove,
}: Props) {
  const nameId = `${line.key}-service-name`
  const preset = presets.find((item) => item.id === line.choice)

  return (
    <div data-testid="service-line" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        {preset ? (
          <h2 className="min-w-0 flex-1 text-sm font-medium">
            {locale === 'vi' ? preset.nameVi : preset.nameEn}
          </h2>
        ) : (
          <div className="min-w-0 flex-1">
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
        <button
          type="button"
          aria-label={t(locale, 'removeService')}
          onClick={onRemove}
          className="flex min-h-11 min-w-11 items-center justify-center"
        >
          <IconTrash size={18} aria-hidden="true" />
        </button>
      </div>

      <MoneyField
        label={t(locale, 'serviceAmount')}
        value={line.amount}
        onChange={onAmount}
        error={errors?.amount}
        inputRef={amountRef}
        autoFocus={autoFocus}
        usePad={usePad}
        active={activePad}
        padTarget={`line:${line.key}`}
        onFieldFocus={onAmountFocus}
        onFieldBlur={onAmountBlur}
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
