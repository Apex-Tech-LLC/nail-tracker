import { IconArrowDown, IconArrowUp, IconPencil, IconPlus, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSettings } from '../../app/settings.ts'
import { db, type ServicePreset } from '../../db/schema.ts'
import { formatRate, formatUsd } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { card, pill, secondaryButton } from '../../ui/styles.ts'
import { PresetEditor } from './PresetEditor.tsx'
import { PriceSheet } from './PriceSheet.tsx'
import { movePreset, updatePreset } from './presetStore.ts'

function presetName(preset: ServicePreset, locale: Locale): string {
  return locale === 'vi' ? preset.nameVi : preset.nameEn
}

export function PresetsPage({ onDone }: { onDone: () => void }) {
  const { locale, numberPad } = useSettings()
  const [editing, setEditing] = useState<ServicePreset | 'new' | null>(null)
  const [pricing, setPricing] = useState<ServicePreset | null>(null)
  const presets = useLiveQuery(() =>
    db.servicePresets
      .orderBy('sortOrder')
      .filter((preset) => preset.isActive)
      .toArray(),
  )

  if (!presets) return null

  if (editing) {
    return (
      <PresetEditor
        preset={editing === 'new' ? null : editing}
        onDone={() => setEditing(null)}
      />
    )
  }

  return (
    <>
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDone}
          aria-label={t(locale, 'close')}
          className="flex min-h-11 min-w-11 items-center justify-center"
        >
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="font-medium">{t(locale, 'servicePresets')}</h1>
        <span className="w-11" />
      </header>

      <div className="flex flex-col gap-2">
        {presets.map((preset, index) => {
          const name = presetName(preset, locale)
          const priceText =
            preset.defaultPriceCents != null ? formatUsd(preset.defaultPriceCents) : null

          return (
            <div key={preset.id} className={`${card} flex items-center gap-2`}>
              <div className="min-w-0 flex-1">
                <p className="break-words">{name}</p>
                <div className="flex flex-wrap items-center gap-x-2 text-sm text-text-secondary">
                  {/* With the number pad off, the full editor is the only way to type a price. */}
                  <button
                    type="button"
                    aria-label={`${t(locale, priceText === null ? 'presetSetPrice' : 'presetChangePrice')}: ${name}${priceText === null ? '' : ` ${priceText}`}`}
                    onClick={() => (numberPad ? setPricing(preset) : setEditing(preset))}
                    className={`${pill} ${priceText === null ? 'text-brand-ink' : ''}`}
                  >
                    {priceText ?? t(locale, 'presetSetPrice')}
                  </button>
                  {preset.defaultCommissionRateBp != null && (
                    <span>{formatRate(preset.defaultCommissionRateBp)}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label={`${t(locale, 'moveUp')}: ${name}`}
                disabled={index === 0}
                onClick={() => void movePreset(db, preset.id, -1)}
                className="flex min-h-11 min-w-11 items-center justify-center p-1 disabled:opacity-40"
              >
                <IconArrowUp size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`${t(locale, 'moveDown')}: ${name}`}
                disabled={index === presets.length - 1}
                onClick={() => void movePreset(db, preset.id, 1)}
                className="flex min-h-11 min-w-11 items-center justify-center p-1 disabled:opacity-40"
              >
                <IconArrowDown size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`${t(locale, 'edit')}: ${name}`}
                onClick={() => setEditing(preset)}
                className="flex min-h-11 min-w-11 items-center justify-center p-1"
              >
                <IconPencil size={20} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setEditing('new')}
        className={`${secondaryButton} flex items-center justify-center gap-2`}
      >
        <IconPlus size={20} aria-hidden="true" />
        {t(locale, 'addPreset')}
      </button>

      {pricing && (
        <PriceSheet
          priceCents={pricing.defaultPriceCents ?? null}
          name={presetName(pricing, locale)}
          onSave={(cents) =>
            updatePreset(db, pricing.id, {
              nameEn: pricing.nameEn,
              nameVi: pricing.nameVi,
              defaultPriceCents: cents,
              defaultCommissionRateBp: pricing.defaultCommissionRateBp,
            })
          }
          onClose={() => setPricing(null)}
        />
      )}
    </>
  )
}
