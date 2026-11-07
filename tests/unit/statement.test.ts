import { describe, expect, it } from 'vitest'
import { defaultPayRules, type PayRules } from '../../src/domain/payRules.ts'
import { buildStatement, type StatementService } from '../../src/domain/statement.ts'
import { sumTotals, type AdjustmentFigures, type TurnFigures } from '../../src/domain/totals.ts'

const DAYS = [
  '2026-11-01',
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
]

function rules(overrides: Partial<PayRules> = {}): PayRules[] {
  return [{ ...defaultPayRules('2000-01-01'), ...overrides }]
}

/** 45 services worth $2,500: 44 at $55 and one at $80, all at 60%. */
function specServices(): StatementService[] {
  const services: StatementService[] = Array.from({ length: 44 }, (_, index) => ({
    localWorkDate: DAYS[index % 6],
    priceCents: 5500,
    commissionRateBp: 6000,
    commissionCents: 3300,
  }))
  services.push({
    localWorkDate: DAYS[6],
    priceCents: 8000,
    commissionRateBp: 6000,
    commissionCents: 4800,
  })
  return services
}

/** 40 turns over 6 days: $400 card tips (held) and $300 cash tips (in hand). */
function specTurns(): TurnFigures[] {
  return Array.from({ length: 40 }, (_, index) => ({
    localWorkDate: DAYS[index % 6],
    turnCount: 1,
    serviceRevenueTotalCents: 0,
    commissionTotalCents: 0,
    cashTipCents: index < 6 ? 5000 : 0,
    cardTipCents: 1000,
    cashTipReceived: index < 6,
    cardTipReceived: false,
  }))
}

function turnFigures(overrides: Partial<TurnFigures> = {}): TurnFigures {
  return {
    localWorkDate: '2026-11-04',
    turnCount: 1,
    serviceRevenueTotalCents: 0,
    commissionTotalCents: 0,
    cashTipCents: 0,
    cardTipCents: 0,
    cashTipReceived: false,
    cardTipReceived: false,
    ...overrides,
  }
}

const SPEC_RULES = (): PayRules[] =>
  rules({
    supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' },
    cardTipFeeBp: 300,
    checkBp: 5000,
    cardTipsPaidIn: 'split',
  })

