import { useEffect } from 'react'
import { Router, useLocation } from 'wouter'
import { UpdatePrompt } from '../pwa/UpdatePrompt.tsx'
import { BottomNav } from './BottomNav.tsx'
import { paths, useAppLocation } from './navigation.ts'
import { Routes } from './routes.tsx'
import { useSettings } from './settings.ts'

export default function App() {
  return (
    <Router hook={useAppLocation}>
      <Shell />
    </Router>
  )
}

const TAB_PATHS: string[] = [paths.today, paths.history, paths.earnings, paths.payday, paths.settings]

function Shell() {
  const [location, navigate] = useLocation()
  const { onboardingDone } = useSettings()
  const onTab = TAB_PATHS.includes(location)
  const onOnboarding = location === paths.onboarding

  useEffect(() => {
    if (!onboardingDone && !onOnboarding) navigate(paths.onboarding, { replace: true })
  }, [onboardingDone, onOnboarding, navigate])

  return (
    <>
      <main className={`mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 ${onTab ? 'pb-24' : ''}`}>
        {/* Mounted on every screen to keep the worker registered; shown only on the tabs, never over a form. */}
        <UpdatePrompt visible={onTab} />
        <Routes />
      </main>
      {/* Forms are a focused task: no tabs while one is open. */}
      {onTab && <BottomNav />}
    </>
  )
}
