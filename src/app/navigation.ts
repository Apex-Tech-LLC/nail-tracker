import { useCallback } from 'react'
import { useLocation } from 'wouter'

// Routes live in the URL hash (#/add). GitHub Pages has no fallback to
// index.html for unknown paths, so /daftar/add would 404 on a first visit
// or reload; /daftar/#/add always loads the app.
export const paths = {
  list: '/',
  add: '/add',
  edit: (id: string) => `/edit/${id}`,
  summary: '/summary',
  settings: '/settings',
} as const

let navigatedInApp = false

/** Navigates and remembers that the history now has an in-app entry to go back to. */
export function useNavigate() {
  const [, navigate] = useLocation()
  return useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (!options?.replace) navigatedInApp = true
      navigate(to, options)
    },
    [navigate],
  )
}

/**
 * Closes a screen like the phone's Back button would. If the app was opened
 * straight on this screen there is nothing to go back to, so it replaces
 * the entry with the list instead of leaving the app.
 */
export function useGoBack() {
  const [, navigate] = useLocation()
  return useCallback(() => {
    if (navigatedInApp) history.back()
    else navigate(paths.list, { replace: true })
  }, [navigate])
}
