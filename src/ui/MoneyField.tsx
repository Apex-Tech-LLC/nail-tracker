import { useId, useRef, type FocusEvent, type RefObject } from 'react'
import { padTypedRecently } from './NumberPad.tsx'
import { errorText, field, label } from './styles.ts'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  autoFocus?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  inputMode?: 'decimal' | 'text'
  usePad?: boolean
  active?: boolean
  padTarget?: string
  onFieldFocus?: (element: HTMLInputElement) => void
  onFieldBlur?: (event: FocusEvent<HTMLInputElement>) => void
}

export function MoneyField({
  label: labelText,
  value,
  onChange,
  error,
  autoFocus,
  inputRef,
  inputMode = 'decimal',
  usePad = false,
  active = false,
  padTarget,
  onFieldFocus,
  onFieldBlur,
}: Props) {
  const id = useId()
  // Set while the box takes focus back, so that is not a fresh tap on it.
  const refocusing = useRef(false)
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
          inputMode={usePad ? 'none' : inputMode}
          autoComplete="off"
          autoFocus={autoFocus}
          data-pad-target={usePad ? padTarget : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            if (refocusing.current) {
              refocusing.current = false
              return
            }
            onFieldFocus?.(event.currentTarget)
          }}
          onBlur={(event) => {
            // Focus lost to nowhere right after a pad key: keep typing here.
            if (usePad && event.relatedTarget === null && padTypedRecently()) {
              refocusing.current = true
              event.currentTarget.focus({ preventScroll: true })
              refocusing.current = false
              return
            }
            onFieldBlur?.(event)
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${field} pl-7 ${
            usePad && active ? 'border-b-2 border-b-brand-ink' : ''
          }`}
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
