import { IconX } from '@tabler/icons-react'
import { useRef, useState, type FormEvent } from 'react'
import { updateSettings, useSettings } from '../../app/settings.ts'
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

/** Weekly and monthly goals, both optional. An empty box means no goal of that kind. */
export function GoalsPage({ onDone }: { onDone: () => void }) {
  const { locale, numberPad, weeklyGoalCents, monthlyGoalCents } = useSettings()
  const formRef = useRef<HTMLFormElement | null>(null)
  const [weeklyText, setWeeklyText] = useState(() =>
    weeklyGoalCents === null ? '' : centsToInput(weeklyGoalCents),
  )
  const [monthlyText, setMonthlyText] = useState(() =>
    monthlyGoalCents === null ? '' : centsToInput(monthlyGoalCents),
  )
  const [errors, setErrors] = useState<GoalErrors>({})
  const [padTarget, setPadTarget] = useState<GoalTarget | null>(null)
  const [padReplace, setPadReplace] = useState(false)

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
    requestAnimationFrame(() => element.scrollIntoView({ block: 'nearest' }))
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

  function save(event?: FormEvent) {
    event?.preventDefault()
    const next: GoalErrors = {}
    const weekly = weeklyText.trim() === '' ? null : parseCents(weeklyText)
    const monthly = monthlyText.trim() === '' ? null : parseCents(monthlyText)
    if (weekly === null && weeklyText.trim() !== '') next.weekly = t(locale, 'errorAmount')
    if (monthly === null && monthlyText.trim() !== '') next.monthly = t(locale, 'errorAmount')
    setErrors(next)
    if (Object.keys(next).length > 0) return
    updateSettings({
      weeklyGoalCents: weekly,
      monthlyGoalCents: monthly,
    })
    onDone()
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDone}
          aria-label={t(locale, 'close')}
          className="flex min-h-11 min-w-11 items-center justify-center"
        >
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 break-words text-center text-lg font-semibold leading-tight">
          {t(locale, 'goals')}
        </h1>
        <span className="w-11" />
      </header>

      <form ref={formRef} noValidate onSubmit={save} className="flex flex-col gap-4">
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
          onFieldBlur={(event) => blurPad('weekly', event.relatedTarget)}
        />

        <MoneyField
          label={t(locale, 'goalMonthly')}
          value={monthlyText}
          onChange={(value) => changeText('monthly', value)}
          error={errors.monthly}
          usePad={numberPad}
          active={padTarget === 'monthly'}
          padTarget="monthly"
          onFieldFocus={(element) => focusPad('monthly', element)}
          onFieldBlur={(event) => blurPad('monthly', event.relatedTarget)}
        />

        <button type="submit" className={primaryButton}>
          {t(locale, 'save')}
        </button>
        {padTarget !== null && <div className="h-[280px]" aria-hidden="true" />}
      </form>

      {numberPad && padTarget !== null && (
        <NumberPad
          locale={locale}
          onDigit={typeOnPad}
          onBackspace={() => typeOnPad('back')}
          onNext={() => {
            if (padTarget === 'weekly') setPadTarget('monthly')
            else {
              setPadTarget(null)
              setPadReplace(false)
            }
            setPadReplace(true)
          }}
          onSave={() => {
            setPadTarget(null)
            setPadReplace(false)
            formRef.current?.requestSubmit()
          }}
        />
      )}
    </>
  )
}
