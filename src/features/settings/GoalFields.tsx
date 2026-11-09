import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getSettings, updateSettings, useSettings } from '../../app/settings.ts'
import { centsToInput, padAmount, parseCents } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { NumberPad } from '../../ui/NumberPad.tsx'
import { primaryButton } from '../../ui/styles.ts'

type GoalTarget = 'weekly' | 'monthly'

interface GoalErrors {
  weekly?: string
  monthly?: string
}

/** The fixed pad covers about this much of the bottom of the screen. */
export const PAD_HEIGHT = 280

function goalText(cents: number | null): string {
  return cents === null ? '' : centsToInput(cents)
}

/**
 * Weekly and monthly goal boxes with the app's number pad, both optional: an
 * empty box means no goal of that kind. With a Save button (the Goals page)
 * nothing is saved until Save. Without one (Settings) each box saves on the
 * pad's Save or when it loses focus. It never leaves the page itself:
 * `onSaved` tells the page that a Save button was used.
 */
export function GoalFields({
  saveButton = false,
  onSaved,
  onPadChange,
}: {
  saveButton?: boolean
  onSaved?: () => void
  /** Tells the page when the pad opens or closes, so it can leave room under its content. */
  onPadChange?: (open: boolean) => void
}) {
  const { locale, numberPad, weeklyGoalCents, monthlyGoalCents } = useSettings()
  const formRef = useRef<HTMLFormElement | null>(null)
  const monthlyRef = useRef<HTMLInputElement | null>(null)
  const [weeklyText, setWeeklyText] = useState(() => goalText(weeklyGoalCents))
  const [monthlyText, setMonthlyText] = useState(() => goalText(monthlyGoalCents))
  const [errors, setErrors] = useState<GoalErrors>({})
  const [padTarget, setPadTarget] = useState<GoalTarget | null>(null)
  const [padReplace, setPadReplace] = useState(false)

  // A saved goal that changes (a backup restore, or this box saving) shows again.
  const [shownWeekly, setShownWeekly] = useState(weeklyGoalCents)
  if (shownWeekly !== weeklyGoalCents) {
    setShownWeekly(weeklyGoalCents)
    setWeeklyText(goalText(weeklyGoalCents))
    setErrors((previous) => ({ ...previous, weekly: undefined }))
  }
  const [shownMonthly, setShownMonthly] = useState(monthlyGoalCents)
  if (shownMonthly !== monthlyGoalCents) {
    setShownMonthly(monthlyGoalCents)
    setMonthlyText(goalText(monthlyGoalCents))
    setErrors((previous) => ({ ...previous, monthly: undefined }))
  }

  useEffect(() => {
    onPadChange?.(padTarget !== null)
  }, [padTarget, onPadChange])

  function textFor(target: GoalTarget): string {
    return target === 'weekly' ? weeklyText : monthlyText
  }

  function changeText(target: GoalTarget, value: string) {
    if (target === 'weekly') setWeeklyText(value)
    else setMonthlyText(value)
    setErrors((previous) => ({ ...previous, [target]: undefined }))
  }

  /** One key from the app's pad: a digit or dot append, `back` removes the last character. */
  function typeOnPad(key: string) {
    if (!padTarget) return
    const current = textFor(padTarget)
    const next =
      key === 'back'
        ? current.slice(0, -1)
        : padReplace
          ? padAmount('', key)
          : padAmount(current, key)
    setPadReplace(false)
    if (next !== current) changeText(padTarget, next)
  }

  function focusPad(target: GoalTarget, element: HTMLInputElement) {
    if (!numberPad) return
    setPadTarget(target)
    setPadReplace(true)
    // The pad is fixed over the bottom of the screen: bring the box above it.
    requestAnimationFrame(() => {
      element.scrollIntoView({ block: 'nearest' })
      const gap = element.getBoundingClientRect().bottom - (window.innerHeight - PAD_HEIGHT - 32)
      if (gap > 0) window.scrollBy({ top: gap })
    })
  }

  /** The pad stays while focus is on it or on another money box; anywhere else it hides. */
  function blurPad(target: GoalTarget, related: EventTarget | null) {
    if (related instanceof Element) {
      if (related.closest('[data-number-pad]')) return
      if (related.matches('[data-pad-target]')) return
    }
    if (padTarget === target) {
      setPadTarget(null)
      setPadReplace(false)
    }
  }

  /** Saves the named boxes. A box that cannot be read shows an error and nothing is saved. */
  function commit(targets: GoalTarget[]): boolean {
    const next: GoalErrors = {}
    const changes: { weeklyGoalCents?: number | null; monthlyGoalCents?: number | null } = {}
    for (const target of targets) {
      const text = textFor(target)
      const cents = text.trim() === '' ? null : parseCents(text)
      if (cents === null && text.trim() !== '') next[target] = t(locale, 'errorAmount')
      else if (target === 'weekly') changes.weeklyGoalCents = cents
      else changes.monthlyGoalCents = cents
    }
    setErrors((previous) => ({ ...previous, ...next }))
    if (Object.keys(next).length > 0) return false
    const saved = getSettings()
    const differs =
      ('weeklyGoalCents' in changes && changes.weeklyGoalCents !== saved.weeklyGoalCents) ||
      ('monthlyGoalCents' in changes && changes.monthlyGoalCents !== saved.monthlyGoalCents)
    if (differs) updateSettings(changes)
    return true
  }

  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (commit(['weekly', 'monthly']) && saveButton) onSaved?.()
  }

  function closePad() {
    setPadTarget(null)
    setPadReplace(false)
  }

  function fieldBlur(target: GoalTarget, related: EventTarget | null) {
    if (!saveButton) commit([target])
    blurPad(target, related)
  }

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">{t(locale, 'goalOptionalHint')}</p>

      <MoneyField
        label={t(locale, 'goalWeekly')}
        value={weeklyText}
        onChange={(value) => changeText('weekly', value)}
        error={errors.weekly}
        usePad={numberPad}
        active={padTarget === 'weekly'}
        padTarget="weekly"
        onFieldFocus={(element) => focusPad('weekly', element)}
        onFieldBlur={(event) => fieldBlur('weekly', event.relatedTarget)}
      />

      <MoneyField
        label={t(locale, 'goalMonthly')}
        value={monthlyText}
        onChange={(value) => changeText('monthly', value)}
        error={errors.monthly}
        inputRef={monthlyRef}
        usePad={numberPad}
        active={padTarget === 'monthly'}
        padTarget="monthly"
        onFieldFocus={(element) => focusPad('monthly', element)}
        onFieldBlur={(event) => fieldBlur('monthly', event.relatedTarget)}
      />

      {saveButton && (
        <button type="submit" className={primaryButton}>
          {t(locale, 'save')}
        </button>
      )}

      {numberPad && padTarget !== null && (
        <NumberPad
          locale={locale}
          onDigit={typeOnPad}
          onBackspace={() => typeOnPad('back')}
          onNext={() => {
            if (padTarget === 'weekly') {
              if (!saveButton) commit(['weekly'])
              // Focus follows the pad, so a tap elsewhere later closes it and saves this box.
              monthlyRef.current?.focus()
            } else {
              closePad()
              // Letting go of the box saves it (Settings) and lets a tap on it open the pad again.
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
            }
          }}
          onSave={() => {
            const target = padTarget
            closePad()
            if (saveButton) formRef.current?.requestSubmit()
            else if (commit([target])) {
              // Let go of the box so a tap on it opens the pad again.
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
            }
          }}
        />
      )}
    </form>
  )
}
