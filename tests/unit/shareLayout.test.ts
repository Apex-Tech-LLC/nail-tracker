import { describe, expect, it } from 'vitest'
import type { Statement } from '../../src/domain/statement.ts'
import {
  statementItems,
  type StatementEndRules,
  type StatementLine,
} from '../../src/features/paycheck/statementLines.ts'
import {
  layoutShare,
  wrapText,
  type Measure,
  type ShareDrawItem,
  type ShareLayoutInput,
} from '../../src/features/share/shareLayout.ts'
import { t } from '../../src/lib/i18n.ts'

const measure: Measure = (text, font) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16)
  return text.length * size * 0.5
}

const RULES: StatementEndRules = {
  startDate: '2000-01-01',
  supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' },
  cardTipFeeBp: 300,
  checkBp: 5000,
  cardTipsPaidIn: 'split',
  guarantee: { kind: 'none' },
  tiers: null,
}

const STATEMENT: Statement = {
  daysWorked: 6,
  turns: 5,
  services: 6,
  servicesTotalCents: 250_000,
  supplyFeeCents: 1_200,
  supplyFeeWhen: 'beforeSplit',
  shareRateBp: 6000,
  tierRates: null,
  shareBaseCents: 248_800,
  shareCents: 149_280,
  cardTipsCents: 4_000,
  cardTipsHeldCents: 4_000,
  cardTipFeeCents: 120,
  adjustmentsCents: 0,
  guaranteeCents: 0,
  guaranteeDays: 6,
  guaranteeTopUpCents: 0,
  salonPaysCents: 153_160,
  checkCents: 76_580,
  cashCents: 76_580,
  cashTipsInHandCents: 3_000,
  cashTipsHeldCents: 0,
  earnedTotalCents: 156_160,
  byDay: [],
}

type TextItem = Extract<ShareDrawItem, { kind: 'text' }>

function textItems(items: ShareDrawItem[], role: TextItem['role']): TextItem[] {
  return items.filter((item): item is TextItem => item.kind === 'text' && item.role === role)
}

function baseInput(lines: ShareLayoutInput['lines']): ShareLayoutInput {
  return { title: 'Pay statement', titleSub: 'Bảng lương', lines }
}

describe('layoutShare', () => {
  it('grows taller with more lines', () => {
    const one = layoutShare(
      baseInput([{ label: 'Services', amount: '$100.00' }]),
      measure,
    )
    const three = layoutShare(
      baseInput([
        { label: 'Services', amount: '$100.00' },
        { label: 'Your share', amount: '$60.00' },
        { label: 'Tips', amount: '$10.00' },
      ]),
      measure,
    )

    expect(three.height).toBeGreaterThan(one.height)
    expect(three.items.length).toBeGreaterThan(one.items.length)
  })

  it('wraps a long label instead of running under the amount', () => {
    const label =
      'A very long statement label that has to wrap onto more than one line so it never runs under the amount'
    const layout = layoutShare(baseInput([{ label, amount: '$1,234.56' }]), measure)

    const labels = textItems(layout.items, 'label')
    const amounts = textItems(layout.items, 'amount')
    expect(labels.length).toBeGreaterThan(1)
    expect(amounts).toHaveLength(1)
    expect(labels.map((item) => item.text).join(' ')).toBe(label)
    for (const item of labels) {
      expect(item.x + measure(item.text, item.font)).toBeLessThanOrEqual(amounts[0].x - 24)
    }
  })

  it('keeps every wrapped piece inside the width it was given', () => {
    const pieces = wrapText('one two three four five six', '32px', 200, measure)
    for (const piece of pieces) {
      expect(measure(piece, '32px')).toBeLessThanOrEqual(200)
    }
  })
})

function linesOf(items: ReturnType<typeof statementItems>): StatementLine[] {
  return items.flatMap((item) => (item.kind === 'line' ? [item.line] : []))
}

describe('statementItems', () => {
  it('gives the card the same lines in English and Vietnamese', () => {
    const en = statementItems('en', STATEMENT, RULES)
    const vi = statementItems('vi', STATEMENT, RULES)
    const enLines = linesOf(en)
    const viLines = linesOf(vi)

    expect(en.map((item) => item.kind)).toEqual(vi.map((item) => item.kind))
    expect(viLines.map((line) => line.value)).toEqual(enLines.map((line) => line.value))

    expect(enLines[0].label).toBe('Services you did (6 services, 5 turns)')
    expect(viLines[0].label).toBe('Dịch vụ bạn đã làm (6 dịch vụ, 5 turn)')

    const enSalon = enLines.find((line) => line.label === t('en', 'salonShouldPay'))
    const viSalon = viLines.find((line) => line.label === t('vi', 'salonShouldPay'))
    expect(enSalon?.value).toBe('$1,531.60')
    expect(viSalon?.value).toBe('$1,531.60')
    expect(enSalon?.strong).toBe(true)
    expect(viSalon?.strong).toBe(true)

    const ruleIndex = en.findIndex((item) => item.kind === 'rule')
    const salonIndex = en.findIndex(
      (item) => item.kind === 'line' && item.line.label === t('en', 'salonShouldPay'),
    )
    expect(ruleIndex).toBeGreaterThan(0)
    expect(salonIndex).toBe(ruleIndex + 1)
  })
})
