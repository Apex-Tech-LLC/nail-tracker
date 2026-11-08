import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'
import { chip, chipOff, chipOn, label, secondaryButton } from '../../ui/styles.ts'
import type { ClientFilter, Filters, TipFilter } from './historyRange.ts'

interface Props {
  filters: Filters
  serviceOptions: string[]
  onChange: (filters: Filters) => void
  onClose: () => void
}

function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function ToggleChip({
  on,
  label: text,
  onClick,
}: {
  on: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`${chip} ${on ? chipOn : chipOff}`}
    >
      {text}
    </button>
  )
}

/** A small bottom sheet with every filter chip; any combination may be on. */
export function FilterSheet({ filters, serviceOptions, onChange, onClose }: Props) {
  const { locale } = useSettings()
  const firstButton = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    firstButton.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function toggleClient(type: ClientFilter) {
    onChange({ ...filters, clients: toggle(filters.clients, type) })
  }

  function toggleTip(type: TipFilter) {
    onChange({ ...filters, tips: toggle(filters.tips, type) })
  }

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(locale, 'filterTitle')}
        className="absolute inset-x-4 bottom-4 flex max-h-[80vh] flex-col gap-3 overflow-y-auto rounded-card border border-border bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 ref={firstButton} tabIndex={-1} className="text-base font-bold">
          {t(locale, 'filterTitle')}
        </h2>

        {serviceOptions.length > 0 && (
          <section>
            <p className={label}>{t(locale, 'filterService')}</p>
            <div className="flex flex-wrap gap-2">
              {serviceOptions.map((name) => (
                <ToggleChip
                  key={name}
                  on={filters.services.includes(name)}
                  label={name}
                  onClick={() =>
                    onChange({ ...filters, services: toggle(filters.services, name) })
                  }
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <p className={label}>{t(locale, 'filterClient')}</p>
          <div className="flex flex-wrap gap-2">
            <ToggleChip
              on={filters.clients.includes('request')}
              label={t(locale, 'clientRequest')}
              onClick={() => toggleClient('request')}
            />
            <ToggleChip
              on={filters.clients.includes('walkIn')}
              label={t(locale, 'clientWalkIn')}
              onClick={() => toggleClient('walkIn')}
            />
          </div>
        </section>

        <section>
          <p className={label}>{t(locale, 'filterTips')}</p>
          <div className="flex flex-wrap gap-2">
            <ToggleChip
              on={filters.tips.includes('cash')}
              label={t(locale, 'cashTip')}
              onClick={() => toggleTip('cash')}
            />
            <ToggleChip
              on={filters.tips.includes('card')}
              label={t(locale, 'cardTip')}
              onClick={() => toggleTip('card')}
            />
            <ToggleChip
              on={filters.tips.includes('none')}
              label={t(locale, 'filterNoTip')}
              onClick={() => toggleTip('none')}
            />
          </div>
        </section>

        <section>
          <ToggleChip
            on={filters.hasNote}
            label={t(locale, 'filterHasNote')}
            onClick={() => onChange({ ...filters, hasNote: !filters.hasNote })}
          />
        </section>

        <button type="button" className={secondaryButton} onClick={onClose}>
          {t(locale, 'close')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
