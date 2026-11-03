import { IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useSettings } from '../../app/settings.ts'
import { db, type Category, type Expense } from '../../db/schema.ts'
import { t } from '../../lib/i18n.ts'
import { addDays, daysInMonth, fromCalendar, monthName, toCalendar, todayIso } from '../../lib/jalali.ts'
import { formatAmount, parseAmount } from '../../lib/money.ts'
import { numberToWords } from '../../lib/numberWords.ts'
import { CategoryIcon } from './CategoryIcon.tsx'
import { addExpense, updateExpense } from './expenseStore.ts'

interface Props {
  expenseId?: string
  onDone: () => void
}

type Errors = Partial<Record<'amount' | 'category' | 'date', string>>

/** Loads what the form needs, then mounts it with its starting values. */
export function ExpenseForm({ expenseId, onDone }: Props) {
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray())
  // null = not found, undefined = still loading.
  const existing = useLiveQuery(async () => (expenseId ? ((await db.expenses.get(expenseId)) ?? null) : null), [expenseId])

  if (!categories || existing === undefined) return null
  return <ExpenseFormFields expense={existing ?? undefined} categories={categories} onDone={onDone} />
}

interface FieldsProps {
  expense?: Expense
  categories: Category[]
  onDone: () => void
}

function ExpenseFormFields({ expense, categories, onDone }: FieldsProps) {
  const { locale, calendar } = useSettings()
  const id = useId()
  const amountRef = useRef<HTMLInputElement>(null)
  const today = todayIso()
  const yesterday = addDays(today, -1)

  const [amountText, setAmountText] = useState(expense ? formatAmount(expense.amount, locale) : '')
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '')
  const [date, setDate] = useState(expense?.date ?? today)
  const [pickOther, setPickOther] = useState(!!expense && expense.date !== today && expense.date !== yesterday)
  const [note, setNote] = useState(expense?.note ?? '')
  const [errors, setErrors] = useState<Errors>({})

  const amount = parseAmount(amountText)
  const words = amount ? numberToWords(amount, locale) : ''
  const parts = toCalendar(date, calendar)

  function setDatePart(part: 'year' | 'month' | 'day', value: number) {
    const next = { ...parts, [part]: value }
    next.day = Math.min(next.day, daysInMonth(next.year, next.month, calendar))
    setDate(fromCalendar(next.year, next.month, next.day, calendar))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (!amount) nextErrors.amount = t(locale, 'errorAmount')
    if (!categoryId) nextErrors.category = t(locale, 'errorCategory')
    setErrors(nextErrors)
    if (!amount || !categoryId) {
      if (nextErrors.amount) amountRef.current?.focus()
      return
    }

    const input = { amount, categoryId, date, note }
    if (expense) await updateExpense(db, expense.id, input)
    else await addExpense(db, input)
    onDone()
  }

  const currentYear = toCalendar(today, calendar).year
  const years = [...new Set([parts.year, currentYear - 2, currentYear - 1, currentYear])].sort()
  const dayCount = daysInMonth(parts.year, parts.month, calendar)
  const chip = 'rounded-full border px-3 py-1.5 text-sm'
  const chipOn = 'border-brand-400 bg-brand-50 text-brand-900'
  const chipOff = 'border-border-strong'
  const field = 'w-full rounded-control border border-border-strong bg-surface px-3 py-2'

  return (
    <form onSubmit={submit} noValidate className="flex min-h-[calc(100dvh-2rem)] flex-col gap-5">
      <header className="flex items-center justify-between">
        <button type="button" onClick={onDone} aria-label={t(locale, 'close')} className="p-1">
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="font-medium">{t(locale, expense ? 'editExpense' : 'newExpense')}</h1>
        <span className="w-7" />
      </header>

      <div className="flex flex-col items-center gap-1 text-center">
        <label htmlFor={`${id}-amount`} className="text-xs text-text-secondary">
          {t(locale, 'amount')} ({t(locale, 'toman')})
        </label>
        <input
          ref={amountRef}
          id={`${id}-amount`}
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value)
            if (errors.amount) setErrors({ ...errors, amount: undefined })
          }}
          aria-invalid={!!errors.amount}
          aria-describedby={`${id}-amount-hint`}
          placeholder={formatAmount(0, locale)}
          className="w-full bg-transparent text-center text-3xl font-medium outline-none placeholder:text-text-muted"
        />
        <p id={`${id}-amount-hint`} className={`min-h-5 text-xs ${errors.amount ? 'text-danger-text' : 'text-text-secondary'}`}>
          {errors.amount ?? (words && `${words} ${t(locale, 'toman')}`)}
        </p>
      </div>

      <fieldset aria-describedby={errors.category ? `${id}-category-error` : undefined}>
        <legend className="mb-2 text-xs text-text-secondary">{t(locale, 'category')}</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className={`${chip} flex cursor-pointer items-center gap-1.5 has-focus-visible:outline-2 has-focus-visible:outline-brand-600 ${categoryId === c.id ? chipOn : chipOff}`}>
              <input
                type="radio"
                name="category"
                value={c.id}
                checked={categoryId === c.id}
                onChange={() => {
                  setCategoryId(c.id)
                  setErrors({ ...errors, category: undefined })
                }}
                className="sr-only"
              />
              <span className="-my-1 -ms-1 scale-75">
                <CategoryIcon name={c.icon} />
              </span>
              {c.names[locale]}
            </label>
          ))}
        </div>
        {errors.category && (
          <p id={`${id}-category-error`} className="mt-2 text-xs text-danger-text">
            {errors.category}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs text-text-secondary">{t(locale, 'date')}</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!pickOther && date === today} className={`${chip} ${!pickOther && date === today ? chipOn : chipOff}`} onClick={() => { setPickOther(false); setDate(today) }}>
            {t(locale, 'today')}
          </button>
          <button type="button" aria-pressed={!pickOther && date === yesterday} className={`${chip} ${!pickOther && date === yesterday ? chipOn : chipOff}`} onClick={() => { setPickOther(false); setDate(yesterday) }}>
            {t(locale, 'yesterday')}
          </button>
          <button type="button" aria-pressed={pickOther} className={`${chip} ${pickOther ? chipOn : chipOff}`} onClick={() => setPickOther(true)}>
            {t(locale, 'otherDay')}
          </button>
        </div>
        {pickOther && (
          <div className="mt-3 grid grid-cols-[1fr_2fr_1.3fr] gap-2">
            <select aria-label={t(locale, 'day')} className={field} value={parts.day} onChange={(e) => setDatePart('day', Number(e.target.value))}>
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{formatAmount(d, locale)}</option>
              ))}
            </select>
            <select aria-label={t(locale, 'month')} className={field} value={parts.month} onChange={(e) => setDatePart('month', Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{monthName(m, locale, calendar)}</option>
              ))}
            </select>
            <select aria-label={t(locale, 'year')} className={field} value={parts.year} onChange={(e) => setDatePart('year', Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { useGrouping: false }).format(y)}</option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-note`} className="text-xs text-text-secondary">
          {t(locale, 'note')}
        </label>
        <input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t(locale, 'notePlaceholder')} maxLength={200} className={field} />
      </div>

      <button type="submit" className="mt-auto rounded-control bg-brand-600 p-3 font-medium text-white">
        {t(locale, 'save')}
      </button>
    </form>
  )
}
