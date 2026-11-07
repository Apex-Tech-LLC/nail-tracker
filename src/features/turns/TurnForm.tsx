import { IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState, type FocusEvent, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'wouter'
import { paths, useAppLocation } from '../../app/navigation.ts'
import { updateSettings, useSettings } from '../../app/settings.ts'
import {
  db,
  type ClientType,
  type ServicePreset,
  type Turn,
  type TurnService,
} from '../../db/schema.ts'
import { turnTotals } from '../../domain/commission.ts'
import { isIsoDate, localDateTimeToMs, timeOf, todayIso, type IsoDate } from '../../domain/dates.ts'
import {
  centsToInput,
  formatUsd,
  formatUsdShort,
  padAmount,
  parseCents,
  parseRateBp,
  rateToInput,
  roundDiv,
} from '../../domain/money.ts'
import {
  lastPrice,
  serviceUse,
  topCombos,
  type QuickPickEntry,
  type QuickPickLine,
} from '../../domain/quickPicks.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { requestPersistence } from '../../pwa/persistStorage.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { NumberPad } from '../../ui/NumberPad.tsx'
import { PercentField } from '../../ui/PercentField.tsx'
import { useToast } from '../../ui/useToast.ts'
import { WorkDateField } from '../../ui/WorkDateField.tsx'
import {
  card,
  chip,
  chipOff,
  chipOn,
  errorText,
  field,
  label,
  pill,
  primaryButton,
  secondaryButton,
} from '../../ui/styles.ts'
import {
  ServiceLineFields,
  type LineErrors,
  type LineState,
} from './ServiceLineFields.tsx'
import {
  addTurn,
  deleteTurn,
  loadQuickPickEntries,
  restoreTurn,
  updateTurn,
  type TurnLineInput,
} from './turnStore.ts'

interface Errors {
  date?: string
  cash?: string
  card?: string
  turnCount?: string
  services?: string
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

/**
 * A service row copied into a brand new turn. Its rate is kept, but the name
 * stays empty so saving uses the preset's current name rather than the old one.
 */
function copiedLineFromService(service: TurnService, presets: ServicePreset[]): LineState {
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
    originalName: '',
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
  copyId?: string
  onDone: () => void
  onClose?: () => void
}

interface QuickData {
  entries: QuickPickEntry[]
  latest: { turn: Turn; services: TurnService[] } | null
}

interface SaveResult {
  id: string
  earnedTotalCents: number
}

const TIP_VALUES = [500, 1000, 1500, 2000] as const
const REPEAT_CHIP =
  'flex min-h-11 flex-none items-center gap-1 whitespace-nowrap rounded-control bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-800'

function comboLabel(lines: readonly QuickPickLine[]): string {
  const total = lines.reduce((sum, line) => sum + line.priceCents, 0)
  return `${lines.map((line) => line.name).join(' + ')} ${formatUsdShort(total)}`
}

function sameAsLastLabel(latest: QuickData['latest'], locale: Locale): string {
  if (!latest || latest.services.length === 0) return t(locale, 'sameAsLast')
  const more = latest.services.length > 1 ? ' +1' : ''
  const total = formatUsdShort(latest.turn.serviceRevenueTotalCents)
  return `${t(locale, 'sameAsLast')}: ${latest.services[0].serviceNameSnapshot}${more} ${total}`
}

/** Loads the service presets and, when editing or copying, the saved turn first. */
export function TurnForm({ turnId, copyId, onDone, onClose }: Props) {
  const { locale } = useSettings()
  const sourceId = turnId ?? copyId
  const presets = useLiveQuery(() =>
    db.servicePresets
      .orderBy('sortOrder')
      .filter((preset) => preset.isActive)
      .toArray(),
  )
  const existing = useLiveQuery(async () => {
    if (!sourceId) return null
    const turn = await db.turns.get(sourceId)
    if (!turn) return null
    const services = await db.turnServices.where('turnId').equals(sourceId).sortBy('sortOrder')
    return { turn, services }
  }, [sourceId])
  // Quick picks only speed up a brand new turn; edit and copy keep their values.
  const quick = useLiveQuery(async (): Promise<QuickData | null> => {
    if (sourceId) return null
    const entries = await loadQuickPickEntries(db, todayIso())
    const latestTurn = await db.turns.orderBy('occurredAt').last()
    const services = latestTurn
      ? await db.turnServices.where('turnId').equals(latestTurn.id).sortBy('sortOrder')
      : []
    return { entries, latest: latestTurn ? { turn: latestTurn, services } : null }
  }, [sourceId])

  if (!presets || existing === undefined || quick === undefined) return null

  if (sourceId && existing === null) {
    return (
      <>
        <p>{t(locale, 'entryNotFound')}</p>
        <Link href={paths.today} replace className="text-brand-600 underline">
          {t(locale, 'backToToday')}
        </Link>
      </>
    )
  }

  return (
    <TurnFormFields
      presets={presets}
      existing={existing}
      quick={quick}
      copy={!!copyId}
      onDone={onDone}
      onClose={onClose ?? onDone}
    />
  )
}

interface FieldsProps {
  presets: ServicePreset[]
  existing: { turn: Turn; services: TurnService[] } | null
  quick: QuickData | null
  copy: boolean
  onDone: () => void
  onClose: () => void
}

function TurnFormFields({ presets, existing, quick, copy, onDone, onClose }: FieldsProps) {
  const {
    locale,
    defaultCommissionRateBp,
    perServiceRates,
    cashTipHandling,
    cardTipHandling,
    lastServicePresetId,
    tipButtonsTarget,
    numberPad,
  } = useSettings()
  const [, navigate] = useAppLocation()
  const id = useId()
  const today = todayIso()
  // A copy is loaded from its source but saved as a brand new turn.
  const source = existing?.turn
  const turn = copy ? undefined : source
  const initialPreset = presets.find((preset) => preset.id === lastServicePresetId) ?? presets[0]

  const [lines, setLines] = useState<LineState[]>(() =>
    existing && existing.services.length > 0
      ? existing.services.map((service) =>
          copy
            ? copiedLineFromService(service, presets)
            : lineFromService(service, presets),
        )
      : [
          newLine(
            initialPreset?.id ?? 'other',
            initialPreset?.defaultCommissionRateBp ?? defaultCommissionRateBp,
          ),
        ],
  )
  const [cashText, setCashText] = useState(
    source && source.cashTipCents > 0 ? centsToInput(source.cashTipCents) : '',
  )
  const [cardText, setCardText] = useState(
    source && source.cardTipCents > 0 ? centsToInput(source.cardTipCents) : '',
  )
  const [date, setDate] = useState<IsoDate>(turn?.localWorkDate ?? today)
  const [turnCountText, setTurnCountText] = useState(String(source?.turnCount ?? 1))
  const [time, setTime] = useState(turn ? timeOf(turn.occurredAt) : '')
  const [clientType, setClientType] = useState<ClientType>(
    source?.clientType ?? 'unspecified',
  )

  const [cashTipReceived, setCashTipReceived] = useState(
    source ? source.cashTipReceived : cashTipHandling === 'inHand',
  )
  const [cardTipReceived, setCardTipReceived] = useState(
    source ? source.cardTipReceived : cardTipHandling === 'inHand',
  )
  const [note, setNote] = useState(source?.note ?? '')
  const [moreOpen, setMoreOpen] = useState(
    source
      ? source.turnCount !== 1 ||
          source.clientType !== 'unspecified' ||
          (source.note ?? '').trim() !== ''
      : false,
  )
  const [savedAddAnother, setSavedAddAnother] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Errors>({ lines: {} })
  const [padTarget, setPadTarget] = useState<string | null>(null)
  const [rateOpen, setRateOpen] = useState(false)
  const toast = useToast()

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
  // Screen order: every service price, then the cash tip, then the card tip.
  const padTargets = [...lines.map((line) => `line:${line.key}`), 'cash', 'card']
  const padShown = numberPad && padTarget !== null && padTargets.includes(padTarget)

  const useCounts = quick ? serviceUse(quick.entries) : new Map<string, number>()
  const lastPrices = quick ? lastPrice(quick.entries) : new Map<string, number>()
  const combos = quick ? topCombos(quick.entries) : []
  const latest = quick?.latest ?? null
  // Most used first; the presets keep their own order on a tie (stable sort).
  const orderedPresets = [...presets].sort(
    (a, b) => (useCounts.get(b.id) ?? 0) - (useCounts.get(a.id) ?? 0),
  )
  const serviceCents = lines.reduce(
    (sum, line) => sum + (parseCents(line.amount) ?? 0),
    0,
  )
  const percentTipCents = roundDiv(serviceCents * 1800, 10_000)
  const tipOptions = [
    ...TIP_VALUES.map((cents) => ({ label: formatUsdShort(cents), cents })),
    { label: '18%', cents: percentTipCents },
  ]
  const targetText = tipButtonsTarget === 'cash' ? cashText : cardText
  const targetCents = targetText.trim() === '' ? null : parseCents(targetText)

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

  function padTextFor(target: string): string {
    if (target === 'cash') return cashText
    if (target === 'card') return cardText
    const key = target.slice('line:'.length)
    return lines.find((line) => line.key === key)?.amount ?? ''
  }

  function changePadText(target: string, value: string) {
    if (target === 'cash') {
      setCashText(value)
      clearError('cash')
    } else if (target === 'card') {
      setCardText(value)
      clearError('card')
    } else {
      const key = target.slice('line:'.length)
      updateLine(key, (line) => ({ ...line, amount: value }))
      clearLineError(key, 'amount')
    }
    changed()
  }

  /** One key from the app's pad: a digit or dot append, `back` removes the last character. */
  function typeOnPad(key: string) {
    if (!padTarget) return
    const current = padTextFor(padTarget)
    const next = key === 'back' ? current.slice(0, -1) : padAmount(current, key)
    if (next !== current) changePadText(padTarget, next)
  }

  function focusPad(target: string, element: HTMLInputElement) {
    if (!numberPad) return
    setPadTarget(target)
    // The pad is fixed over the bottom: scroll the box clear of it once it is up.
    requestAnimationFrame(() => element.scrollIntoView({ block: 'nearest' }))
  }

  /** The pad stays while focus is on it or on another money box; anywhere else it hides. */
  function blurPad(event: FocusEvent<HTMLInputElement>) {
    const next = event.relatedTarget
    if (next instanceof Element) {
      if (next.closest('[data-number-pad]')) return
      if (next.matches('[data-pad-target]')) return
    }
    setPadTarget(null)
  }

  /** Last money box in screen order: hide the pad instead of wrapping round. */
  function focusNextPadTarget() {
    if (!padTarget) return
    const index = padTargets.indexOf(padTarget)
    const next = index === -1 ? undefined : padTargets[index + 1]
    if (!next) {
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
      setPadTarget(null)
      return
    }
    setPadTarget(next)
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLInputElement>(`[data-pad-target="${next}"]`)
      element?.focus()
      element?.scrollIntoView({ block: 'nearest' })
    })
  }

  function updateLine(key: string, change: (line: LineState) => LineState) {
    setLines((previous) =>
      previous.map((line) => (line.key === key ? change(line) : line)),
    )
  }

  function forgetLines(keys: readonly string[]) {
    if (keys.length === 0) return
    setErrors((previous) => {
      const next = { ...previous.lines }
      for (const key of keys) delete next[key]
      return { ...previous, lines: next }
    })
  }

  /**
   * A line added in shared-rate mode inherits the rate the technician already
   * set, or the one a copied or edited turn brought in. Taking a preset default
   * instead would make the rates differ and flip the form to a box per line.
   */
  function sharedRateForNewLine(): string | null {
    if (perServiceRates || showPerLine) return null
    const first = lines[0]
    return first?.rateTouched ? first.rate : null
  }

  function lineForChoice(choice: string): LineState {
    const preset = presets.find((item) => item.id === choice)
    const line = newLine(choice, preset?.defaultCommissionRateBp ?? defaultCommissionRateBp)
    const sharedRate = sharedRateForNewLine()
    const withRate =
      sharedRate === null ? line : { ...line, rate: sharedRate, rateTouched: true }
    // The chip shows and fills the usual price, or else the last one charged.
    const priceCents = preset?.defaultPriceCents ?? lastPrices.get(choice) ?? null
    return priceCents != null ? { ...withRate, amount: centsToInput(priceCents) } : withRate
  }

  function toggleService(choice: string) {
    const matching = lines.filter((line) => line.choice === choice)
    if (matching.length > 0) {
      setLines((previous) => previous.filter((line) => line.choice !== choice))
      forgetLines(matching.map((line) => line.key))
    } else {
      setLines((previous) => [...previous, lineForChoice(choice)])
    }
    setErrors((previous) =>
      previous.services ? { ...previous, services: undefined } : previous,
    )
    changed()
  }

  function addService() {
    setLines((previous) => [...previous, lineForChoice('other')])
    setErrors((previous) =>
      previous.services ? { ...previous, services: undefined } : previous,
    )
    changed()
  }

  function removeService(key: string) {
    setLines((previous) => previous.filter((line) => line.key !== key))
    forgetLines([key])
    changed()
  }

  /** A repeat chip replaces the whole service list, keeping the rate rules of hand-picked chips. */
  function applyCombo(comboLines: readonly QuickPickLine[]) {
    const shared =
      !perServiceRates && lines[0]?.rateTouched ? lines[0].rate : null
    const next = comboLines.map((line) => {
      const preset = presets.find((item) => item.id === line.key)
      const base = newLine(
        preset ? preset.id : 'other',
        preset?.defaultCommissionRateBp ?? defaultCommissionRateBp,
      )
      return {
        ...base,
        customName: preset ? '' : line.name,
        amount: centsToInput(line.priceCents),
        ...(shared === null ? {} : { rate: shared, rateTouched: true }),
      }
    })
    setLines(next)
    setErrors({ lines: {} })
    changed()
  }

  function fillTip(cents: number) {
    const value = centsToInput(cents)
    if (tipButtonsTarget === 'cash') {
      setCashText(value)
      clearError('cash')
    } else {
      setCardText(value)
      clearError('card')
    }
    changed()
  }

  function changeSharedRate(value: string) {
    setLines((previous) =>
      previous.map((line) => ({ ...line, rate: value, rateTouched: true })),
    )
    clearRateErrors()
    changed()
  }

  async function save(): Promise<SaveResult | null> {
    if (saveInFlight.current) return null

    if (lines.length === 0) {
      setErrors({ lines: {}, services: t(locale, 'errorNoService') })
      return null
    }

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
      // The shared rate lives under a pill: open it so its error can be read.
      if (Object.values(nextLineErrors).some((line) => line.rate)) setRateOpen(true)
      setErrors(nextErrors)
      return null
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
    let savedId = turn?.id ?? ''
    try {
      if (turn) await updateTurn(db, turn.id, input)
      else savedId = await addTurn(db, input)
    } catch (error) {
      saveInFlight.current = false
      throw error
    }

    if (!turn) {
      if (lastPreset) updateSettings({ lastServicePresetId: lastPreset.id })
      void requestPersistence()
    }
    return { id: savedId, earnedTotalCents: preview.earnedTotalCents }
  }

  /** New and copied turns offer Undo and Copy again; editing an existing turn only says Saved. */
  function showSaved(result: SaveResult) {
    if (turn) {
      toast.show({ message: t(locale, 'saved') })
      return
    }
    toast.show({
      message: `${t(locale, 'saved')} · ${t(locale, 'youEarn')} ${formatUsdShort(result.earnedTotalCents)}`,
      actions: [
        {
          label: t(locale, 'undo'),
          onClick: () => {
            void deleteTurn(db, result.id)
          },
        },
        {
          label: t(locale, 'copyAgain'),
          onClick: () => navigate(paths.copy(result.id)),
        },
      ],
    })
  }

  async function saveAndClose() {
    const result = await save()
    if (!result) return
    showSaved(result)
    onDone()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void saveAndClose()
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

  async function deleteNow() {
    if (!turn || deleting) return
    setDeleting(true)
    try {
      const removed = await deleteTurn(db, turn.id)
      if (removed) {
        toast.show({
          message: t(locale, 'turnDeleted'),
          actions: [
            {
              label: t(locale, 'undo'),
              onClick: () => {
                void restoreTurn(db, removed)
              },
            },
          ],
        })
      }
      onDone()
    } catch (error) {
      setDeleting(false)
      throw error
    }
  }

  return (
    <>
      <form
        onSubmit={submit}
        noValidate
        className={`flex min-h-[calc(100dvh-2rem)] flex-col gap-5 ${
          padShown ? 'pb-[280px]' : ''
        }`}
      >
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label={t(locale, 'close')}
            className="flex min-h-11 min-w-11 items-center justify-center"
          >
            <IconX size={22} aria-hidden="true" />
          </button>
          <h1 className="font-medium">{t(locale, turn ? 'editTurn' : 'newTurn')}</h1>
          {turn ? (
            <button
              type="button"
              aria-label={t(locale, 'delete')}
              disabled={deleting}
              onClick={() => {
                void deleteNow()
              }}
              className="flex min-h-11 min-w-11 items-center justify-center text-danger-text"
            >
              <IconTrash size={22} aria-hidden="true" />
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>

        <div className="flex flex-wrap items-start justify-end gap-2">
          <WorkDateField
            compact
            value={date}
            onChange={(value) => {
              setDate(value)
              clearError('date')
              changed()
            }}
            error={errors.date}
          />
          {!showPerLine && lines.length > 0 && (
            <button
              type="button"
              aria-expanded={rateOpen}
              aria-label={`${t(locale, 'commission')}: ${lines[0].rate}%`}
              className={pill}
              onClick={() => setRateOpen((wasOpen) => !wasOpen)}
            >
              {lines[0].rate}%
              <span aria-hidden="true">▾</span>
            </button>
          )}
        </div>
        {!showPerLine && lines.length > 0 && rateOpen && (
          <PercentField
            label={t(locale, 'commissionPercent')}
            value={lines[0].rate}
            onChange={changeSharedRate}
            error={errors.lines[lines[0].key]?.rate}
          />
        )}
      </header>

      {quick && ((latest && latest.services.length > 0) || combos.length > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {latest && latest.services.length > 0 && (
            <button
              type="button"
              className={REPEAT_CHIP}
              onClick={() => navigate(paths.copy(latest.turn.id), { replace: true })}
            >
              <span aria-hidden="true">↻</span>
              {sameAsLastLabel(latest, locale)}
            </button>
          )}
          {combos.map((combo, index) => (
            <button
              key={index}
              type="button"
              className={REPEAT_CHIP}
              onClick={() => applyCombo(combo.lines)}
            >
              <span aria-hidden="true">↻</span>
              {comboLabel(combo.lines)}
            </button>
          ))}
        </div>
      )}

      <div>
        <p className={label}>{t(locale, 'servicesPick')}</p>
        <div
          role="group"
          aria-label={t(locale, 'servicesPick')}
          className="flex flex-wrap gap-2"
        >
          {orderedPresets.map((preset) => {
            const on = lines.some((line) => line.choice === preset.id)
            const price = preset.defaultPriceCents ?? lastPrices.get(preset.id) ?? null
            return (
              <button
                key={preset.id}
                type="button"
                data-service-name={presetName(preset, locale)}
                aria-pressed={on}
                className={`${chip} ${on ? chipOn : chipOff} flex items-center gap-1.5`}
                onClick={() => toggleService(preset.id)}
              >
                {presetName(preset, locale)}
                {price !== null && (
                  <em className="text-[13px] font-medium not-italic text-text-secondary">
                    {formatUsdShort(price)}
                  </em>
                )}
              </button>
            )
          })}
          <button
            type="button"
            data-service-name={t(locale, 'presetOther')}
            aria-pressed={lines.some((line) => line.choice === 'other')}
            className={`${chip} ${
              lines.some((line) => line.choice === 'other') ? chipOn : chipOff
            }`}
            onClick={() => toggleService('other')}
          >
            {t(locale, 'presetOther')}
          </button>
        </div>
        {errors.services && <p className={errorText}>{errors.services}</p>}
      </div>

      {lines.map((line, index) => (
        <ServiceLineFields
          key={line.key}
          line={line}
          presets={presets}
          locale={locale}
          showPerLine={showPerLine}
          errors={errors.lines[line.key]}
          amountRef={index === 0 ? amountRef : undefined}
          autoFocus={index === 0}
          usePad={numberPad}
          activePad={padShown && padTarget === `line:${line.key}`}
          onAmountFocus={(element) => focusPad(`line:${line.key}`, element)}
          onAmountBlur={blurPad}
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
          usePad={numberPad}
          active={padShown && padTarget === 'cash'}
          padTarget="cash"
          onFieldFocus={(element) => focusPad('cash', element)}
          onFieldBlur={blurPad}
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
          usePad={numberPad}
          active={padShown && padTarget === 'card'}
          padTarget="card"
          onFieldFocus={(element) => focusPad('card', element)}
          onFieldBlur={blurPad}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-control border-[1.5px] border-border-strong">
          {(['cash', 'card'] as const).map((target) => (
            <button
              key={target}
              type="button"
              aria-pressed={tipButtonsTarget === target}
              onClick={() => updateSettings({ tipButtonsTarget: target })}
              className={`min-h-11 px-2.5 text-sm font-semibold ${
                tipButtonsTarget === target
                  ? 'bg-brand-50 text-brand-800'
                  : 'bg-surface text-text-secondary'
              }${target === 'cash' ? ' border-r-[1.5px] border-border-strong' : ''}`}
            >
              {t(locale, target === 'cash' ? 'methodCash' : 'methodCard')}
            </button>
          ))}
        </div>
        {tipOptions.map((option) => {
          const on = targetCents === option.cents
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={on}
              onClick={() => fillTip(option.cents)}
              className={`min-h-11 min-w-11 rounded-control border-[1.5px] px-3 text-sm font-semibold ${
                on
                  ? 'border-positive-text bg-positive-bg text-positive-text'
                  : 'border-border bg-surface'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

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
          <span className="text-2xl font-extrabold tracking-[-0.03em] tabular-nums text-positive-text">
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
        {turn && (
          <Link
            href={paths.copy(turn.id)}
            className={`${secondaryButton} flex min-h-11 items-center justify-center`}
          >
            {t(locale, 'copyTurn')}
          </Link>
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

      </form>
      {padShown &&
        createPortal(
          <NumberPad
            locale={locale}
            onDigit={typeOnPad}
            onBackspace={() => typeOnPad('back')}
            onNext={focusNextPadTarget}
            onSave={() => {
              void saveAndClose()
            }}
          />,
          document.body,
        )}
    </>
  )
}
