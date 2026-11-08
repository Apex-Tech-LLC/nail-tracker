import type { IsoDate } from '../../domain/dates.ts'
import { roundDiv } from '../../domain/money.ts'
import type { PayRules } from '../../domain/payRules.ts'
import { buildStatement, type Statement, type StatementService } from '../../domain/statement.ts'
import type { TurnFigures } from '../../domain/totals.ts'

export type RuleValues = Pick<
  PayRules,
  'supplyFee' | 'cardTipFeeBp' | 'checkBp' | 'cardTipsPaidIn' | 'guarantee' | 'tiers'
>

/** The plain examples below explain commission, fees and the split, so tiers and guarantee stay off. */
function exampleRules(values: RuleValues, date: IsoDate): PayRules[] {
  return [
    {
      id: 'example',
      startDate: date,
      ...values,
      guarantee: { kind: 'none' },
      tiers: null,
      createdAt: 0,
      updatedAt: 0,
    },
  ]
}

function exampleService(priceCents: number, rateBp: number, date: IsoDate): StatementService {
  return {
    localWorkDate: date,
    priceCents,
    commissionRateBp: rateBp,
    commissionCents: roundDiv(priceCents * rateBp, 10_000),
  }
}

function exampleTurn(
  cardTipCents: number,
  date: IsoDate,
  cashTipCents = 0,
  cashTipReceived = false,
): TurnFigures {
  return {
    localWorkDate: date,
    turnCount: 1,
    serviceRevenueTotalCents: 0,
    commissionTotalCents: 0,
    cashTipCents,
    cardTipCents,
    cashTipReceived,
    cardTipReceived: false,
  }
}

/**
 * The page's plain example: one $100 service with a $10 card tip, put through
 * the same statement maths the Paycheck screen uses.
 */
export function sampleStatement(
  values: RuleValues,
  rateBp: number,
  date: IsoDate,
): Statement {
  return buildStatement({
    services: [exampleService(10_000, rateBp, date)],
    turns: [exampleTurn(1_000, date)],
    adjustments: [],
    rules: exampleRules(values, date),
    periodEnd: date,
    daysOff: new Set(),
  })
}

/** The spec 5.5 sample: $2,500 of services, $400 held card tips and $300 cash tips in hand. */
export function specStatement(
  values: RuleValues,
  rateBp: number,
  date: IsoDate,
): Statement {
  const services: StatementService[] = Array.from({ length: 44 }, () =>
    exampleService(5_500, rateBp, date),
  )
  services.push(exampleService(8_000, rateBp, date))

  const turns: TurnFigures[] = Array.from({ length: 40 }, (_, index) =>
    exampleTurn(1_000, date, index < 6 ? 5_000 : 0, index < 6),
  )

  return buildStatement({
    services,
    turns,
    adjustments: [],
    rules: exampleRules(values, date),
    periodEnd: date,
    daysOff: new Set(),
  })
}
