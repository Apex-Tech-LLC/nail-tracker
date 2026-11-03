import { useEffect } from 'react'
import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'

const VISIBLE_MS = 6000

interface Props {
  onUndo: () => void
  onClose: () => void
}

/** "Expense deleted · Undo", gone after a few seconds. Render inside a live region. */
export function UndoToast({ onUndo, onClose }: Props) {
  const { locale } = useSettings()

  useEffect(() => {
    const timer = setTimeout(onClose, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className="fixed inset-x-4 bottom-24 mx-auto flex max-w-[calc(28rem-2rem)] items-center justify-between rounded-control bg-text px-4 py-3 text-sm text-surface shadow-lg"
    >
      <span>{t(locale, 'expenseDeleted')}</span>
      <button type="button" onClick={onUndo} className="font-medium text-brand-200">
        {t(locale, 'undo')}
      </button>
    </div>
  )
}
