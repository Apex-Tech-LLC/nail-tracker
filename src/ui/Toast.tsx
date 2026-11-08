import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { paths } from '../app/navigation.ts'
import { ToastContext, type ToastOptions } from './useToast.ts'

const TAB_PATHS: string[] = [
  paths.today,
  paths.history,
  paths.earnings,
  paths.payday,
  paths.settings,
]

const VISIBLE_MS = 6000

/** One bar at a time, above the bottom bar on a tab screen and near the bottom elsewhere. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null)
  const nextId = useRef(0)
  const timer = useRef<number | null>(null)
  const [location] = useLocation()
  const onTab = TAB_PATHS.includes(location)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [clearTimer])

  const show = useCallback(
    (options: ToastOptions) => {
      clearTimer()
      const id = nextId.current + 1
      nextId.current = id
      setToast({ ...options, id })
      timer.current = window.setTimeout(() => {
        timer.current = null
        setToast((current) => (current?.id === id ? null : current))
      }, VISIBLE_MS)
    },
    [clearTimer],
  )

  useEffect(() => clearTimer, [clearTimer])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-50 flex items-center justify-between gap-3 rounded-[14px] bg-inverse px-4 py-[13px] text-sm text-on-inverse"
          style={{
            left: 16,
            right: 16,
            bottom: onTab ? 'calc(96px + env(safe-area-inset-bottom))' : '16px',
            animation: 'toast-in 180ms ease-out',
          }}
        >
          <span>{toast.message}</span>
          {toast.actions && toast.actions.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {toast.actions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  className="min-h-11 rounded-control px-3 text-sm font-bold text-toast-link"
                  onClick={() => {
                    dismiss()
                    action.onClick()
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}
