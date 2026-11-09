import { IconX } from '@tabler/icons-react'
import { useId, useRef, useState } from 'react'
import { paths, useAppLocation, useGoBack } from '../../app/navigation.ts'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db, type ServicePreset } from '../../db/schema.ts'
import { todayIso } from '../../domain/dates.ts'
import { lastPrice } from '../../domain/quickPicks.ts'
import { answerAsReaderResult, chatGptPrompt, readChatGptAnswer } from '../../domain/chatGptAnswer.ts'
import { readVoice, type ReaderPreset, type ReaderResult } from '../../domain/voiceReader.ts'
import { t } from '../../lib/i18n.ts'
import { errorText, field, label, primaryButton, secondaryButton } from '../../ui/styles.ts'
import { WorkDateField } from '../../ui/WorkDateField.tsx'
import { loadQuickPickEntries } from '../turns/turnStore.ts'
import {
  cardsFromReader,
  sessionDate,
  updateVoiceSession,
  useVoiceSession,
} from './voiceSession.ts'
import { SayHowToSheet } from './SayHowToSheet.tsx'

const CHATGPT_URL = 'https://chatgpt.com'

const readerPreset = (preset: ReaderPreset): ReaderPreset => ({
  id: preset.id,
  nameEn: preset.nameEn,
  nameVi: preset.nameVi,
  defaultPriceCents: preset.defaultPriceCents,
})

function openChatGpt() {
  window.open(CHATGPT_URL, '_blank', 'noopener,noreferrer')
}

/** Pick the day, say or type the jobs, and make draft turns out of them. */
export function SayPage() {
  const { locale, defaultCommissionRateBp, cashTipHandling, cardTipHandling, sayHowToSeen, learnedWords } = useSettings()
  const goBack = useGoBack()
  const [, navigate] = useAppLocation()
  const session = useVoiceSession()
  const id = useId()
  const today = useToday()
  const [error, setError] = useState('')
  const making = useRef(false)
  // 'copied': the prompt is on the clipboard. 'manual': the phone refused, so the prompt is shown to copy by hand.
  const [prompt, setPrompt] = useState<{ text: string; state: 'copied' | 'manual' } | null>(null)
  const promptBox = useRef<HTMLTextAreaElement>(null)
  const textBox = useRef<HTMLTextAreaElement>(null)
  // Opens by itself the first time; the link opens it again. Closing it any way counts as seen.
  const [howToOpen, setHowToOpen] = useState(!sayHowToSeen)
  const date = session.date ?? today

  async function loadReaderContext() {
    const presets = await db.servicePresets
      .orderBy('sortOrder')
      .filter((preset) => preset.isActive)
      .toArray()
    const entries = await loadQuickPickEntries(db, todayIso())
    return { presets, readerPresets: presets.map(readerPreset), lastPrices: lastPrice(entries) }
  }

  async function makeTurns() {
    if (making.current) return
    if (session.text.trim() === '') {
      setError(t(locale, 'sayNothing'))
      return
    }
    making.current = true
    try {
      const { presets, readerPresets, lastPrices } = await loadReaderContext()
      const result = readVoice({
        text: session.text,
        locale,
        presets: readerPresets,
        lastPrices,
        learned: new Map(Object.entries(learnedWords)),
      })
      showCards(result, presets)
    } finally {
      making.current = false
    }
  }

  function showCards(result: ReaderResult, presets: ServicePreset[]) {
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
  }

  async function copyForChatGpt() {
    const { readerPresets } = await loadReaderContext()
    const text = chatGptPrompt(readerPresets)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // iPhone can refuse: show the instructions to copy by hand.
      setPrompt({ text, state: 'manual' })
      return
    }
    setPrompt({ text, state: 'copied' })
    openChatGpt()
  }

  async function checkAnswer() {
    if (making.current) return
    making.current = true
    try {
      const { presets, readerPresets, lastPrices } = await loadReaderContext()
      const answer = readChatGptAnswer({ text: session.answerText, presets: readerPresets, lastPrices })
      showCards(answerAsReaderResult(answer), presets)
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

      <div className="-mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setHowToOpen(true)}
          className="min-h-11 px-2 text-sm font-semibold text-brand-ink underline focus-visible:outline-2 focus-visible:outline-brand-ink"
        >
          {t(locale, 'sayHowToOpen')}
        </button>
      </div>

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
          ref={textBox}
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

      <div className="mt-auto flex flex-col gap-5">
        <section aria-labelledby={`${id}-gpt`} className="flex flex-col gap-3 border-t border-border pt-5">
          <h2 id={`${id}-gpt`} className="sr-only">
            ChatGPT
          </h2>
          <button type="button" onClick={() => void copyForChatGpt()} className={secondaryButton}>
            {t(locale, 'useChatGpt')}
          </button>
          {prompt?.state === 'copied' && (
            <p role="status" className="text-sm text-text-secondary">
              {t(locale, 'chatGptCopied')}
            </p>
          )}
          {prompt?.state === 'manual' && (
            <div className="flex flex-col gap-2">
              <p role="status" className="text-sm text-text-secondary">
                {t(locale, 'chatGptCopyFailed')}
              </p>
              <label htmlFor={`${id}-prompt`} className={label}>
                {t(locale, 'chatGptPromptLabel')}
              </label>
              <textarea
                ref={promptBox}
                id={`${id}-prompt`}
                readOnly
                rows={6}
                value={prompt.text}
                className={`${field} text-sm`}
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => promptBox.current?.select()} className={secondaryButton}>
                  {t(locale, 'selectAll')}
                </button>
                <button type="button" onClick={openChatGpt} className={secondaryButton}>
                  {t(locale, 'openChatGpt')}
                </button>
              </div>
            </div>
          )}
          <div>
            <label htmlFor={`${id}-answer`} className={label}>
              {t(locale, 'pasteAnswer')}
            </label>
            <p id={`${id}-answer-hint`} className="mb-2 text-sm text-text-secondary">
              {t(locale, 'pasteAnswerHint')}
            </p>
            {/* Pasted text is only ever read as data; it is shown here as plain text and nowhere else. */}
            <textarea
              id={`${id}-answer`}
              rows={4}
              value={session.answerText}
              aria-describedby={`${id}-answer-hint`}
              autoCapitalize="off"
              spellCheck={false}
              onChange={(event) => updateVoiceSession({ answerText: event.target.value })}
              className={`${field} font-mono text-sm`}
            />
          </div>
          <button type="button" onClick={() => void checkAnswer()} className={secondaryButton}>
            {t(locale, 'checkAnswer')}
          </button>
        </section>
        <button type="submit" className={primaryButton}>
          {t(locale, 'makeTurns')}
        </button>
      </div>
      {howToOpen && (
        <SayHowToSheet
          fallbackFocus={textBox}
          onClose={() => {
            updateSettings({ sayHowToSeen: true })
            setHowToOpen(false)
          }}
        />
      )}
    </form>
  )
}
