import { useId, type RefObject } from 'react'
import { errorText, field, label } from './styles.ts'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  autoFocus?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  inputMode?: 'decimal' | 'text'
}

export function MoneyField({
  label: labelText,
  value,
  onChange,
  error,
  autoFocus,
  inputRef,
  inputMode = 'decimal',
}: Props) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={label}>
        {labelText}
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-secondary"
        >
          $
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${field} pl-7`}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className={errorText}>
          {error}
        </p>
      )}
    </div>
  )
}
