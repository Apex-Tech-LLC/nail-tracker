import { IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../../app/settings.ts'
import { t, type StringKey } from '../../lib/i18n.ts'
import { primaryButton } from '../../ui/styles.ts'

interface Props {
  onClose: () => void
  /** Where focus goes when nothing in the page had it before the sheet opened (the first time). */
  fallbackFocus: RefObject<HTMLElement | null>
}

const STEPS: StringKey[] = [
  'sayHowToStep1',
  'sayHowToStep2',
  'sayHowToStep3',
  'sayHowToStep4',
  'sayHowToStep5',
  'sayHowToStep6',
]
const EXAMPLES: StringKey[] = ['sayHowToExample1', 'sayHowToExample2', 'sayHowToExample3']

/**
 * A small bottom sheet that shows how to use the Say screen. Any way of closing it
 * (Got it, the X, Escape, a tap outside) calls onClose and hands focus back to
 * whatever had it before the sheet opened.
 */
export function SayHowToSheet({ onClose, fallbackFocus }: Props) {
  const { locale } = useSettings()
  const title = useRef<HTMLHeadingElement | null>(null)
  const [opener] = useState(() => document.activeElement)
  const close = useRef(() => {})

  useEffect(() => {
    close.current = () => {
      onClose()
      const target =
        opener instanceof HTMLElement && opener !== document.body && opener.isConnected
          ? opener
          : fallbackFocus.current
      target?.focus()
    }
  })

  useEffect(() => {
    title.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={() => close.current()}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="say-how-to-title"
        className="absolute inset-x-4 bottom-4 flex max-h-[85vh] flex-col gap-3 overflow-y-auto rounded-card border border-border bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="say-how-to-title" ref={title} tabIndex={-1} className="pt-2.5 text-base font-bold">
            {t(locale, 'sayHowToTitle')}
          </h2>
          <button
            type="button"
            onClick={() => close.current()}
            aria-label={t(locale, 'close')}
            className="-mr-2 -mt-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-brand-ink"
          >
            <IconX size={22} aria-hidden="true" />
          </button>
        </div>

        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-snug marker:font-semibold marker:text-text-secondary">
          {STEPS.map((key) => (
            <li key={key} className="pl-1">
              {t(locale, key)}
            </li>
          ))}
        </ol>

        <ul className="flex flex-col gap-1.5 rounded-control border border-border bg-surface-subtle p-3 text-[15px] leading-snug text-text-secondary">
          {EXAMPLES.map((key) => (
            <li key={key}>{`“${t(locale, key)}”`}</li>
          ))}
        </ul>

        <button type="button" className={primaryButton} onClick={() => close.current()}>
          {t(locale, 'sayHowToGotIt')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
