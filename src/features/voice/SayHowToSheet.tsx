import type { RefObject } from 'react'
import { useSettings } from '../../app/settings.ts'
import { t, type StringKey } from '../../lib/i18n.ts'
import { SayBottomSheet } from './SayBottomSheet.tsx'

interface Props {
  onClose: () => void
  /** Where focus goes when nothing in the page had it before the sheet opened (the first time). */
  fallbackFocus: RefObject<HTMLElement | null>
}

const STEPS: StringKey[] = [
  'sayHowToStep1',
  'sayHowToStep2',
  'sayHowToStep3',
  'sayHowToStep4',
  'sayHowToStep5',
  'sayHowToStep6',
]
const EXAMPLES: StringKey[] = ['sayHowToExample1', 'sayHowToExample2', 'sayHowToExample3']

/** A small bottom sheet that shows how to use the Say screen. */
export function SayHowToSheet({ onClose, fallbackFocus }: Props) {
  const { locale } = useSettings()

  return (
    <SayBottomSheet
      title={t(locale, 'sayHowToTitle')}
      titleId="say-how-to-title"
      onClose={onClose}
      fallbackFocus={fallbackFocus}
      closeLabel={t(locale, 'sayHowToGotIt')}
    >
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-snug marker:font-semibold marker:text-text-secondary">
        {STEPS.map((key) => (
          <li key={key} className="pl-1">
            {t(locale, key)}
          </li>
        ))}
      </ol>

      <ul className="flex flex-col gap-1.5 rounded-control border border-border bg-surface-subtle p-3 text-[15px] leading-snug text-text-secondary">
        {EXAMPLES.map((key) => (
          <li key={key}>{`“${t(locale, key)}”`}</li>
        ))}
      </ul>
    </SayBottomSheet>
  )
}
