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

let lastTypingPress = 0

/**
 * True just after a digit, dot or delete key. iPhone Safari can still take
 * focus off the money box after a key tap; the box uses this to take it back
 * instead of closing the pad, which made every tap start the amount over.
 */
export function padTypedRecently(): boolean {
  return performance.now() - lastTypingPress < 800
}

const KEY =
  'h-[52px] select-none rounded-[11px] bg-pad-key text-[22px] font-semibold text-text focus-visible:outline-2 focus-visible:outline-brand-ink'
const SIDE =
  'flex select-none items-center justify-center rounded-[11px] font-bold focus-visible:outline-2 focus-visible:outline-brand-ink'

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

  function type(event: PointerEvent<HTMLButtonElement>, action: () => void) {
    lastTypingPress = performance.now()
    tap(event, action)
  }

  // Next and Save may move focus on purpose, so they never count as typing.
  function move(event: PointerEvent<HTMLButtonElement>, action: () => void) {
    lastTypingPress = 0
    tap(event, action)
  }

  return (
    <div
      data-testid="number-pad"
      data-number-pad=""
      role="region"
      aria-label={t(locale, 'numberPad')}
      // Phones move focus on the mouse and touch events that follow a tap.
      onMouseDown={(event) => event.preventDefault()}
      onTouchEnd={(event) => event.preventDefault()}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-md grid-cols-[1fr_1fr_1fr_96px] auto-rows-[52px] gap-[7px] bg-pad-tray p-2 pb-[calc(26px+env(safe-area-inset-bottom))]"
    >
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          aria-label={digit}
          className={KEY}
          onPointerDown={(event) => type(event, () => onDigit(digit))}
        >
          {digit}
        </button>
      ))}
      <button
        type="button"
        aria-label={t(locale, 'decimalPoint')}
        className={KEY}
        onPointerDown={(event) => type(event, () => onDigit('.'))}
      >
        .
      </button>
      <button
        type="button"
        aria-label="0"
        className={KEY}
        onPointerDown={(event) => type(event, () => onDigit('0'))}
      >
        0
      </button>
      <button
        type="button"
        aria-label={t(locale, 'deleteLastDigit')}
        className={KEY}
        onPointerDown={(event) => type(event, onBackspace)}
      >
        ⌫
      </button>
      <button
        type="button"
        aria-label={t(locale, 'next')}
        style={{ gridColumn: 4, gridRow: '1 / span 2' }}
        className={`${SIDE} bg-inverse text-on-inverse text-[15px]`}
        onPointerDown={(event) => move(event, onNext)}
      >
        {t(locale, 'next')}
      </button>
      <button
        type="button"
        aria-label={t(locale, 'save')}
        style={{ gridColumn: 4, gridRow: '3 / span 2' }}
        className={`${SIDE} bg-brand-600 text-white text-[17px]`}
        onPointerDown={(event) => move(event, onSave)}
      >
        {t(locale, 'save')}
      </button>
    </div>
  )
}
