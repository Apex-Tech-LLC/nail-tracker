import type { PointerEvent } from 'react'
import { t } from '../lib/i18n.ts'
import type { Locale } from '../lib/locale.ts'

interface Props {
  locale: Locale
  onDigit: (digit: string) => void
  onBackspace: () => void
  onNext: () => void
  onSave: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

const KEY =
  'h-[52px] select-none rounded-[11px] bg-white text-[22px] font-semibold text-text focus-visible:outline-2 focus-visible:outline-brand-600'
const SIDE =
  'flex select-none items-center justify-center rounded-[11px] font-bold text-white focus-visible:outline-2 focus-visible:outline-brand-600'

/**
 * The app's own number pad. It sits over the bottom of the screen and types
 * into the money box that is active, so the phone's keyboard never opens and
 * the page does not jump.
 */
export function NumberPad({ locale, onDigit, onBackspace, onNext, onSave }: Props) {
  // Keep focus in the money box: without preventDefault the button takes it.
  function tap(event: PointerEvent<HTMLButtonElement>, action: () => void) {
    event.preventDefault()
    action()
  }

  return (
    <div
      data-testid="number-pad"
      data-number-pad=""
      role="region"
      aria-label={t(locale, 'numberPad')}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-md grid-cols-[1fr_1fr_1fr_96px] auto-rows-[52px] gap-[7px] bg-[#e7e1ea] p-2 pb-[calc(26px+env(safe-area-inset-bottom))]"
    >
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          aria-label={digit}
          className={KEY}
          onPointerDown={(event) => tap(event, () => onDigit(digit))}
        >
          {digit}
        </button>
      ))}
      <button
        type="button"
        aria-label={t(locale, 'decimalPoint')}
        className={KEY}
        onPointerDown={(event) => tap(event, () => onDigit('.'))}
      >
        .
      </button>
      <button
        type="button"
        aria-label="0"
        className={KEY}
        onPointerDown={(event) => tap(event, () => onDigit('0'))}
      >
        0
      </button>
      <button
        type="button"
        aria-label={t(locale, 'deleteLastDigit')}
        className={KEY}
        onPointerDown={(event) => tap(event, onBackspace)}
      >
        ⌫
      </button>
      <button
        type="button"
        aria-label={t(locale, 'next')}
        style={{ gridColumn: 4, gridRow: '1 / span 2' }}
        className={`${SIDE} bg-text text-[15px]`}
        onPointerDown={(event) => tap(event, onNext)}
      >
        {t(locale, 'next')}
      </button>
      <button
        type="button"
        aria-label={t(locale, 'save')}
        style={{ gridColumn: 4, gridRow: '3 / span 2' }}
        className={`${SIDE} bg-brand-600 text-[17px]`}
        onPointerDown={(event) => tap(event, onSave)}
      >
        {t(locale, 'save')}
      </button>
    </div>
  )
}
