import { IconWifiOff } from '@tabler/icons-react'
import { useSettings } from '../app/settings.ts'
import { t } from '../lib/i18n.ts'
import { useOnline } from './useOnline.ts'

/**
 * Shown while offline. It reassures rather than warns: everything keeps
 * working, so the color is the soft warning tint and the tooltip says so.
 * The wrapper is always mounted so screen readers announce the change.
 */
export function OfflineBadge() {
  const { locale } = useSettings()
  const online = useOnline()

  return (
    <span role="status">
      {!online && (
        <span
          title={t(locale, 'offlineHint')}
          className="flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs text-warning-text"
        >
          <IconWifiOff size={14} aria-hidden="true" />
          {t(locale, 'offline')}
          <span className="sr-only">. {t(locale, 'offlineHint')}</span>
        </span>
      )}
    </span>
  )
}
