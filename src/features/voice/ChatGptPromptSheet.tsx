import { useRef, type RefObject } from 'react'
import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'
import { field, label, primaryButton, secondaryButton } from '../../ui/styles.ts'
import { SayBottomSheet } from './SayBottomSheet.tsx'

interface Props {
  /** The instructions for ChatGPT, to copy by hand because the phone refused to copy them. */
  prompt: string
  onOpenChatGpt: () => void
  onClose: () => void
  fallbackFocus: RefObject<HTMLElement | null>
}

/** Shows the ChatGPT instructions when the phone would not copy them, so they can be copied by hand. */
export function ChatGptPromptSheet({ prompt, onOpenChatGpt, onClose, fallbackFocus }: Props) {
  const { locale } = useSettings()
  const promptBox = useRef<HTMLTextAreaElement>(null)

  return (
    <SayBottomSheet
      title={t(locale, 'chatGptPromptLabel')}
      titleId="chatgpt-prompt-title"
      onClose={onClose}
      fallbackFocus={fallbackFocus}
    >
      <p role="status" className="text-sm text-text-secondary">
        {t(locale, 'chatGptCopyFailed')}
      </p>
      <label htmlFor="chatgpt-prompt-text" className={`${label} sr-only`}>
        {t(locale, 'chatGptPromptLabel')}
      </label>
      <textarea
        ref={promptBox}
        id="chatgpt-prompt-text"
        readOnly
        rows={6}
        value={prompt}
        className={`${field} text-sm`}
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => promptBox.current?.select()} className={secondaryButton}>
          {t(locale, 'selectAll')}
        </button>
        <button type="button" onClick={onOpenChatGpt} className={primaryButton}>
          {t(locale, 'openChatGpt')}
        </button>
      </div>
    </SayBottomSheet>
  )
}
