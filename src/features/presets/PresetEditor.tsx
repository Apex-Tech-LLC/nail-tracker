import { useId, useState, type FormEvent } from 'react'
import { useSettings } from '../../app/settings.ts'
import { db, type ServicePreset } from '../../db/schema.ts'
import { centsToInput, parseCents, parseRateBp, rateToInput } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { PercentField } from '../../ui/PercentField.tsx'
import {
  dangerButton,
  errorText,
  field,
  label,
  primaryButton,
  secondaryButton,
} from '../../ui/styles.ts'
import { addPreset, removePreset, updatePreset } from './presetStore.ts'

interface Errors {
  name?: string
  price?: string
  rate?: string
}

interface Props {
  preset: ServicePreset | null
  onDone: () => void
}

/** The add/edit form for one service preset, shown in place of the list. */
export function PresetEditor({ preset, onDone }: Props) {
  const { locale } = useSettings()
  const id = useId()
  const [nameEn, setNameEn] = useState(preset?.nameEn ?? '')
  const [nameVi, setNameVi] = useState(preset?.nameVi ?? '')
  const [price, setPrice] = useState(
    preset?.defaultPriceCents != null ? centsToInput(preset.defaultPriceCents) : '',
  )
  const [rate, setRate] = useState(
    preset?.defaultCommissionRateBp != null ? rateToInput(preset.defaultCommissionRateBp) : '',
  )
  const [errors, setErrors] = useState<Errors>({})
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  async function save(): Promise<void> {
    const trimmedEn = nameEn.trim()
    const trimmedVi = nameVi.trim()
    const priceText = price.trim()
    const rateText = rate.trim()
    const priceCents = priceText === '' ? null : parseCents(priceText)
    const rateBp = rateText === '' ? null : parseRateBp(rateText)

    const next: Errors = {}
    if (!trimmedEn && !trimmedVi) next.name = t(locale, 'errorServiceName')
    if (priceText !== '' && priceCents === null) next.price = t(locale, 'errorAmount')
    if (rateText !== '' && rateBp === null) next.rate = t(locale, 'errorRate')
    if (next.name || next.price || next.rate) {
      setErrors(next)
      return
    }

    const input = {
      // One language is enough: the other one copies it.
      nameEn: trimmedEn || trimmedVi,
      nameVi: trimmedVi || trimmedEn,
      defaultPriceCents: priceCents,
      defaultCommissionRateBp: rateBp,
    }

    if (preset) await updatePreset(db, preset.id, input)
    else await addPreset(db, input)
    onDone()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void save()
  }

  async function confirmRemove(): Promise<void> {
    if (!preset) return
    await removePreset(db, preset.id)
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-[calc(100dvh-2rem)] flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-medium">
          {t(locale, preset ? 'presetEditTitle' : 'addPreset')}
        </h1>
      </header>

      <div>
        <label htmlFor={`${id}-name-en`} className={label}>
          {t(locale, 'presetNameEn')}
        </label>
        <input
          id={`${id}-name-en`}
          type="text"
          autoComplete="off"
          value={nameEn}
          onChange={(event) => {
            setNameEn(event.target.value)
            setErrors((previous) => ({ ...previous, name: undefined }))
          }}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${id}-name-error` : undefined}
          className={field}
        />
        {errors.name && (
          <p id={`${id}-name-error`} className={errorText}>
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-name-vi`} className={label}>
          {t(locale, 'presetNameVi')}
        </label>
        <input
          id={`${id}-name-vi`}
          type="text"
          autoComplete="off"
          value={nameVi}
          onChange={(event) => {
            setNameVi(event.target.value)
            setErrors((previous) => ({ ...previous, name: undefined }))
          }}
          className={field}
        />
      </div>

      <MoneyField
        label={t(locale, 'presetDefaultPrice')}
        value={price}
        onChange={(value) => {
          setPrice(value)
          setErrors((previous) => ({ ...previous, price: undefined }))
        }}
        error={errors.price}
      />

      <div>
        <PercentField
          label={t(locale, 'presetDefaultRate')}
          value={rate}
          onChange={(value) => {
            setRate(value)
            setErrors((previous) => ({ ...previous, rate: undefined }))
          }}
          error={errors.rate}
        />
        <p className="mt-1 text-sm text-text-secondary">{t(locale, 'presetDefaultRateHint')}</p>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <button type="submit" className={primaryButton}>
          {t(locale, 'save')}
        </button>
        <button type="button" onClick={onDone} className={secondaryButton}>
          {t(locale, 'cancel')}
        </button>
        {preset && (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            className={dangerButton}
          >
            {t(locale, 'remove')}
          </button>
        )}
      </div>

      {preset && (
        <ConfirmDialog
          open={confirmingRemove}
          title={t(locale, 'presetRemoveTitle')}
          body={t(locale, 'presetRemoveBody')}
          confirmLabel={t(locale, 'remove')}
          cancelLabel={t(locale, 'cancel')}
          danger
          onConfirm={confirmRemove}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </form>
  )
}
