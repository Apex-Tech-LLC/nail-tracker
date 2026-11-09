import { IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'
import { primaryButton } from '../../ui/styles.ts'

interface Props {
  title: string
  /** Unique per sheet: the dialog is named by it. */
  titleId: string
  onClose: () => void
  /** Where focus goes when nothing in the page had it before the sheet opened (the first time). */
  fallbackFocus: RefObject<HTMLElement | null>
  /** When set, a big button with these words closes the sheet too. */
  closeLabel?: string
  children: ReactNode
}

/**
 * A small bottom sheet on the Say screen. Any way of closing it (a button inside, the X,
 * Escape, a tap outside) calls onClose and hands focus back to whatever had it before the
 * sheet opened.
 */
export function SayBottomSheet({ title, titleId, onClose, fallbackFocus, closeLabel, children }: Props) {
  const { locale } = useSettings()
  const heading = useRef<HTMLHeadingElement | null>(null)
  const [opener] = useState(() => document.activeElement)
  const close = useRef(() => {})

  const closeSheet = useCallback(() => close.current(), [])

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
    heading.current?.focus()

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
    <div className="fixed inset-0 z-50" onClick={closeSheet}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-4 bottom-4 flex max-h-[85vh] flex-col gap-3 overflow-y-auto rounded-card border border-border bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} ref={heading} tabIndex={-1} className="pt-2.5 text-base font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={closeSheet}
            aria-label={t(locale, 'close')}
            className="-mr-2 -mt-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-brand-ink"
          >
            <IconX size={22} aria-hidden="true" />
          </button>
        </div>
        {children}
        {closeLabel && (
          <button type="button" className={primaryButton} onClick={closeSheet}>
            {closeLabel}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
