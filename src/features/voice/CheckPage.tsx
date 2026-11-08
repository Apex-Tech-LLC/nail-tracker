import { IconChevronLeft } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { paths, useAppLocation, useGoBack } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { db, type ServicePreset } from '../../db/schema.ts'
import { turnTotals } from '../../domain/commission.ts'
import { formatDayShort, formatTime, localDateTimeToMs, todayIso, addDays } from '../../domain/dates.ts'
import { formatUsd, formatUsdShort, parseCents } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { requestPersistence } from '../../pwa/persistStorage.ts'
import { primaryButton } from '../../ui/styles.ts'
import { useToast } from '../../ui/useToast.ts'
import { presetName, tipCents, turnInputFromForm } from '../turns/turnInput.ts'
import { addTurns, type TurnInput } from '../turns/turnStore.ts'
import { countNotUnderstood, reasonsFor } from './checkReasons.ts'
import {
  clearVoiceSession,
  sessionDate,
  updateVoiceSession,
  useVoiceSession,
  type DraftCard,
} from './voiceSession.ts'

interface Checked {
  card: DraftCard
  // The turn input when the card can be saved, else null.
  input: TurnInput | null
  reasons: string[]
}

function dayText(date: string, locale: Locale): string {
  const today = todayIso()
  const short = formatDayShort(date, locale)
  if (date === today) return `${t(locale, 'today')}, ${short}`
  if (date === addDays(today, -1)) return `${t(locale, 'yesterday')}, ${short}`
  return short
}

/** The draft turns as cards, each with what was heard; nothing is saved until Save. */
export function CheckPage() {
  const session = useVoiceSession()
  const [, navigate] = useAppLocation()
  const presets = useLiveQuery(() =>
    db.servicePresets
      .orderBy('sortOrder')
      .filter((preset) => preset.isActive)
      .toArray(),
  )
  const empty = !session.made

  // After a reload the drafts are gone: start again from Say.
  useEffect(() => {
    if (empty) navigate(paths.say, { replace: true })
  }, [empty, navigate])

  if (empty || !presets) return null
  return <CheckCards presets={presets} />
}

