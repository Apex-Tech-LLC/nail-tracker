import { useState } from 'react'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { t, tf } from '../../lib/i18n.ts'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'
import { secondaryButton } from '../../ui/styles.ts'

/** What the voice reader learned from fixed drafts, with a way to forget it. Shown only when there is something learned. */
export function LearnedWordsSection() {
  const { locale, learnedWords } = useSettings()
  const [open, setOpen] = useState(false)
  const count = Object.keys(learnedWords).length
  if (count === 0) return null

  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
      <h2 className="font-medium">{t(locale, 'learnedWordsTitle')}</h2>
      <p className="text-sm text-text-secondary">{tf(locale, 'learnedWordsHint', { count: String(count) })}</p>
      <button type="button" onClick={() => setOpen(true)} className={secondaryButton}>
        {t(locale, 'forgetLearnedWords')}
      </button>
      <ConfirmDialog
        open={open}
        title={t(locale, 'forgetLearnedTitle')}
        body={<p>{t(locale, 'forgetLearnedBody')}</p>}
        confirmLabel={t(locale, 'forgetLearnedWords')}
        cancelLabel={t(locale, 'cancel')}
        danger
        onConfirm={() => {
          updateSettings({ learnedWords: {} })
          setOpen(false)
        }}
        onCancel={() => setOpen(false)}
      />
    </section>
  )
}
