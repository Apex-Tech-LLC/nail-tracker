import { IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState, type FormEvent } from 'react'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { db, type ServicePreset } from '../../db/schema.ts'
import { turnTotals } from '../../domain/commission.ts'
import { addDays, isIsoDate, todayIso, type IsoDate } from '../../domain/dates.ts'
import { centsToInput, formatUsd, parseCents, parseRateBp, rateToInput } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import { requestPersistence } from '../../pwa/persistStorage.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { PercentField } from '../../ui/PercentField.tsx'
import { card, chip, chipOff, chipOn, errorText, field, label, primaryButton } from '../../ui/styles.ts'
import { addTurn } from './turnStore.ts'

type Errors = Partial<Record<'amount' | 'cash' | 'card' | 'rate' | 'serviceName' | 'date', string>>

interface Props {
  onDone: () => void
}

/** Loads the service presets first, so the form starts on real values. */
export function TurnForm({ onDone }: Props) {
  const presets = useLiveQuery(() =>
    db.servicePresets
      .orderBy('sortOrder')
      .filter((preset) => preset.isActive)
      .toArray(),
  )

  if (!presets) return null
  return <TurnFormFields presets={presets} onDone={onDone} />
}

interface FieldsProps {
  presets: ServicePreset[]
  onDone: () => void
}

