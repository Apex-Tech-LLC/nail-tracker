import { useCallback } from 'react'
import { useLocation } from 'wouter'

// Routes live in the URL hash (#/add). GitHub Pages has no fallback to
// index.html for unknown paths, so /nail-tracker/add would 404 on a first visit
// or reload; /nail-tracker/#/add always loads the app.
export const paths = {
  today: '/',
  history: '/history',
  earnings: '/earnings',
  payday: '/payday',
  settings: '/settings',
  add: '/add',
  edit: (id: string) => `/edit/${id}`,
  adjustmentNew: '/adjustment/new',
  adjustment: (id: string) => `/adjustment/${id}`,
  period: (id: string) => `/payday/${id}`,
  pay: (id: string) => `/payday/${id}/pay`,
  payment: (id: string) => `/payment/${id}`,
  services: '/settings/services',
  onboarding: '/onboarding',
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
 * the entry with Today instead of leaving the app.
 */
export function useGoBack() {
  const [, navigate] = useLocation()
  return useCallback(() => {
    if (navigatedInApp) history.back()
    else navigate(paths.today, { replace: true })
  }, [navigate])
}
