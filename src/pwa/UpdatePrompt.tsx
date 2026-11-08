import { IconRefresh } from '@tabler/icons-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettings } from '../app/settings.ts'
import { t } from '../lib/i18n.ts'

// Long-open tabs (an installed app can stay open for days) check hourly.
const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Registers the service worker and, when a new version has downloaded,
 * offers to reload. Nothing reloads on its own: an automatic reload could
 * wipe a half-filled form, so the user picks the moment.
 */
export function UpdatePrompt({ visible }: { visible: boolean }) {
  const { locale } = useSettings()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {})
      }, UPDATE_CHECK_MS)
    },
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })

  if (!needRefresh || !visible) return null

  return (
    <div className="flex items-center gap-2 rounded-card border border-brand-400 bg-brand-50 p-3 text-sm text-brand-ink-strong">
      <IconRefresh size={18} aria-hidden="true" className="flex-none text-brand-ink" />
      <span className="flex-1">{t(locale, 'updateReady')}</span>
      <button type="button" onClick={() => setNeedRefresh(false)} className="px-2 py-1 text-xs text-brand-ink-strong">
        {t(locale, 'later')}
      </button>
      {/* Activates the waiting worker; the page reloads once it takes over. */}
      <button type="button" onClick={() => updateServiceWorker()} className="rounded-control bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
        {t(locale, 'reload')}
      </button>
    </div>
  )
}
