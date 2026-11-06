import { IconAlertTriangle, IconShieldCheck } from '@tabler/icons-react'
import { useId, useState } from 'react'
import { Link } from 'wouter'
import { PageHeader } from '../../app/PageHeader.tsx'
import { paths } from '../../app/navigation.ts'
import type { PayPeriodType } from '../../app/settings.ts'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { isIsoDate, todayIso, weekRange } from '../../domain/dates.ts'
import { parseRateBp, rateToInput } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { usePersistState } from '../../pwa/persistStorage.ts'
import { PercentField } from '../../ui/PercentField.tsx'
import { Row } from '../../ui/Row.tsx'
import { TileGroup } from '../../ui/TileGroup.tsx'
import { card, field, label, secondaryButton } from '../../ui/styles.ts'
import { BackupSection } from '../backup/BackupSection.tsx'
import { DeleteAllSection } from '../backup/DeleteAllSection.tsx'
import { TipHandlingFields } from './TipHandlingFields.tsx'

type RateChoice = '6000' | '5000' | 'custom'
type WeekStartChoice = 'sunday' | 'monday'

export function SettingsPage() {
  const {
    locale,
    defaultCommissionRateBp: rate,
    perServiceRates,
    weekStartDay,
    payPeriodType,
    payPeriodAnchorDate,
  } = useSettings()
  const [customOpen, setCustomOpen] = useState(rate !== 6000 && rate !== 5000)
  const [customText, setCustomText] = useState(() => rateToInput(rate))
  const [customInvalid, setCustomInvalid] = useState(false)
  const anchorId = useId()
  const perServiceHintId = useId()

  function chooseRate(choice: RateChoice) {
    setCustomInvalid(false)
    if (choice === 'custom') {
      setCustomText(rateToInput(rate))
      setCustomOpen(true)
      return
    }
    setCustomOpen(false)
    updateSettings({ defaultCommissionRateBp: Number(choice) })
  }

  function changeCustomRate(value: string) {
    setCustomText(value)
    const bp = parseRateBp(value)
    if (bp === null) {
      setCustomInvalid(true)
      return
    }
    setCustomInvalid(false)
    updateSettings({ defaultCommissionRateBp: bp })
  }

  // A weekly or biweekly schedule counts from the first day of a period, so
  // start it on the first day of the week the person is working in.
  function chooseSchedule(type: PayPeriodType) {
    const needsAnchor = type === 'weekly' || type === 'biweekly'
    if (needsAnchor && payPeriodAnchorDate === null) {
      updateSettings({
        payPeriodType: type,
        payPeriodAnchorDate: weekRange(todayIso(), weekStartDay).start,
      })
      return
    }
    updateSettings({ payPeriodType: type })
  }

  return (
    <>
      <PageHeader title={t(locale, 'settingsTitle')} languageButton={false} />
      {/* Language names stay in their own language so anyone can find theirs. No flags. */}
      <TileGroup<Locale>
        legend={t(locale, 'language')}
        name="language"
        value={locale}
        onChange={(value) => updateSettings({ locale: value })}
        options={[
          { value: 'vi', glyph: 'Vi', label: 'Tiếng Việt', lang: 'vi' },
          { value: 'en', glyph: 'Aa', label: 'English', lang: 'en' },
        ]}
      />

      <TileGroup<RateChoice>
        legend={t(locale, 'defaultCommission')}
        name="commission"
        value={customOpen ? 'custom' : rate === 5000 ? '5000' : '6000'}
        onChange={chooseRate}
        options={[
          { value: '6000', label: '60%' },
          { value: '5000', label: '50%' },
          { value: 'custom', label: t(locale, 'customRate') },
        ]}
      />
      {customOpen && (
        <PercentField
          label={t(locale, 'customRateLabel')}
          value={customText}
          onChange={changeCustomRate}
          error={customInvalid ? t(locale, 'errorRate') : undefined}
        />
      )}

      <div>
        <label className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            className="size-5"
            checked={perServiceRates}
            onChange={(event) => updateSettings({ perServiceRates: event.target.checked })}
            aria-describedby={perServiceHintId}
          />
          <span>{t(locale, 'perServiceRates')}</span>
        </label>
        <p id={perServiceHintId} className="text-sm text-text-secondary">{t(locale, 'perServiceRatesHint')}</p>
      </div>

      <div className={card}>
        <Row label={t(locale, 'commissionBasis')} value={t(locale, 'commissionBasisValue')} />
      </div>

      <TileGroup<WeekStartChoice>
        legend={t(locale, 'weekStart')}
        name="week-start"
        value={weekStartDay === 1 ? 'monday' : 'sunday'}
        onChange={(value) => updateSettings({ weekStartDay: value === 'monday' ? 1 : 0 })}
        options={[
          { value: 'sunday', label: t(locale, 'sunday') },
          { value: 'monday', label: t(locale, 'monday') },
        ]}
      />

      <TileGroup<PayPeriodType>
        legend={t(locale, 'paydaySchedule')}
        name="pay-schedule"
        value={payPeriodType}
        onChange={chooseSchedule}
        options={[
          { value: 'weekly', label: t(locale, 'scheduleWeekly') },
          { value: 'biweekly', label: t(locale, 'scheduleBiweekly') },
          { value: 'custom', label: t(locale, 'scheduleCustom') },
          { value: 'none', label: t(locale, 'scheduleNone') },
        ]}
      />

      {(payPeriodType === 'weekly' || payPeriodType === 'biweekly') && (
        <div>
          <label htmlFor={anchorId} className={label}>
            {t(locale, 'anchorDate')}
          </label>
          <input
            id={anchorId}
            type="date"
            value={payPeriodAnchorDate ?? ''}
            onChange={(event) => {
              if (isIsoDate(event.target.value)) {
                updateSettings({ payPeriodAnchorDate: event.target.value })
              }
            }}
            aria-describedby={`${anchorId}-hint`}
            className={field}
          />
          <p id={`${anchorId}-hint`} className="mt-1 text-sm text-text-secondary">
            {t(locale, 'anchorDateHint')}
          </p>
        </div>
      )}

      <TipHandlingFields />

      <Link href={paths.services} className={secondaryButton + ' block text-center'}>
        {t(locale, 'manageServices')}
      </Link>

      <div className={card}>
        <Row label={t(locale, 'currency')} value={t(locale, 'currencyUsd')} />
      </div>

      <div className={card}>
        <Row label={t(locale, 'theme')} value={t(locale, 'themeLight')} />
      </div>

      <StorageStatus />
      <BackupSection />
      <DeleteAllSection />
      {/* Only the build id is forced LTR; the label stays in the page direction. */}
      <p className="mt-auto text-center text-xs text-text-muted">
        {t(locale, 'version')} <span dir="ltr">{__BUILD_ID__} · {__BUILD_DATE__}</span>
      </p>
    </>
  )
}

function StorageStatus() {
  const { locale } = useSettings()
  const state = usePersistState()
  if (!state) return null
  const safe = state === 'persisted'
  const Icon = safe ? IconShieldCheck : IconAlertTriangle

  return (
    <section>
      <h2 className="mb-2 text-xs text-text-secondary">{t(locale, 'storage')}</h2>
      <div className="flex gap-3 rounded-card border border-border bg-surface p-3">
        <Icon size={20} aria-hidden="true" className={`mt-0.5 flex-none ${safe ? 'text-brand-600' : 'text-warning-text'}`} />
        <div>
          <p className="text-sm">{t(locale, safe ? 'storagePersisted' : 'storageAtRisk')}</p>
          <p className="text-xs text-text-secondary">{t(locale, safe ? 'storagePersistedHint' : 'storageAtRiskHint')}</p>
        </div>
      </div>
    </section>
  )
}
