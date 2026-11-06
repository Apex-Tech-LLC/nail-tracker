import { useId, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { resetSettings, useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { t, tf } from '../../lib/i18n.ts'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'
import { dangerButton, field, label } from '../../ui/styles.ts'
import { deleteAllData } from './deleteAllData.ts'

export function DeleteAllSection() {
  const { locale } = useSettings()
  const [, navigate] = useLocation()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const deleteInFlight = useRef(false)

  const word = t(locale, 'deleteAllWord')
  const confirmed = typed.trim() === word

  function openDialog() {
    setTyped('')
    setOpen(true)
  }

  async function confirm() {
    if (deleteInFlight.current || !confirmed) return
    deleteInFlight.current = true
    try {
      await deleteAllData(db)
      resetSettings()
      setOpen(false)
      navigate(paths.onboarding, { replace: true })
    } finally {
      deleteInFlight.current = false
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-xs text-text-secondary">{t(locale, 'deleteAllData')}</h2>
      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
        <p className="text-xs text-text-secondary">{t(locale, 'deleteAllHint')}</p>
        <button type="button" onClick={openDialog} className={dangerButton}>
          {t(locale, 'deleteAllData')}
        </button>
      </div>

      <ConfirmDialog
        open={open}
        title={t(locale, 'deleteAllTitle')}
        body={
          <>
            <p>{tf(locale, 'deleteAllBody', { word })}</p>
            <label htmlFor={inputId} className={`${label} mt-3`}>
              {t(locale, 'deleteAllInput')}
            </label>
            <input
              id={inputId}
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className={field}
            />
          </>
        }
        confirmLabel={t(locale, 'deleteAllData')}
        cancelLabel={t(locale, 'cancel')}
        danger
        confirmDisabled={!confirmed}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </section>
  )
}
