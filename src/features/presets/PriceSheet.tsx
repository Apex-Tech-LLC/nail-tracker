import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../../app/settings.ts'
import { centsToInput, padAmount, parseCents } from '../../domain/money.ts'
import { t, type StringKey } from '../../lib/i18n.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { NumberPad } from '../../ui/NumberPad.tsx'
import { PAD_HEIGHT } from '../settings/GoalFields.tsx'

/**
 * A bottom sheet with the app's number pad for one price. Save hands the
 * price in cents (null when the box is empty) to `onSave`; Cancel, Escape and
 * a tap on the dim area leave the price unchanged.
 */
export function PriceSheet({
  priceCents,
  name,
  label = 'presetDefaultPrice',
  onSave,
  onClose,
}: {
  priceCents: number | null
  name: string
  label?: StringKey
  onSave: (cents: number | null) => void | Promise<void>
  onClose: () => void
}) {
  const { locale } = useSettings()
  const [text, setText] = useState(() => (priceCents != null ? centsToInput(priceCents) : ''))
  const [error, setError] = useState<string | undefined>()
  // The first key replaces the old price instead of adding to it.
  const [replace, setReplace] = useState(true)
  const saveInFlight = useRef(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function type(key: string) {
    const next =
      key === 'back' ? text.slice(0, -1) : replace ? padAmount('', key) : padAmount(text, key)
    setReplace(false)
    setError(undefined)
    if (next !== text) setText(next)
  }

  async function save() {
    if (saveInFlight.current) return
    const cents = text.trim() === '' ? null : parseCents(text)
    if (cents === null && text.trim() !== '') {
      setError(t(locale, 'errorAmount'))
      return
    }
    saveInFlight.current = true
    try {
      await onSave(cents)
    } catch (failure) {
      saveInFlight.current = false
      throw failure
    }
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${t(locale, label)}: ${name}`}
        className="absolute inset-x-0 mx-auto flex max-w-md flex-col gap-2 rounded-t-card border border-border bg-surface p-4"
        style={{ bottom: PAD_HEIGHT - 16 }}
      >
        <p className="break-words font-medium">{name}</p>
        <MoneyField
          label={t(locale, label)}
          value={text}
          onChange={(value) => {
            setText(value)
            setError(undefined)
          }}
          error={error}
          usePad
          active
          autoFocus
          padTarget="price"
        />
      </div>
      <NumberPad
        locale={locale}
        onDigit={type}
        onBackspace={() => type('back')}
        onNext={onClose}
        onCancel={onClose}
        onSave={() => void save()}
      />
    </div>,
    document.body,
  )
}