function CheckCards({ presets }: { presets: ServicePreset[] }) {
  const { locale } = useSettings()
  const session = useVoiceSession()
  const goBack = useGoBack()
  const [, navigate] = useAppLocation()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  // A quick double tap fires twice before React re-renders: the ref stops the second.
  const saveInFlight = useRef(false)
  const date = sessionDate(session)

  const checked: Checked[] = session.cards.map((card) => {
    const built = turnInputFromForm({ ...card.values, date }, presets, locale)
    return {
      card,
      input: 'input' in built ? built.input : null,
      reasons: card.reviewed ? [] : reasonsFor(card.reader, presets, locale),
    }
  })
  const blocked = checked.some((item) => item.input === null)
  const inputs = checked.flatMap((item) => (item.input ? [item.input] : []))
  const earnedCents = inputs.reduce(
    (sum, input) =>
      sum +
      turnTotals(
        input.lines.map((line) => ({ priceCents: line.priceCents, rateBp: line.rateBp })),
        input.cashTipCents,
        input.cardTipCents,
      ).earnedTotalCents,
    0,
  )
  const count = session.cards.length

  function remove(key: string) {
    updateVoiceSession({ cards: session.cards.filter((card) => card.key !== key) })
  }

  async function saveAll() {
    if (saveInFlight.current || blocked || inputs.length === 0) return
    saveInFlight.current = true
    setSaving(true)
    try {
      await addTurns(db, inputs)
    } catch (error) {
      saveInFlight.current = false
      setSaving(false)
      throw error
    }
    void requestPersistence()
    clearVoiceSession()
    toast.show({
      message: tf(locale, inputs.length === 1 ? 'savedOneTurn' : 'savedTurns', {
        n: inputs.length,
        amount: formatUsdShort(earnedCents),
      }),
    })
    navigate(paths.today, { replace: true })
  }

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            aria-label={t(locale, 'back')}
            className="flex min-h-11 min-w-11 items-center justify-center"
          >
            <IconChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="font-medium">
            {count === 1 ? t(locale, 'checkOneTurn') : tf(locale, 'checkTurns', { n: count })}
          </h1>
          <span className="w-11" />
        </div>
        <p className="text-sm text-text-secondary">
          {dayText(date, locale)}. {t(locale, 'checkTapToFix')}
        </p>
      </header>

      {count === 0 && session.notUnderstood.length === 0 && (
        <p className="text-text-secondary">{t(locale, 'checkNoTurns')}</p>
      )}

      <ul className="flex flex-col gap-3">
        {checked.map((item, index) => (
          <li key={item.card.key} data-testid="draft-card">
            <CardView
              item={item}
              index={index}
              presets={presets}
              date={date}
              locale={locale}
              onOpen={() => navigate(paths.sayEdit(item.card.key))}
              onRemove={() => remove(item.card.key)}
            />
          </li>
        ))}
      </ul>

      {session.notUnderstood.length > 0 && (
        <ul className="flex flex-col gap-2">
          {session.notUnderstood.map((text, index) => (
            <li
              key={index}
              className="flex flex-col gap-2 rounded-card border border-dashed border-border-strong bg-surface p-3 text-sm"
            >
              <span className="text-text-secondary">
                {countNotUnderstood(text, locale) ?? tf(locale, 'notUnderstood', { text })}
              </span>
              <button
                type="button"
                className="min-h-11 self-start text-sm font-semibold text-brand-ink underline"
                onClick={() => navigate(paths.add)}
              >
                {t(locale, 'addAsTurn')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3" aria-live="polite">
          <span className="text-text-secondary">{t(locale, 'youEarnFromThese')}</span>
          <span
            data-testid="voice-total"
            className="text-2xl font-extrabold tracking-[-0.03em] tabular-nums text-positive-text"
          >
            {formatUsd(earnedCents)}
          </span>
        </div>
        {blocked && (
          <p role="status" className="text-sm font-semibold text-warning-text">
            {t(locale, 'fixOrRemoveFirst')}
          </p>
        )}
        {count === 0 && session.notUnderstood.length > 0 && (
          <p role="status" className="text-sm text-text-secondary">
            {t(locale, 'noTurnsLeft')}
          </p>
        )}
        <button
          type="button"
          disabled={blocked || saving || inputs.length === 0}
          onClick={() => {
            void saveAll()
          }}
          className={`${primaryButton} disabled:opacity-50`}
        >
          {count === 1 ? t(locale, 'saveOneTurn') : tf(locale, 'saveTurns', { n: count })}
        </button>
      </div>
    </div>
  )
}

interface CardViewProps {
  item: Checked
  index: number
  presets: ServicePreset[]
  date: string
  locale: Locale
  onOpen: () => void
  onRemove: () => void
}

function CardView({ item, index, presets, date, locale, onOpen, onRemove }: CardViewProps) {
  const { card, input, reasons } = item
  const { values } = card
  const cash = tipCents(values.cashText) ?? 0
  const cardTip = tipCents(values.cardText) ?? 0
  const flagged = reasons.length > 0 || input === null
  const time = values.time ? formatTime(localDateTimeToMs(date, values.time), locale) : ''

  return (
    <div
      className={`rounded-card border bg-surface ${flagged ? 'border-warning-text/40' : 'border-border'}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-card p-3.5 text-left focus-visible:outline-2 focus-visible:outline-brand-ink"
      >
        {values.lines.length === 0 && (
          <span className="block font-bold text-warning-text">{t(locale, 'noServiceCard')}</span>
        )}
        {values.lines.map((line) => {
          const preset = presets.find((candidate) => candidate.id === line.choice)
          const name = preset ? presetName(preset, locale) : line.customName.trim() || t(locale, 'presetOther')
          const priceCents = parseCents(line.amount)
          return (
            <span key={line.key} className="flex items-baseline justify-between gap-3">
              <span className="font-bold">{name}</span>
              {priceCents === null ? (
                <span className="font-bold text-warning-text">{t(locale, 'noPriceCard')}</span>
              ) : (
                <span className="font-extrabold tabular-nums">{formatUsdShort(priceCents)}</span>
              )}
            </span>
          )
        })}
        <span className="mt-1 flex items-baseline justify-between gap-3 text-[13px] text-text-secondary">
          <span>
            {[time, t(locale, values.clientType === 'request' ? 'clientRequest' : 'clientWalkIn')]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="text-right font-bold text-positive-text">
            {[
              cash > 0 ? tf(locale, 'cardCashTip', { amount: formatUsdShort(cash) }) : '',
              cardTip > 0 ? tf(locale, 'cardCardTip', { amount: formatUsdShort(cardTip) }) : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </span>
        </span>
        {reasons.map((reason, reasonIndex) => (
          <span
            key={reasonIndex}
            className="mt-2 block rounded-lg bg-warning-bg px-2 py-1 text-[13px] font-semibold text-warning-text"
          >
            {t(locale, 'checkThis')}: {reason}
          </span>
        ))}
        {card.reader.heard && (
          <span className="mt-2 block text-[12.5px] italic text-text-muted">
            "{card.reader.heard}"
          </span>
        )}
      </button>
      <div className="flex justify-end border-t border-border px-2">
        <button
          type="button"
          aria-label={tf(locale, 'removeDraft', { n: index + 1 })}
          onClick={onRemove}
          className="min-h-11 px-3 text-sm font-semibold text-danger-text"
        >
          {t(locale, 'remove')}
        </button>
      </div>
    </div>
  )
}
