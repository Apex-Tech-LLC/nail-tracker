import { useEffect, useId, useRef, type ReactNode } from 'react'
import { dangerButton, primaryButton, secondaryButton } from './styles.ts'

interface Props {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** A modal confirmation built on the native <dialog>, so Escape and focus work. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  confirmDisabled,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // The <dialog> cancel event (Escape) does not bubble, so listen directly.
  // Escape must go through onCancel instead of closing without the state update.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    function handleCancel(event: Event) {
      event.preventDefault()
      onCancel()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onCancel])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-card bg-surface p-4 text-text backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-lg font-medium">
        {title}
      </h2>
      <div className="mt-2 text-sm text-text-secondary">{body}</div>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className={`${danger ? dangerButton : primaryButton} disabled:opacity-50`}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {cancelLabel}
        </button>
      </div>
    </dialog>
  )
}
