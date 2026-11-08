import { useCallback } from 'react'
import { useLocation } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'

// Routes live in the URL hash (#/add). GitHub Pages has no fallback to
// index.html for unknown paths, so /nail-tracker/add would 404 on a first visit
// or reload; /nail-tracker/#/add always loads the app.
export const paths = {
  today: '/',
  history: '/history',
  historyDay: (day: string) => `/history?day=${day}`,
  earnings: '/earnings',
  payday: '/payday',
  settings: '/settings',
  add: '/add',
  edit: (id: string) => `/edit/${id}`,
  copy: (id: string) => `/copy/${id}`,
  adjustmentNew: '/adjustment/new',
  adjustment: (id: string) => `/adjustment/${id}`,
  period: (id: string) => `/payday/${id}`,
  pay: (id: string) => `/payday/${id}/pay`,
  payment: (id: string) => `/payment/${id}`,
  services: '/settings/services',
  payRules: '/settings/pay',
  onboarding: '/onboarding',
} as const

let navigatedInApp = false

type HashNavigate = ReturnType<typeof useHashLocation>[1]

/**
 * wouter's hash hook, plus a note whenever the app pushed a new screen.
 * The router uses this hook, so a <Link>, Redirect or plain navigate all
 * count as an in-app step for useGoBack.
 */
export function useAppLocation(
  options?: Parameters<typeof useHashLocation>[0],
): [string, HashNavigate] {
  const [location, navigate] = useHashLocation(options)
  const navigateInApp = useCallback<HashNavigate>(
    (to, navOptions) => {
      if (!navOptions?.replace) navigatedInApp = true
      navigate(to, navOptions)
    },
    [navigate],
  )
  return [location, navigateInApp]
}

// wouter reads this off the hook so links render as "#/path". Without it
// they would render as "/path", which 404s on GitHub Pages.
useAppLocation.hrefs = (href: string) => '#' + href

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
