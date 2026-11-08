import { formatUsd } from '../../domain/money.ts'
import type { TaxYearSummary } from '../../domain/taxes.ts'
import { t } from '../../lib/i18n.ts'
import { bilingual, TOTAL_ROWS } from '../taxes/taxCsv.ts'
import type { ShareLayoutInput } from './shareLayout.ts'

/** The same rows as the tax CSV: English with the Vietnamese term beside each one. */
export function yearPictureInput(year: number, summary: TaxYearSummary): ShareLayoutInput {
  return {
    title: `${t('en', 'yearPictureTitle')} ${year}`,
    titleSub: `${t('vi', 'yearPictureTitle')} ${year}`,
    sections: [
      {
        lines: TOTAL_ROWS.map(({ key, value }) => ({
          label: bilingual(key),
          amount: formatUsd(value(summary)),
        })),
      },
    ],
    footer: t('en', 'madeWithNailTracker'),
  }
}
