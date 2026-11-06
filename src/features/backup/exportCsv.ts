import type { Adjustment, ClientType, Turn, TurnService } from '../../db/schema.ts'
import { timeOf } from '../../domain/dates.ts'
import { centsToInput } from '../../domain/money.ts'
import { t, type StringKey } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { ADJUSTMENT_LABEL } from '../adjustments/adjustmentLabels.ts'

// Excel only reads a CSV as UTF-8 (and so shows Vietnamese correctly) when
// the file starts with a byte order mark.
const BOM = '\uFEFF'

/**
 * Quotes a cell when needed, and defuses text a spreadsheet would run as a
 * formula (a note like "=HYPERLINK(...)" is written as plain text).
 */
export function csvCell(value: string | number): string {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** A money value: plain digits for spreadsheets, never treated as a possible formula. */
const moneyCell = (cents: number): string => centsToInput(cents)

const HEADER_KEYS = [
  'csvType',
  'csvDate',
  'csvTime',
  'csvTurns',
  'csvServices',
  'csvServiceRevenue',
  'csvCommission',
  'csvCashTip',
  'csvCardTip',
  'csvEarned',
  'csvClientType',
  'csvNote',
] as const satisfies readonly StringKey[]

interface DatedRow {
  date: string
  occurredAt: number
  row: string[]
}

/** Services grouped by turn, each group in the order they were entered. */
function groupServices(services: readonly TurnService[]): Map<string, TurnService[]> {
  const grouped = new Map<string, TurnService[]>()
  for (const service of services) {
    const group = grouped.get(service.turnId)
    if (group) group.push(service)
    else grouped.set(service.turnId, [service])
  }
  for (const group of grouped.values()) {
    group.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
  }
  return grouped
}

/**
 * One row per turn and one per adjustment, oldest first, for opening in a
 * spreadsheet. Dates are ISO and money is plain digits so formulas can add
 * them up.
 */
export function exportCsv(
  turns: readonly Turn[],
  services: readonly TurnService[],
  adjustments: readonly Adjustment[],
  locale: Locale,
): string {
  const grouped = groupServices(services)
  const clientText: Record<ClientType, string> = {
    unspecified: '',
    walkIn: t(locale, 'clientWalkIn'),
    request: t(locale, 'clientRequest'),
  }

  const turnRows: DatedRow[] = turns.map((turn) => ({
    date: turn.localWorkDate,
    occurredAt: turn.occurredAt,
    row: [
      csvCell(t(locale, 'csvRowTurn')),
      csvCell(turn.localWorkDate),
      csvCell(timeOf(turn.occurredAt)),
      String(turn.turnCount),
      csvCell((grouped.get(turn.id) ?? []).map((service) => service.serviceNameSnapshot).join(' + ')),
      moneyCell(turn.serviceRevenueTotalCents),
      moneyCell(turn.commissionTotalCents),
      moneyCell(turn.cashTipCents),
      moneyCell(turn.cardTipCents),
      moneyCell(turn.earnedTotalCents),
      csvCell(clientText[turn.clientType]),
      csvCell(turn.note ?? ''),
    ],
  }))

  const adjustmentRows: DatedRow[] = adjustments.map((adjustment) => ({
    date: adjustment.localWorkDate,
    occurredAt: adjustment.occurredAt,
    row: [
      csvCell(t(locale, 'csvRowAdjustment')),
      csvCell(adjustment.localWorkDate),
      csvCell(timeOf(adjustment.occurredAt)),
      '',
      csvCell(t(locale, ADJUSTMENT_LABEL[adjustment.category])),
      '',
      '',
      '',
      '',
      moneyCell(adjustment.amountCents),
      '',
      csvCell(adjustment.note ?? ''),
    ],
  }))

  const ordered = [...turnRows, ...adjustmentRows].sort((a, b) =>
    a.date === b.date ? a.occurredAt - b.occurredAt : a.date < b.date ? -1 : 1,
  )

  const header = HEADER_KEYS.map((key) => csvCell(t(locale, key)))
  return BOM + [header, ...ordered.map((entry) => entry.row)].map((row) => row.join(',')).join('\r\n') + '\r\n'
}
