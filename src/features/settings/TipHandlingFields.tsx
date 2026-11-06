import type { TipHandling } from '../../app/settings.ts'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { t } from '../../lib/i18n.ts'
import { TileGroup } from '../../ui/TileGroup.tsx'

/** The two tip answers, shared by Settings and the tips step of onboarding. */
export function TipHandlingFields() {
  const { locale, cashTipHandling, cardTipHandling } = useSettings()

  return (
    <div>
      <TileGroup<TipHandling>
        legend={t(locale, 'cashTipHandling')}
        name="cash-tips"
        value={cashTipHandling}
        onChange={(value) => updateSettings({ cashTipHandling: value })}
        options={[
          { value: 'inHand', label: t(locale, 'tipInHand') },
          { value: 'fromSalon', label: t(locale, 'tipFromSalon') },
        ]}
      />

      <div>
        <TileGroup<TipHandling>
          legend={t(locale, 'cardTipHandling')}
          name="card-tips"
          value={cardTipHandling}
          onChange={(value) => updateSettings({ cardTipHandling: value })}
          options={[
            { value: 'inHand', label: t(locale, 'tipInHand') },
            { value: 'fromSalon', label: t(locale, 'tipFromSalon') },
          ]}
        />
        <p className="mt-1 text-sm text-text-secondary">{t(locale, 'tipHandlingHint')}</p>
      </div>
    </div>
  )
}
