import { IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { updateSettings, useSettings } from '../../app/settings.ts'
import {
  db,
  type ClientType,
  type ServicePreset,
  type Turn,
  type TurnService,
} from '../../db/schema.ts'
import { turnTotals } from '../../domain/commission.ts'
import {
  addDays,
  isIsoDate,
  localDateTimeToMs,
  timeOf,
  todayIso,
  type IsoDate,
} from '../../domain/dates.ts'
import { centsToInput, formatUsd, parseCents, parseRateBp, rateToInput } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { requestPersistence } from '../../pwa/persistStorage.ts'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { PercentField } from '../../ui/PercentField.tsx'
import {
  card,
  chip,
  chipOff,
  chipOn,
  errorText,
  field,
  label,
  primaryButton,
  secondaryButton,
} from '../../ui/styles.ts'
import {
  ServiceLineFields,
  type LineErrors,
  type LineState,
} from './ServiceLineFields.tsx'
import { addTurn, deleteTurn, updateTurn, type TurnLineInput } from './turnStore.ts'

interface Errors {
  date?: string
  cash?: string
  card?: string
  turnCount?: string
  lines: Record<string, LineErrors>
}

const CLIENT_TYPES: {
  value: ClientType
  key: 'clientUnspecified' | 'clientWalkIn' | 'clientRequest'
}[] = [
  { value: 'unspecified', key: 'clientUnspecified' },
  { value: 'walkIn', key: 'clientWalkIn' },
  { value: 'request', key: 'clientRequest' },
]

function newLine(choice: string, rateBp: number): LineState {
  return {
    key: crypto.randomUUID(),
    choice,
    customName: '',
    amount: '',
    rate: rateToInput(rateBp),
    rateTouched: false,
    originalChoice: choice,
    originalName: '',
  }
}

/** A saved service row back into form state. Its rate is "touched" so it cannot change. */
function lineFromService(service: TurnService, presets: ServicePreset[]): LineState {
  const preset = presets.find((item) => item.id === service.servicePresetId)
  const choice = preset ? preset.id : 'other'
  return {
    key: crypto.randomUUID(),
    choice,
    customName: preset ? '' : service.serviceNameSnapshot,
    amount: centsToInput(service.servicePriceCents),
    rate: rateToInput(service.commissionRateSnapshotBp),
    rateTouched: true,
    originalChoice: choice,
    originalName: service.serviceNameSnapshot,
  }
}

function presetName(preset: ServicePreset, locale: Locale): string {
  return locale === 'vi' ? preset.nameVi : preset.nameEn
}

/** A typed time pins the moment; without one, the turn is simply now. */
function occurredAtFor(date: IsoDate, time: string): number {
  return time ? localDateTimeToMs(date, time) : Date.now()
}

/**
 * Editing keeps the saved moment unless the time or the day was changed.
 * A cleared time box keeps the original moment too.
 */
function occurredAtForEdit(date: IsoDate, time: string, turn: Turn): number {
  if (time === '') return turn.occurredAt
  if (time === timeOf(turn.occurredAt) && date === turn.localWorkDate) return turn.occurredAt
  return localDateTimeToMs(date, time)
}

interface Props {
  turnId?: string
  onDone: () => void
}

/** Loads the service presets and, when editing, the saved turn before the form starts. */
export function TurnForm({ turnId, onDone }: Props) {
  const { locale } = useSettings()
  const presets = useLiveQuery(() =>
    db.servicePresets
      .orderBy('sortOrder')
      .filter((preset) => preset.isActive)
      .toArray(),
  )
  const existing = useLiveQuery(async () => {
    if (!turnId) return null
    const turn = await db.turns.get(turnId)
    if (!turn) return null
    const services = await db.turnServices.where('turnId').equals(turnId).sortBy('sortOrder')
    return { turn, services }
  }, [turnId])

  if (!presets || existing === undefined) return null

  if (turnId && existing === null) {
    return (
      <>
        <p>{t(locale, 'entryNotFound')}</p>
        <Link href={paths.today} replace className="text-brand-600 underline">
          {t(locale, 'backToToday')}
        </Link>
      </>
    )
  }

  return <TurnFormFields presets={presets} existing={existing} onDone={onDone} />
}

interface FieldsProps {
  presets: ServicePreset[]
  existing: { turn: Turn; services: TurnService[] } | null
  onDone: () => void
}

function TurnFormFields({ presets, existing, onDone }: FieldsProps) {
  const {
    locale,
    defaultCommissionRateBp,
    perServiceRates,
    cashTipHandling,
    cardTipHandling,
    lastServicePresetId,
  } = useSettings()
  const id = useId()
  const today = todayIso()
  const yesterday = addDays(today, -1)
  const turn = existing?.turn
  const initialPreset = presets.find((preset) => preset.id === lastServicePresetId) ?? presets[0]

  const [lines, setLines] = useState<LineState[]>(() =>
    existing && existing.services.length > 0
      ? existing.services.map((service) => lineFromService(service, presets))
      : [
          newLine(
            initialPreset?.id ?? 'other',
            initialPreset?.defaultCommissionRateBp ?? defaultCommissionRateBp,
          ),
        ],
  )
  const [cashText, setCashText] = useState(
    turn && turn.cashTipCents > 0 ? centsToInput(turn.cashTipCents) : '',
  )
  const [cardText, setCardText] = useState(
    turn && turn.cardTipCents > 0 ? centsToInput(turn.cardTipCents) : '',
  )
  const [date, setDate] = useState<IsoDate>(turn?.localWorkDate ?? today)
  const [pickOtherDay, setPickOtherDay] = useState(
    turn ? turn.localWorkDate !== today && turn.localWorkDate !== yesterday : false,
  )
  const [turnCountText, setTurnCountText] = useState(String(turn?.turnCount ?? 1))
  const [time, setTime] = useState(turn ? timeOf(turn.occurredAt) : '')
  const [clientType, setClientType] = useState<ClientType>(turn?.clientType ?? 'unspecified')
  const [cashTipReceived, setCashTipReceived] = useState(
    turn ? turn.cashTipReceived : cashTipHandling === 'inHand',
  )
  const [cardTipReceived, setCardTipReceived] = useState(
    turn ? turn.cardTipReceived : cardTipHandling === 'inHand',
  )
  const [note, setNote] = useState(turn?.note ?? '')
  const [moreOpen, setMoreOpen] = useState(
    turn
      ? turn.turnCount !== 1 ||
          turn.clientType !== 'unspecified' ||
          (turn.note ?? '').trim() !== ''
      : false,
  )
  const [savedAddAnother, setSavedAddAnother] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Errors>({ lines: {} })

  // A quick double tap fires submit twice before React can re-render. The ref
  // is set synchronously, so the second call does nothing.
  const saveInFlight = useRef(false)
  const amountRef = useRef<HTMLInputElement | null>(null)
  const lastSavedChoice = useRef(initialPreset?.id ?? 'other')

  const cashCents = cashText.trim() === '' ? 0 : parseCents(cashText)
  const cardCents = cardText.trim() === '' ? 0 : parseCents(cardText)
  // While a field cannot be read, the preview treats it as 0 instead of hiding.
  const preview = turnTotals(
    lines.map((line) => ({
      priceCents: parseCents(line.amount) ?? 0,
      rateBp: parseRateBp(line.rate) ?? 0,
    })),
    cashCents ?? 0,
    cardCents ?? 0,
  )
  const showPerLine =
    perServiceRates || new Set(lines.map((line) => line.rate)).size > 1

  function changed() {
    setSavedAddAnother(false)
  }

  function clearError(key: 'date' | 'cash' | 'card' | 'turnCount') {
    setErrors((previous) =>
      previous[key] ? { ...previous, [key]: undefined } : previous,
    )
  }

  function clearLineError(key: string, fieldName: keyof LineErrors) {
    setErrors((previous) => {
      const line = previous.lines[key]
      if (!line?.[fieldName]) return previous
      return {
        ...previous,
        lines: { ...previous.lines, [key]: { ...line, [fieldName]: undefined } },
      }
    })
  }

  function clearRateErrors() {
    setErrors((previous) => {
      const keys = Object.keys(previous.lines).filter((key) => previous.lines[key].rate)
      if (keys.length === 0) return previous
      const next = { ...previous.lines }
      for (const key of keys) next[key] = { ...next[key], rate: undefined }
      return { ...previous, lines: next }
    })
  }

  function updateLine(key: string, change: (line: LineState) => LineState) {
    setLines((previous) =>
      previous.map((line) => (line.key === key ? change(line) : line)),
    )
  }

  function chooseService(key: string, choice: string) {
    const preset = presets.find((item) => item.id === choice)
    updateLine(key, (line) => ({
      ...line,
      choice,
      amount:
        preset?.defaultPriceCents != null && line.amount.trim() === ''
          ? centsToInput(preset.defaultPriceCents)
          : line.amount,
      rate: line.rateTouched
        ? line.rate
        : rateToInput(preset?.defaultCommissionRateBp ?? defaultCommissionRateBp),
    }))
    clearLineError(key, 'serviceName')
    changed()
  }

  function addService() {
    const choice = initialPreset?.id ?? 'other'
    const rateBp = initialPreset?.defaultCommissionRateBp ?? defaultCommissionRateBp
    setLines((previous) => [...previous, newLine(choice, rateBp)])
    changed()
  }

  function removeService(key: string) {
    setLines((previous) =>
      previous.length <= 1 ? previous : previous.filter((line) => line.key !== key),
    )
    setErrors((previous) => {
      if (!previous.lines[key]) return previous
      const next = { ...previous.lines }
      delete next[key]
      return { ...previous, lines: next }
    })
    changed()
  }

  function changeSharedRate(value: string) {
    setLines((previous) =>
      previous.map((line) => ({ ...line, rate: value, rateTouched: true })),
    )
    clearRateErrors()
    changed()
  }

  async function save(): Promise<boolean> {
    if (saveInFlight.current) return false

    const nextLineErrors: Record<string, LineErrors> = {}
    const nextLines: TurnLineInput[] = []

    for (const line of lines) {
      const lineErrors: LineErrors = {}
      const priceCents = parseCents(line.amount)
      const rateBp = parseRateBp(line.rate)
      if (priceCents === null) lineErrors.amount = t(locale, 'errorAmount')
      if (rateBp === null) lineErrors.rate = t(locale, 'errorRate')
      if (line.choice === 'other' && line.customName.trim() === '') {
        lineErrors.serviceName = t(locale, 'errorServiceName')
      }
      if (priceCents === null || rateBp === null || lineErrors.serviceName) {
        nextLineErrors[line.key] = lineErrors
        continue
      }

      const preset = presets.find((item) => item.id === line.choice)
      // An unchanged preset keeps the name saved on the turn, so editing a tip
      // never rewrites history with a renamed preset.
      const name =
        preset && line.choice === line.originalChoice && line.originalName
          ? line.originalName
          : preset
            ? presetName(preset, locale)
            : line.customName.trim()
      nextLines.push({
        servicePresetId: preset?.id ?? null,
        name,
        priceCents,
        rateBp,
      })
    }

    const turnCount = /^\d{1,2}$/.test(turnCountText) ? Number(turnCountText) : null
    const nextErrors: Errors = { lines: nextLineErrors }
    if (cashCents === null) nextErrors.cash = t(locale, 'errorAmount')
    if (cardCents === null) nextErrors.card = t(locale, 'errorAmount')
    if (turnCount === null) nextErrors.turnCount = t(locale, 'errorTurnCount')
    if (!isIsoDate(date)) nextErrors.date = t(locale, 'errorDate')

    if (
      cashCents === null ||
      cardCents === null ||
      turnCount === null ||
      !isIsoDate(date) ||
      Object.keys(nextLineErrors).length > 0
    ) {
      // A hidden error would be invisible: open More options for the count.
      if (turnCount === null) setMoreOpen(true)
      setErrors(nextErrors)
      return false
    }

    setErrors({ lines: {} })
    const lastLine = lines[lines.length - 1]
    const lastPreset = presets.find((item) => item.id === lastLine.choice)
    lastSavedChoice.current = lastLine.choice

    saveInFlight.current = true
    const input = {
      occurredAt: turn ? occurredAtForEdit(date, time, turn) : occurredAtFor(date, time),
      localWorkDate: date,
      turnCount,
      clientType,
      note,
      cashTipCents: cashCents,
      cardTipCents: cardCents,
      cashTipReceived,
      cardTipReceived,
      lines: nextLines,
    }
    try {
      if (turn) await updateTurn(db, turn.id, input)
      else await addTurn(db, input)
    } catch (error) {
      saveInFlight.current = false
      throw error
    }

    if (!turn) {
      if (lastPreset) updateSettings({ lastServicePresetId: lastPreset.id })
      void requestPersistence()
    }
    return true
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (await save()) onDone()
  }

  function resetForNextTurn() {
    const choice = lastSavedChoice.current
    const preset = presets.find((item) => item.id === choice)
    setLines([
      newLine(choice, preset?.defaultCommissionRateBp ?? defaultCommissionRateBp),
    ])
    setCashText('')
    setCardText('')
    setTurnCountText('1')
    setTime('')
    setClientType('unspecified')
    setCashTipReceived(cashTipHandling === 'inHand')
    setCardTipReceived(cardTipHandling === 'inHand')
    setNote('')
    setMoreOpen(false)
    setSavedAddAnother(true)
    setErrors({ lines: {} })
    requestAnimationFrame(() => amountRef.current?.focus())
  }

  async function saveAndAddAnother() {
    if (!(await save())) return
    resetForNextTurn()
    saveInFlight.current = false
  }

  async function confirmDelete() {
    if (!turn || deleting) return
    setDeleting(true)
    try {
      await deleteTurn(db, turn.id)
      onDone()
    } catch (error) {
      setDeleting(false)
      throw error
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex min-h-[calc(100dvh-2rem)] flex-col gap-5"
    >
      <header className="flex items-center justify-between">
        <button type="button" onClick={onDone} aria-label={t(locale, 'close')} className="p-1">
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="font-medium">{t(locale, turn ? 'editTurn' : 'newTurn')}</h1>
        {turn ? (
          <button
            type="button"
            aria-label={t(locale, 'delete')}
            onClick={() => setConfirmingDelete(true)}
            className="p-1 text-danger-text"
          >
            <IconTrash size={22} aria-hidden="true" />
          </button>
        ) : (
          <span className="w-7" />
        )}
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
              changed()
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
              changed()
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
                changed()
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

      {lines.map((line, index) => (
        <ServiceLineFields
          key={line.key}
          line={line}
          presets={presets}
          locale={locale}
          showPerLine={showPerLine}
          canRemove={lines.length > 1}
          errors={errors.lines[line.key]}
          amountRef={index === 0 ? amountRef : undefined}
          autoFocus={index === 0}
          onChoose={(choice) => chooseService(line.key, choice)}
          onCustomName={(value) => {
            updateLine(line.key, (current) => ({ ...current, customName: value }))
            clearLineError(line.key, 'serviceName')
            changed()
          }}
          onAmount={(value) => {
            updateLine(line.key, (current) => ({ ...current, amount: value }))
            clearLineError(line.key, 'amount')
            changed()
          }}
          onRate={(value) => {
            updateLine(line.key, (current) => ({
              ...current,
              rate: value,
              rateTouched: true,
            }))
            clearLineError(line.key, 'rate')
            changed()
          }}
          onRemove={() => removeService(line.key)}
        />
      ))}

      <button
        type="button"
        onClick={addService}
        className={`${secondaryButton} flex items-center justify-center gap-2`}
      >
        <IconPlus size={20} aria-hidden="true" />
        {t(locale, 'addService')}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <MoneyField
          label={t(locale, 'cashTip')}
          value={cashText}
          onChange={(value) => {
            setCashText(value)
            clearError('cash')
            changed()
          }}
          error={errors.cash}
        />
        <MoneyField
          label={t(locale, 'cardTip')}
          value={cardText}
          onChange={(value) => {
            setCardText(value)
            clearError('card')
            changed()
          }}
          error={errors.card}
        />
      </div>

      {!showPerLine && (
        <PercentField
          label={t(locale, 'commissionPercent')}
          value={lines[0].rate}
          onChange={changeSharedRate}
          error={errors.lines[lines[0].key]?.rate}
        />
      )}

      <div className={card} aria-live="polite">
        {lines.length > 1 && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-text-secondary">{t(locale, 'serviceRevenue')}</span>
            <span className="tabular-nums">
              {formatUsd(preview.serviceRevenueTotalCents)}
            </span>
          </div>
        )}
        <div
          className={`flex items-baseline justify-between gap-3 ${lines.length > 1 ? 'mt-2' : ''}`}
        >
          <span className="text-text-secondary">{t(locale, 'previewCommission')}</span>
          <span className="font-medium tabular-nums">
            {formatUsd(preview.commissionTotalCents)}
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-text-secondary">{t(locale, 'previewEarned')}</span>
          <span className="text-2xl font-semibold tabular-nums text-positive-text">
            {formatUsd(preview.earnedTotalCents)}
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
        className={secondaryButton}
      >
        {t(locale, moreOpen ? 'fewerOptions' : 'moreOptions')}
      </button>

      {moreOpen && (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor={`${id}-turn-count`} className={label}>
              {t(locale, 'turnCount')}
            </label>
            <input
              id={`${id}-turn-count`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={turnCountText}
              onChange={(event) => {
                setTurnCountText(event.target.value)
                clearError('turnCount')
                changed()
              }}
              aria-invalid={!!errors.turnCount}
              aria-describedby={[
                `${id}-turn-count-hint`,
                errors.turnCount ? `${id}-turn-count-error` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              className={field}
            />
            <p id={`${id}-turn-count-hint`} className="mt-1 text-sm text-text-secondary">
              {t(locale, 'turnCountHint')}
            </p>
            {errors.turnCount && (
              <p id={`${id}-turn-count-error`} className={errorText}>
                {errors.turnCount}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${id}-time`} className={label}>
              {t(locale, 'time')}
            </label>
            <input
              id={`${id}-time`}
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value)
                changed()
              }}
              className={field}
            />
          </div>

          <div>
            <p className={label}>{t(locale, 'clientType')}</p>
            <div className="flex flex-wrap gap-2">
              {CLIENT_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={clientType === item.value}
                  className={`${chip} ${clientType === item.value ? chipOn : chipOff}`}
                  onClick={() => {
                    setClientType(item.value)
                    changed()
                  }}
                >
                  {t(locale, item.key)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                className="size-5"
                checked={cashTipReceived}
                onChange={(event) => {
                  setCashTipReceived(event.target.checked)
                  changed()
                }}
              />
              <span>{t(locale, 'cashTipReceivedLabel')}</span>
            </label>
            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                className="size-5"
                checked={cardTipReceived}
                onChange={(event) => {
                  setCardTipReceived(event.target.checked)
                  changed()
                }}
              />
              <span>{t(locale, 'cardTipReceivedLabel')}</span>
            </label>
          </div>

          <div>
            <label htmlFor={`${id}-note`} className={label}>
              {t(locale, 'note')}
            </label>
            <textarea
              id={`${id}-note`}
              rows={2}
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
                changed()
              }}
              className={field}
            />
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {!turn && (
          <p role="status" className="text-sm text-positive-text">
            {savedAddAnother ? t(locale, 'savedAddAnother') : ''}
          </p>
        )}
        <button type="submit" className={primaryButton}>
          {t(locale, 'save')}
        </button>
        {!turn && (
          <button type="button" onClick={saveAndAddAnother} className={secondaryButton}>
            {t(locale, 'saveAndAddAnother')}
          </button>
        )}
      </div>

      {turn && (
        <ConfirmDialog
          open={confirmingDelete}
          title={t(locale, 'deleteTurnTitle')}
          body={t(locale, 'deleteTurnBody')}
          confirmLabel={t(locale, 'delete')}
          cancelLabel={t(locale, 'cancel')}
          danger
          confirmDisabled={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </form>
  )
}
