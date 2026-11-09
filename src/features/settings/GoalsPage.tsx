import { IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'
import { GoalFields, PAD_HEIGHT } from './GoalFields.tsx'

/** Weekly and monthly goals on their own page; Home's "Set a goal" link opens it. */
export function GoalsPage({ onDone }: { onDone: () => void }) {
  const { locale } = useSettings()
  const [padOpen, setPadOpen] = useState(false)

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

      <GoalFields saveButton onSaved={onDone} onPadChange={setPadOpen} />
      {padOpen && <div style={{ height: PAD_HEIGHT }} aria-hidden="true" />}
    </>
  )
}
