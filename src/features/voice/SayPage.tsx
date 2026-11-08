import { IconX } from '@tabler/icons-react'
import { useId, useRef, useState } from 'react'
import { paths, useAppLocation, useGoBack } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db } from '../../db/schema.ts'
import { todayIso } from '../../domain/dates.ts'
import { lastPrice } from '../../domain/quickPicks.ts'
import { readVoice } from '../../domain/voiceReader.ts'
import { t } from '../../lib/i18n.ts'
import { errorText, field, label, primaryButton } from '../../ui/styles.ts'
import { WorkDateField } from '../../ui/WorkDateField.tsx'
import { loadQuickPickEntries } from '../turns/turnStore.ts'
import {
  cardsFromReader,
  sessionDate,
  updateVoiceSession,
  useVoiceSession,
} from './voiceSession.ts'

/** Pick the day, say or type the jobs, and make draft turns out of them. */
export function SayPage() {
  const { locale, defaultCommissionRateBp, cashTipHandling, cardTipHandling } = useSettings()
  const goBack = useGoBack()
  const [, navigate] = useAppLocation()
  const session = useVoiceSession()
  const id = useId()
  const today = useToday()
  const [error, setError] = useState('')
  const making = useRef(false)
  const date = session.date ?? today

  async function makeTurns() {
    if (making.current) return
    if (session.text.trim() === '') {
      setError(t(locale, 'sayNothing'))
      return
    }
    making.current = true
    try {
      const presets = await db.servicePresets
        .orderBy('sortOrder')
        .filter((preset) => preset.isActive)
        .toArray()
      const entries = await loadQuickPickEntries(db, todayIso())
      const result = readVoice({
        text: session.text,
        locale,
        presets: presets.map((preset) => ({
          id: preset.id,
          nameEn: preset.nameEn,
          nameVi: preset.nameVi,
          defaultPriceCents: preset.defaultPriceCents,
        })),
        lastPrices: lastPrice(entries),
      })
      updateVoiceSession({
        cards: cardsFromReader(
          result,
          presets,
          { defaultCommissionRateBp, cashTipHandling, cardTipHandling },
          sessionDate({ ...session, date }),
        ),
        notUnderstood: result.notUnderstood,
        made: true,
      })
      navigate(paths.sayCheck)
    } finally {
      making.current = false
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void makeTurns()
      }}
      className="flex min-h-[calc(100dvh-2rem)] flex-col gap-5"
    >
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          aria-label={t(locale, 'close')}
          className="flex min-h-11 min-w-11 items-center justify-center"
        >
          <IconX size={22} aria-hidden="true" />
        </button>
        <h1 className="font-medium">{t(locale, 'sayYourTurns')}</h1>
        <span className="w-11" />
      </header>

      <WorkDateField value={date} onChange={(value) => updateVoiceSession({ date: value })} />

      <div>
        <label htmlFor={`${id}-text`} className={label}>
          {t(locale, 'sayTextLabel')}
        </label>
        <p id={`${id}-hint`} className="mb-2 text-sm text-text-secondary">
          {t(locale, 'sayHint')}
        </p>
        {/* A plain text box on purpose: the phone's own keyboard, with its mic, never the app's number pad. */}
        <textarea
          id={`${id}-text`}
          rows={9}
          value={session.text}
          lang={locale}
          aria-describedby={`${id}-hint ${id}-example`}
          aria-invalid={!!error}
          onChange={(event) => {
            updateVoiceSession({ text: event.target.value })
            if (error) setError('')
          }}
          className={`${field} text-[17px] leading-relaxed`}
        />
        <p id={`${id}-example`} className="mt-2 text-sm text-text-muted">
          {t(locale, 'sayExample')}
        </p>
        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}
      </div>

      <div className="mt-auto">
        <button type="submit" className={primaryButton}>
          {t(locale, 'makeTurns')}
        </button>
      </div>
    </form>
  )
}
