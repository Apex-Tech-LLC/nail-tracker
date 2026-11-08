import { IconCalendarDollar, IconChartBar, IconHome, IconList, IconSettings, type Icon } from '@tabler/icons-react'
import { Link, useLocation } from 'wouter'
import { t, type StringKey } from '../lib/i18n.ts'
import { paths } from './navigation.ts'
import { useSettings } from './settings.ts'

const TABS: { path: string; label: StringKey; icon: Icon }[] = [
  { path: paths.today, label: 'navToday', icon: IconHome },
  { path: paths.history, label: 'navHistory', icon: IconList },
  { path: paths.earnings, label: 'navEarnings', icon: IconChartBar },
  { path: paths.payday, label: 'navPayday', icon: IconCalendarDollar },
  { path: paths.settings, label: 'navSettings', icon: IconSettings },
]

export function BottomNav() {
  const { locale } = useSettings()
  const [location] = useLocation()

  return (
    <nav
      aria-label={t(locale, 'mainNav')}
      className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ path, label, icon: TabIcon }) => {
          const active = location === path
          return (
            <li key={path} className="flex-1">
              <Link
                href={path}
                replace
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? 'text-brand-ink' : 'text-text-muted'}`}
              >
                <TabIcon size={24} stroke={active ? 2 : 1.5} aria-hidden="true" />
                {t(locale, label)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
