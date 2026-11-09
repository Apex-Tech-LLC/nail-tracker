import { IconX } from '@tabler/icons-react'
import { useId, useRef, useState } from 'react'
import { paths, useAppLocation, useGoBack } from '../../app/navigation.ts'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db, type ServicePreset } from '../../db/schema.ts'
import { todayIso } from '../../domain/dates.ts'
import { lastPrice } from '../../domain/quickPicks.ts'
import {
  answerAsReaderResult,
  chatGptPrompt,
  looksLikeChatGptAnswer,
  readChatGptAnswer,
} from '../../domain/chatGptAnswer.ts'
import { readVoice, type ReaderPreset, type ReaderResult } from '../../domain/voiceReader.ts'
import { t } from '../../lib/i18n.ts'
import { errorText, field, primaryButton } from '../../ui/styles.ts'
import { WorkDateField } from '../../ui/WorkDateField.tsx'
import { loadQuickPickEntries } from '../turns/turnStore.ts'
import {
  cardsFromReader,
  sessionDate,
  updateVoiceSession,
  useVoiceSession,
} from './voiceSession.ts'
import { ChatGptPromptSheet } from './ChatGptPromptSheet.tsx'
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
  // 'copied': the prompt is on the clipboard. 'manual': the phone refused, so the prompt is shown in a sheet to copy by hand.
  const [prompt, setPrompt] = useState<{ text: string; state: 'copied' | 'manual' } | null>(null)
  const textBox = useRef<HTMLTextAreaElement>(null)
  // Opens by itself the first time; the link opens it again. Closing it any way counts as seen.
  const [howToOpen, setHowToOpen] = useState(!sayHowToSeen)
  const date = session.date ?? today
  // Dictation never has braces; a pasted ChatGPT answer always does, even a cut-off one.
  const isAnswer = looksLikeChatGptAnswer(session.text)

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
      const result = isAnswer
        ? answerAsReaderResult(readChatGptAnswer({ text: session.text, presets: readerPresets, lastPrices }))
        : readVoice({
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
      // iPhone can refuse: show the instructions in a sheet to copy by hand.
      setPrompt({ text, state: 'manual' })
      return
    }
    setPrompt({ text, state: 'copied' })
    openChatGpt()
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void makeTurns()
      }}
      className="flex h-[calc(100dvh-2rem)] flex-col gap-3"
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
        <button
          type="button"
          onClick={() => setHowToOpen(true)}
          className="min-h-11 px-2 text-sm font-semibold text-brand-ink underline focus-visible:outline-2 focus-visible:outline-brand-ink"
        >
          {t(locale, 'sayHowToOpen')}
        </button>
      </header>

      <WorkDateField value={date} onChange={(value) => updateVoiceSession({ date: value })} />

      <p id={`${id}-hint`} className="text-sm leading-snug text-text-secondary">
        {t(locale, 'sayHint')}
      </p>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={`${id}-text`} className="text-sm font-semibold text-text-secondary">
            {t(locale, 'sayTextLabel')}
          </label>
          {isAnswer && (
            <span
              role="status"
              className="rounded-full bg-positive-bg px-2 py-0.5 text-xs font-bold text-positive-text"
            >
              {t(locale, 'sayAnswerFound')}
            </span>
          )}
        </div>
        {/* A plain text box on purpose: the phone's own keyboard, with its mic, never the app's number pad.
            A pasted ChatGPT answer is only ever read as data; it is shown here as plain text and nowhere else. */}
        <textarea
          ref={textBox}
          id={`${id}-text`}
          rows={5}
          value={session.text}
          lang={locale}
          aria-describedby={`${id}-hint`}
          aria-invalid={!!error}
          onChange={(event) => {
            updateVoiceSession({ text: event.target.value })
            if (error) setError('')
          }}
          className={`${field} min-h-[9rem] flex-1 resize-none leading-relaxed ${
            isAnswer ? 'font-mono text-sm' : 'text-[17px]'
          }`}
        />
        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <button type="submit" className={primaryButton}>
          {t(locale, 'makeTurns')}
        </button>
        <button
          type="button"
          onClick={() => void copyForChatGpt()}
          className="min-h-11 px-3 text-sm font-semibold text-brand-ink underline focus-visible:outline-2 focus-visible:outline-brand-ink"
        >
          {t(locale, 'useChatGpt')}
        </button>
        {prompt?.state === 'copied' && (
          <p role="status" className="text-center text-sm text-text-secondary">
            {t(locale, 'chatGptCopied')}
          </p>
        )}
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
      {prompt?.state === 'manual' && (
        <ChatGptPromptSheet
          prompt={prompt.text}
          fallbackFocus={textBox}
          onOpenChatGpt={openChatGpt}
          onClose={() => setPrompt(null)}
        />
      )}
    </form>
  )
}
