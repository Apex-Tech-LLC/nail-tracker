import { useId } from 'react'
import { errorText, field, label } from './styles.ts'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}

export function PercentField({ label: labelText, value, onChange, error }: Props) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={label}>
        {labelText}
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-secondary"
        >
          %
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${field} pr-7`}
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