function TurnFormFields({ presets, onDone }: FieldsProps) {
  const { locale, defaultCommissionRateBp, cashTipHandling, cardTipHandling, lastServicePresetId } =
    useSettings()
  const id = useId()
  const today = todayIso()
  const yesterday = addDays(today, -1)
  const initialPreset = presets.find((preset) => preset.id === lastServicePresetId) ?? presets[0]

  const [serviceKey, setServiceKey] = useState(initialPreset?.id ?? 'other')
  const [amountText, setAmountText] = useState('')
  const [cashText, setCashText] = useState('')
  const [cardText, setCardText] = useState('')
  const [rateText, setRateText] = useState(
    rateToInput(initialPreset?.defaultCommissionRateBp ?? defaultCommissionRateBp),
  )
  const [rateTouched, setRateTouched] = useState(false)
  const [otherName, setOtherName] = useState('')
  const [date, setDate] = useState<IsoDate>(today)
  const [pickOtherDay, setPickOtherDay] = useState(false)
  const [errors, setErrors] = useState<Errors>({})

  const priceCents = parseCents(amountText)
  const cashCents = cashText.trim() === '' ? 0 : parseCents(cashText)
  const cardCents = cardText.trim() === '' ? 0 : parseCents(cardText)
  const rateBp = parseRateBp(rateText)
  // While a field cannot be read, the preview treats it as 0 instead of hiding.
  const preview = turnTotals(
    [{ priceCents: priceCents ?? 0, rateBp: rateBp ?? 0 }],
    cashCents ?? 0,
    cardCents ?? 0,
  )

  function clearError(key: keyof Errors) {
    setErrors((previous) => (previous[key] ? { ...previous, [key]: undefined } : previous))
  }

  function chooseService(key: string) {
    const nextPreset = presets.find((preset) => preset.id === key)
    setServiceKey(key)
    if (nextPreset?.defaultPriceCents != null && amountText.trim() === '') {
      setAmountText(centsToInput(nextPreset.defaultPriceCents))
    }
    if (!rateTouched) {
      setRateText(rateToInput(nextPreset?.defaultCommissionRateBp ?? defaultCommissionRateBp))
    }
    clearError('serviceName')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const next: Errors = {}
    const preset = presets.find((item) => item.id === serviceKey)

    if (priceCents === null) next.amount = t(locale, 'errorAmount')
    if (cashCents === null) next.cash = t(locale, 'errorAmount')
    if (cardCents === null) next.card = t(locale, 'errorAmount')
    if (rateBp === null) next.rate = t(locale, 'errorRate')
    if (serviceKey === 'other' && otherName.trim() === '') next.serviceName = t(locale, 'errorServiceName')
    if (!isIsoDate(date)) next.date = t(locale, 'errorDate')

    setErrors(next)
    if (priceCents === null || cashCents === null || cardCents === null || rateBp === null) return
    if (serviceKey === 'other' && otherName.trim() === '') return
    if (!isIsoDate(date)) return

    const name = preset ? (locale === 'vi' ? preset.nameVi : preset.nameEn) : otherName.trim()
    await addTurn(db, {
      occurredAt: Date.now(),
      localWorkDate: date,
      turnCount: 1,
      clientType: 'unspecified',
      cashTipCents: cashCents,
      cardTipCents: cardCents,
      cashTipReceived: cashTipHandling === 'inHand',
      cardTipReceived: cardTipHandling === 'inHand',
      lines: [{ servicePresetId: preset?.id ?? null, name, priceCents, rateBp }],
    })

    if (preset) updateSettings({ lastServicePresetId: preset.id })
    void requestPersistence()
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-[calc(100dvh-2rem)] flex-col gap-5">
      <header className="flex items-center justify-between">
        <button type="button" onClick={onDone} aria-label={t(locale, 'close')} className="p-1">
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="font-medium">{t(locale, 'newTurn')}</h1>
        <span className="w-7" />
      </header>

      <div>
        <p className={label}>{t(locale, 'date')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!pickOtherDay && date === today}
            className={`${chip} ${!pickOtherDay && date === today ? chipOn : chipOff}`}
            onClick={() => {
              setPickOtherDay(false)
              setDate(today)
              clearError('date')
            }}
          >
            {t(locale, 'today')}
          </button>
          <button
            type="button"
            aria-pressed={!pickOtherDay && date === yesterday}
            className={`${chip} ${!pickOtherDay && date === yesterday ? chipOn : chipOff}`}
            onClick={() => {
              setPickOtherDay(false)
              setDate(yesterday)
              clearError('date')
            }}
          >
            {t(locale, 'yesterday')}
          </button>
          <button
            type="button"
            aria-pressed={pickOtherDay}
            className={`${chip} ${pickOtherDay ? chipOn : chipOff}`}
            onClick={() => setPickOtherDay(true)}
          >
            {t(locale, 'otherDay')}
          </button>
        </div>
        {pickOtherDay && (
          <div className="mt-3">
            <label htmlFor={`${id}-date`} className={label}>
              {t(locale, 'workDate')}
            </label>
            <input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                clearError('date')
              }}
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? `${id}-date-error` : undefined}
              className={field}
            />
            {errors.date && (
              <p id={`${id}-date-error`} className={errorText}>
                {errors.date}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <p className={label}>{t(locale, 'service')}</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={serviceKey === preset.id}
              className={`${chip} ${serviceKey === preset.id ? chipOn : chipOff}`}
              onClick={() => chooseService(preset.id)}
            >
              {locale === 'vi' ? preset.nameVi : preset.nameEn}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={serviceKey === 'other'}
            className={`${chip} ${serviceKey === 'other' ? chipOn : chipOff}`}
            onClick={() => chooseService('other')}
          >
            {t(locale, 'presetOther')}
          </button>
        </div>
        {serviceKey === 'other' && (
          <div className="mt-3">
            <label htmlFor={`${id}-service-name`} className={label}>
              {t(locale, 'serviceName')}
            </label>
            <input
              id={`${id}-service-name`}
              type="text"
              autoComplete="off"
              value={otherName}
              onChange={(event) => {
                setOtherName(event.target.value)
                clearError('serviceName')
              }}
              aria-invalid={!!errors.serviceName}
              aria-describedby={errors.serviceName ? `${id}-service-name-error` : undefined}
              className={field}
            />
            {errors.serviceName && (
              <p id={`${id}-service-name-error`} className={errorText}>
                {errors.serviceName}
              </p>
            )}
          </div>
        )}
      </div>

      <MoneyField
        label={t(locale, 'serviceAmount')}
        value={amountText}
        autoFocus
        onChange={(value) => {
          setAmountText(value)
          clearError('amount')
        }}
        error={errors.amount}
      />

      <div className="grid grid-cols-2 gap-3">
        <MoneyField
          label={t(locale, 'cashTip')}
          value={cashText}
          onChange={(value) => {
            setCashText(value)
            clearError('cash')
          }}
          error={errors.cash}
        />
        <MoneyField
          label={t(locale, 'cardTip')}
          value={cardText}
          onChange={(value) => {
            setCardText(value)
            clearError('card')
          }}
          error={errors.card}
        />
      </div>

      <PercentField
        label={t(locale, 'commissionPercent')}
        value={rateText}
        onChange={(value) => {
          setRateText(value)
          setRateTouched(true)
          clearError('rate')
        }}
        error={errors.rate}
      />

      <div className={card} aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-text-secondary">{t(locale, 'previewCommission')}</span>
          <span className="font-medium tabular-nums">{formatUsd(preview.commissionTotalCents)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-text-secondary">{t(locale, 'previewEarned')}</span>
          <span className="text-2xl font-semibold tabular-nums text-positive-text">
            {formatUsd(preview.earnedTotalCents)}
          </span>
        </div>
      </div>

      <button type="submit" className={`${primaryButton} mt-auto`}>
        {t(locale, 'save')}
      </button>
    </form>
  )
}
