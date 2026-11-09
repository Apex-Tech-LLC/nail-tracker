import { IconMicrophone, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
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
import { timeOf, todayIso, type IsoDate } from '../../domain/dates.ts'
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
  type TurnInput,
} from './turnStore.ts'
import {
  newLine,
  presetName,
  tipCents,
  turnInputFromForm,
  type Errors,
  type TurnFormValues,
} from './turnInput.ts'

const CLIENT_TYPES: {
  value: ClientType
  key: 'clientUnspecified' | 'clientWalkIn' | 'clientRequest'
}[] = [
  { value: 'unspecified', key: 'clientUnspecified' },
  { value: 'walkIn', key: 'clientWalkIn' },
  { value: 'request', key: 'clientRequest' },
]

/**
 * A new turn's first line: the last service used, with its usual price or else
 * the last one charged. It is only a guess until the person types a price.
 */
function startingLine(
  preset: ServicePreset | undefined,
  fallbackRateBp: number,
  lastPrices: ReadonlyMap<string, number>,
): LineState {
  const line = {
    ...newLine(preset?.id ?? 'other', preset?.defaultCommissionRateBp ?? fallbackRateBp),
    guess: true,
  }
  const priceCents = preset ? (preset.defaultPriceCents ?? lastPrices.get(preset.id) ?? null) : null
  return priceCents === null ? line : { ...line, amount: centsToInput(priceCents) }
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
  'flex min-h-11 flex-none items-center gap-1 whitespace-nowrap rounded-control bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-ink-strong'

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
        <Link href={paths.today} replace className="text-brand-ink underline">
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

/**
 * The form used to fix one draft turn from the voice Check screen. It starts
 * from the draft's values and hands the edited values back; nothing is saved.
 */
export interface DraftMode {
  initial: TurnFormValues
  /** Open More options at the start, so a time or client type to fix is in view. */
  moreOpen?: boolean
  onSave: (values: TurnFormValues) => void
}

/** The Add turn form in draft mode: its presets are loaded here, and there are no saved turns to read. */
export function DraftTurnForm({ draft, onClose }: { draft: DraftMode; onClose: () => void }) {
  const presets = useLiveQuery(() =>
    db.servicePresets
      .orderBy('sortOrder')
      .filter((preset) => preset.isActive)
      .toArray(),
  )
  if (!presets) return null
  return (
    <TurnFormFields
      presets={presets}
      existing={null}
      quick={null}
      copy={false}
      onDone={onClose}
      onClose={onClose}
      draft={draft}
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
  draft?: DraftMode
}

export function TurnFormFields({ presets, existing, quick, copy, onDone, onClose, draft }: FieldsProps) {
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

  const initial = draft?.initial
  const [lines, setLines] = useState<LineState[]>(() =>
    initial
      ? initial.lines
      : existing && existing.services.length > 0
      ? existing.services.map((service) =>
          copy
            ? copiedLineFromService(service, presets)
            : lineFromService(service, presets),
        )
      : [
          startingLine(
            initialPreset,
            defaultCommissionRateBp,
            quick ? lastPrice(quick.entries) : new Map(),
          ),
        ],
  )
  const [cashText, setCashText] = useState(
    initial
      ? initial.cashText
      : source && source.cashTipCents > 0
        ? centsToInput(source.cashTipCents)
        : '',
  )
  const [cardText, setCardText] = useState(
    initial
      ? initial.cardText
      : source && source.cardTipCents > 0
        ? centsToInput(source.cardTipCents)
        : '',
  )
  // The tip box filled by the % button keeps following the services total
  // until the person types in it or taps another tip button.
  const [percentTipBox, setPercentTipBox] = useState<'cash' | 'card' | null>(null)
  const [date, setDate] = useState<IsoDate>(initial?.date ?? turn?.localWorkDate ?? today)
  const [turnCountText, setTurnCountText] = useState(
    initial?.turnCountText ?? String(source?.turnCount ?? 1),
  )
  const [time, setTime] = useState(initial?.time ?? (turn ? timeOf(turn.occurredAt) : ''))
  const [clientType, setClientType] = useState<ClientType>(
    initial?.clientType ?? source?.clientType ?? 'unspecified',
  )

  const [cashTipReceived, setCashTipReceived] = useState(
    initial
      ? initial.cashTipReceived
      : source
        ? source.cashTipReceived
        : cashTipHandling === 'inHand',
  )
  const [cardTipReceived, setCardTipReceived] = useState(
    initial
      ? initial.cardTipReceived
      : source
        ? source.cardTipReceived
        : cardTipHandling === 'inHand',
  )
  const [note, setNote] = useState(initial?.note ?? source?.note ?? '')
  const [moreOpen, setMoreOpen] = useState(
    initial
      ? !!draft?.moreOpen
      : source
        ? source.turnCount !== 1 ||
            source.clientType !== 'unspecified' ||
            (source.note ?? '').trim() !== ''
        : false,
  )
  const [savedAddAnother, setSavedAddAnother] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Errors>({ lines: {} })
  const [padTarget, setPadTarget] = useState<string | null>(null)
  // A box that just gained pad focus (or was just filled by a chip or tip
  // button) has its whole value replaced by the next digit or dot.
  const [padReplace, setPadReplace] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const toast = useToast()

  // A quick double tap fires submit twice before React can re-render. The ref
  // is set synchronously, so the second call does nothing.
  const saveInFlight = useRef(false)
  const amountRef = useRef<HTMLInputElement | null>(null)
  const lastSavedChoice = useRef(initialPreset?.id ?? 'other')
  const lastSavedPriceCents = useRef<number | null>(null)

  const serviceCents = lines.reduce(
    (sum, line) => sum + (parseCents(line.amount) ?? 0),
    0,
  )
  const percentTipCents = roundDiv(serviceCents * 1800, 10_000)
  const cashShown = percentTipBox === 'cash' ? centsToInput(percentTipCents) : cashText
  const cardShown = percentTipBox === 'card' ? centsToInput(percentTipCents) : cardText
  const cashCents = tipCents(cashShown)
  const cardCents = tipCents(cardShown)
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
  const tipOptions = [
    ...TIP_VALUES.map((cents) => ({ label: formatUsdShort(cents), cents, percent: false })),
    { label: '18%', cents: percentTipCents, percent: true },
  ]
  const targetText = tipButtonsTarget === 'cash' ? cashShown : cardShown
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
    if (target === 'cash') return cashShown
    if (target === 'card') return cardShown
    const key = target.slice('line:'.length)
    return lines.find((line) => line.key === key)?.amount ?? ''
  }

  function changePadText(target: string, value: string) {
    if (target === 'cash' || target === 'card') {
      typeTip(target, value)
    } else {
      const key = target.slice('line:'.length)
      updateLine(key, (line) => ({ ...line, amount: value, guess: false }))
      clearLineError(key, 'amount')
    }
    changed()
  }

  /** One key from the app's pad: a digit or dot append, `back` removes the last character. */
  function typeOnPad(key: string) {
    if (!padTarget) return
    const current = padTextFor(padTarget)
    const next =
      key === 'back'
        ? current.slice(0, -1)
        : padReplace
          ? padAmount('', key)
          : padAmount(current, key)
    setPadReplace(false)
    if (next !== current) changePadText(padTarget, next)
  }

  function focusPad(target: string, element: HTMLInputElement) {
    if (!numberPad) return
    setPadTarget(target)
    setPadReplace(true)
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
    setPadReplace(false)
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
      setPadReplace(false)
      return
    }
    setPadTarget(next)
    setPadReplace(true)
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
    const only = lines.length === 1 ? lines[0] : undefined
    const guess =
      only?.guess &&
      only.customName.trim() === '' &&
      !(showPerLine && only.rateTouched)
        ? only
        : undefined
    if (guess && guess.choice !== choice) {
      // The starting service was only a guess: the chip tapped takes its place.
      setLines([lineForChoice(choice)])
      forgetLines([guess.key])
    } else if (matching.length > 0) {
      setLines((previous) => previous.filter((line) => line.choice !== choice))
      forgetLines(matching.map((line) => line.key))
    } else {
      setLines((previous) => [...previous, lineForChoice(choice)])
    }
    setErrors((previous) =>
      previous.services ? { ...previous, services: undefined } : previous,
    )
    // A chip that filled a price leaves the next pad key in replace mode.
    setPadReplace(true)
    changed()
  }

  function addService() {
    setLines((previous) => [...previous, lineForChoice('other')])
    setErrors((previous) =>
      previous.services ? { ...previous, services: undefined } : previous,
    )
    setPadReplace(true)
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
    setPadReplace(true)
    changed()
  }

  /** A tip typed by hand, which stops the box following the % button. */
  function typeTip(box: 'cash' | 'card', value: string) {
    if (box === 'cash') setCashText(value)
    else setCardText(value)
    if (percentTipBox === box) setPercentTipBox(null)
    clearError(box)
  }

  /** A tip button fills the chosen box; tapping the pressed one empties it again. */
  function fillTip(cents: number, percent: boolean) {
    const box = tipButtonsTarget
    const pressed = targetCents === cents
    typeTip(box, pressed ? '' : centsToInput(cents))
    if (percent && !pressed) setPercentTipBox(box)
    setPadReplace(true)
    changed()
  }

  function changeSharedRate(value: string) {
    setLines((previous) =>
      previous.map((line) => ({ ...line, rate: value, rateTouched: true })),
    )
    clearRateErrors()
    changed()
  }

  /** The form as the shared input builder reads it. */
  function formValues(): TurnFormValues {
    return {
      lines,
      cashText: cashShown,
      cardText: cardShown,
      turnCountText,
      date,
      time,
      clientType,
      cashTipReceived,
      cardTipReceived,
      note,
    }
  }

  /** The built input, or null after showing what is wrong. */
  function buildInput(): TurnInput | null {
    const built = turnInputFromForm(formValues(), presets, locale, turn)
    if ('input' in built) {
      setErrors({ lines: {} })
      return built.input
    }
    const nextErrors = built.errors
    // A hidden error would be invisible: open More options for the count.
    if (nextErrors.turnCount) setMoreOpen(true)
    // The shared rate lives under a pill: open it so its error can be read.
    if (Object.values(nextErrors.lines).some((line) => line.rate)) setRateOpen(true)
    setErrors(nextErrors)
    return null
  }

  async function save(): Promise<SaveResult | null> {
    if (saveInFlight.current) return null

    const input = buildInput()
    if (!input) return null

    const lastLine = lines[lines.length - 1]
    const lastPreset = presets.find((item) => item.id === lastLine.choice)
    lastSavedChoice.current = lastLine.choice
    lastSavedPriceCents.current = parseCents(lastLine.amount)

    saveInFlight.current = true
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

  /** Draft mode: check the values the same way, then hand them back. No save, no toast. */
  function saveDraft() {
    // A double tap must hand back once, or Back would run twice.
    if (!draft || saveInFlight.current || !buildInput()) return
    saveInFlight.current = true
    draft.onSave(formValues())
    onDone()
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
    if (draft) {
      saveDraft()
      return
    }
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
    // The price just saved is newer than the quick picks loaded with the form.
    const prices = new Map(lastPrices)
    if (lastSavedPriceCents.current !== null) prices.set(choice, lastSavedPriceCents.current)
    const next = startingLine(preset, defaultCommissionRateBp, prices)
    // A commission set for the whole turn carries on to the next one.
    const shared = !showPerLine && lines[0]?.rateTouched ? lines[0].rate : null
    setLines([shared === null ? next : { ...next, rate: shared, rateTouched: true }])
    setCashText('')
    setCardText('')
    setPercentTipBox(null)
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
          numberPad ? 'pb-[280px]' : ''
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
          <h1 className="font-medium">
            {t(locale, draft ? 'draftTurnTitle' : turn ? 'editTurn' : 'newTurn')}
          </h1>
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

        <div className="flex flex-wrap items-center gap-2">
          {!existing && !draft && (
            <Link
              href={paths.say}
              className={`${pill} mr-auto`}
            >
              <IconMicrophone size={18} aria-hidden="true" />
              {t(locale, 'sayYourTurns')}
            </Link>
          )}
          {!draft && (
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
          )}
          {!showPerLine && lines.length > 0 && (
            <button
              type="button"
              aria-expanded={rateOpen}
              aria-label={`${t(locale, 'commission')}: ${lines[0].rate}%`}
              className={`${pill} ml-auto`}
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
            updateLine(line.key, (current) => ({ ...current, amount: value, guess: false }))
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
          value={cashShown}
          onChange={(value) => {
            typeTip('cash', value)
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
          value={cardShown}
          onChange={(value) => {
            typeTip('card', value)
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
                  ? 'bg-brand-50 text-brand-ink-strong'
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
              onClick={() => fillTip(option.cents, option.percent)}
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
        {!turn && !draft && (
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
          {t(locale, draft ? 'draftDone' : 'save')}
        </button>
        {!turn && !draft && (
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