describe('buildStatement, the section 5.5 example', () => {
  it('produces the whole statement exactly', () => {
    const statement = buildStatement({
      services: specServices(),
      turns: specTurns(),
      adjustments: [],
      rules: SPEC_RULES(),
      periodEnd: '2026-11-07',
    })

    expect(statement).toMatchObject({
      daysWorked: 6,
      turns: 40,
      services: 45,
      servicesTotalCents: 250_000,
      supplyFeeCents: 9_000,
      supplyFeeWhen: 'beforeSplit',
      shareRateBp: 6000,
      shareBaseCents: 241_000,
      shareCents: 144_600,
      cardTipsCents: 40_000,
      cardTipsHeldCents: 40_000,
      cardTipFeeCents: 1_200,
      adjustmentsCents: 0,
      guaranteeTopUpCents: 0,
      salonPaysCents: 183_400,
      checkCents: 91_700,
      cashCents: 91_700,
      cashTipsInHandCents: 30_000,
      earnedTotalCents: 213_400,
    })
  })

  it('takes the fee off the share when it is charged after the split', () => {
    const statement = buildStatement({
      services: specServices(),
      turns: specTurns(),
      adjustments: [],
      rules: rules({
        supplyFee: { kind: 'perService', cents: 200, when: 'afterSplit' },
        cardTipFeeBp: 300,
        checkBp: 5000,
      }),
      periodEnd: '2026-11-07',
    })

    expect(statement.shareBaseCents).toBe(250_000)
    expect(statement.shareCents).toBe(141_000)
    expect(statement.salonPaysCents).toBe(179_800)
  })

  it('applies a supply fee percent to each service the same way', () => {
    const services: StatementService[] = Array.from({ length: 3 }, (_, index) => ({
      localWorkDate: DAYS[index],
      priceCents: 10_000,
      commissionRateBp: 6000,
      commissionCents: 6000,
    }))

    const before = buildStatement({
      services,
      turns: [],
      adjustments: [],
      rules: rules({ supplyFee: { kind: 'percent', bp: 300, when: 'beforeSplit' } }),
      periodEnd: '2026-11-07',
    })
    const after = buildStatement({
      services,
      turns: [],
      adjustments: [],
      rules: rules({ supplyFee: { kind: 'percent', bp: 300, when: 'afterSplit' } }),
      periodEnd: '2026-11-07',
    })

    expect(before.supplyFeeCents).toBe(900)
    expect(before.shareCents).toBe(17_460)
    expect(after.shareCents).toBe(17_100)
  })

  it('uses the rules that were in force on each service day', () => {
    const services: StatementService[] = [
      { localWorkDate: '2026-11-01', priceCents: 10_000, commissionRateBp: 6000, commissionCents: 6000 },
      { localWorkDate: '2026-11-02', priceCents: 10_000, commissionRateBp: 6000, commissionCents: 6000 },
      { localWorkDate: '2026-11-03', priceCents: 10_000, commissionRateBp: 6000, commissionCents: 6000 },
      { localWorkDate: '2026-11-04', priceCents: 10_000, commissionRateBp: 6000, commissionCents: 6000 },
      { localWorkDate: '2026-11-05', priceCents: 10_000, commissionRateBp: 6000, commissionCents: 6000 },
    ]
    const turns: TurnFigures[] = [
      turnFigures({ localWorkDate: '2026-11-02', cardTipCents: 1000 }),
      turnFigures({ localWorkDate: '2026-11-05', cardTipCents: 1000 }),
    ]
    const changingRules: PayRules[] = [
      {
        ...defaultPayRules('2000-01-01'),
        supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' },
        cardTipFeeBp: 0,
      },
      {
        ...defaultPayRules('2026-11-04'),
        id: 'november',
        supplyFee: { kind: 'perService', cents: 500, when: 'beforeSplit' },
        cardTipFeeBp: 300,
      },
    ]

    const statement = buildStatement({
      services,
      turns,
      adjustments: [],
      rules: changingRules,
      periodEnd: '2026-11-07',
    })

    expect(statement.supplyFeeCents).toBe(1_600)
    expect(statement.shareCents).toBe(29_040)
    expect(statement.cardTipFeeCents).toBe(30)
  })

  it('splits odd cents so check and cash always add up', () => {
    const statement = buildStatement({
      services: [
        { localWorkDate: '2026-11-04', priceCents: 0, commissionRateBp: 0, commissionCents: 0 },
      ],
      turns: [turnFigures({ cardTipCents: 183_401 })],
      adjustments: [],
      rules: rules({ checkBp: 5000 }),
      periodEnd: '2026-11-07',
    })

    expect(statement.salonPaysCents).toBe(183_401)
    expect(statement.checkCents).toBe(91_701)
    expect(statement.cashCents).toBe(91_700)
  })

  it('puts card tips paid in check wholly into the check part', () => {
    const statement = buildStatement({
      services: specServices(),
      turns: specTurns(),
      adjustments: [],
      rules: rules({
        supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' },
        cardTipFeeBp: 300,
        checkBp: 5000,
        cardTipsPaidIn: 'check',
      }),
      periodEnd: '2026-11-07',
    })

    expect(statement.checkCents).toBe(111_100)
    expect(statement.cashCents).toBe(72_300)
    expect((statement.checkCents ?? 0) + (statement.cashCents ?? 0)).toBe(statement.salonPaysCents)
  })

  it('charges no per-service fee for a zero-priced service', () => {
    const statement = buildStatement({
      services: [
        { localWorkDate: '2026-11-04', priceCents: 10_000, commissionRateBp: 6000, commissionCents: 6000 },
        { localWorkDate: '2026-11-04', priceCents: 0, commissionRateBp: 6000, commissionCents: 0 },
      ],
      turns: [],
      adjustments: [],
      rules: rules({ supplyFee: { kind: 'perService', cents: 200, when: 'beforeSplit' } }),
      periodEnd: '2026-11-07',
    })

    expect(statement.supplyFeeCents).toBe(200)
    expect(statement.shareCents).toBe(5_880)
  })

  it('counts only adjustments that change pay, and adds the others to earnings', () => {
    const adjustments: AdjustmentFigures[] = [
      { amountCents: 1_000, category: 'bonus' },
      { amountCents: -500, category: 'bookkeepingDeduction' },
    ]

    const statement = buildStatement({
      services: [],
      turns: [],
      adjustments,
      rules: rules(),
      periodEnd: '2026-11-07',
    })

    expect(statement.adjustmentsCents).toBe(1_000)
    expect(statement.salonPaysCents).toBe(1_000)
    expect(statement.earnedTotalCents).toBe(500)
  })

  it('keeps a day-by-day line for each work date', () => {
    const statement = buildStatement({
      services: specServices(),
      turns: specTurns(),
      adjustments: [],
      rules: SPEC_RULES(),
      periodEnd: '2026-11-07',
    })

    expect(statement.byDay.map((day) => day.date)).toEqual(DAYS.slice(0, 6).concat(DAYS[6]))
    const firstDay = statement.byDay[0]
    expect(firstDay.servicesTotalCents).toBeGreaterThan(0)
    expect(firstDay.cardTipsCents).toBeGreaterThan(0)
  })
})

describe('buildStatement and sumTotals, with no fees and no split', () => {
  it('agree on what the salon owes and what was earned, held cash tips included', () => {
    const turns: TurnFigures[] = [
      turnFigures({
        localWorkDate: '2026-11-02',
        serviceRevenueTotalCents: 10_000,
        commissionTotalCents: 6_000,
        cashTipCents: 1_500,
      }),
      turnFigures({ localWorkDate: '2026-11-03', cashTipCents: 2_000, cashTipReceived: true }),
      turnFigures({ localWorkDate: '2026-11-04', cardTipCents: 3_000 }),
      turnFigures({ localWorkDate: '2026-11-05', cardTipCents: 2_500, cardTipReceived: true }),
      turnFigures({ localWorkDate: '2026-11-06', turnCount: 0 }),
    ]
    const services: StatementService[] = [
      {
        localWorkDate: '2026-11-02',
        priceCents: 10_000,
        commissionRateBp: 6000,
        commissionCents: 6_000,
      },
    ]
    const adjustments: AdjustmentFigures[] = [
      { amountCents: 1_200, category: 'bonus' },
      { amountCents: -300, category: 'bookkeepingDeduction' },
    ]

    const statement = buildStatement({
      services,
      turns,
      adjustments,
      rules: [defaultPayRules()],
      periodEnd: '2026-11-07',
    })
    const totals = sumTotals(turns, adjustments)

    expect(statement.cashTipsHeldCents).toBe(1_500)
    expect(statement.salonPaysCents).toBe(totals.expectedPayoutCents)
    expect(statement.earnedTotalCents).toBe(totals.earnedCents)
    expect(statement.shareCents).toBe(totals.commissionCents)
    expect(statement.checkCents).toBeNull()
    expect(statement.cashCents).toBeNull()
  })
})
