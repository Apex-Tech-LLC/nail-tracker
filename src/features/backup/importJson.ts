import { resolveSettings, type Settings } from '../../app/settings.ts'
import type {
  Adjustment,
  ClientType,
  NailDb,
  PaycheckRecord,
  PayPeriod,
  Payment,
  PaymentAllocation,
  PaymentMethod,
  Salon,
  ServicePreset,
  Turn,
  TurnService,
} from '../../db/schema.ts'
import { isIsoDate } from '../../domain/dates.ts'
import type { FeeWhen, PayRules, SupplyFee } from '../../domain/payRules.ts'
import type { AdjustmentCategory } from '../../domain/totals.ts'
import { ImportError } from './importError.ts'
import { migrateBackup } from './migrateBackup.ts'

export interface ImportResult {
  added: number
  updated: number
  unchanged: number
}

export interface ImportOutcome extends ImportResult {
  settings: Settings | null // set only if the database was empty, so the caller applies it
}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isCents = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)
const isOwnCents = (value: unknown): value is number => isCents(value) && value >= 0
const isRate = (value: unknown): value is number => isCents(value) && value >= 0 && value <= 10_000
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isTextOrNull = (value: unknown): value is string | null =>
  value === null || isText(value)
const isIsoDateOrNull = (value: unknown): value is string | null =>
  value === null || isIsoDate(value)
const isOwnCentsOrNull = (value: unknown): value is number | null =>
  value === null || isOwnCents(value)
const isRateOrNull = (value: unknown): value is number | null => value === null || isRate(value)
const isOptionalText = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string'
const isFeeWhen = (value: unknown): value is FeeWhen =>
  value === 'beforeSplit' || value === 'afterSplit'
const isCardTipsPaidIn = (value: unknown): value is 'check' | 'cash' | 'split' =>
  value === 'check' || value === 'cash' || value === 'split'

const isClientType = (value: unknown): value is ClientType =>
  value === 'unspecified' || value === 'walkIn' || value === 'request'
const isAdjustmentCategory = (value: unknown): value is AdjustmentCategory =>
  value === 'bonus' ||
  value === 'commissionCorrection' ||
  value === 'tipCorrection' ||
  value === 'bookkeepingDeduction'
const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  value === 'cash' ||
  value === 'check' ||
  value === 'directDeposit' ||
  value === 'zelle' ||
  value === 'other'
const isPeriodStatus = (value: unknown): value is 'open' | 'closed' =>
  value === 'open' || value === 'closed'

function toSalon(value: unknown): Salon | null {
  if (!isObject(value)) return null
  const { id, name, defaultCommissionRateBp, isActive, createdAt, updatedAt } = value
  if (!isText(id) || !isText(name) || !isRateOrNull(defaultCommissionRateBp)) return null
  if (typeof isActive !== 'boolean' || !isTime(createdAt) || !isTime(updatedAt)) return null
  return { id, name, defaultCommissionRateBp, isActive, createdAt, updatedAt }
}

function toServicePreset(value: unknown): ServicePreset | null {
  if (!isObject(value)) return null
  const {
    id,
    salonId,
    nameEn,
    nameVi,
    defaultPriceCents,
    defaultCommissionRateBp,
    isCustom,
    sortOrder,
    isActive,
    createdAt,
    updatedAt,
  } = value
  if (!isText(id) || !isText(nameEn) || !isText(nameVi) || !isTextOrNull(salonId)) return null
  if (!isOwnCentsOrNull(defaultPriceCents) || !isRateOrNull(defaultCommissionRateBp)) return null
  if (typeof isCustom !== 'boolean' || typeof isActive !== 'boolean' || !isNumber(sortOrder)) return null
  if (!isTime(createdAt) || !isTime(updatedAt)) return null
  return {
    id,
    salonId,
    nameEn,
    nameVi,
    defaultPriceCents,
    defaultCommissionRateBp,
    isCustom,
    sortOrder,
    isActive,
    createdAt,
    updatedAt,
  }
}

function toTurn(value: unknown): Turn | null {
  if (!isObject(value)) return null
  const {
    id,
    salonId,
    occurredAt,
    localWorkDate,
    turnCount,
    clientType,
    note,
    cashTipCents,
    cardTipCents,
    cashTipReceived,
    cardTipReceived,
    serviceRevenueTotalCents,
    commissionTotalCents,
    earnedTotalCents,
    createdAt,
    updatedAt,
  } = value
  if (!isText(id) || !isTextOrNull(salonId) || !isTime(occurredAt) || !isIsoDate(localWorkDate)) {
    return null
  }
  if (!isCount(turnCount) || !isClientType(clientType) || !isOptionalText(note)) return null
  if (!isOwnCents(cashTipCents) || !isOwnCents(cardTipCents) || !isOwnCents(serviceRevenueTotalCents)) {
    return null
  }
  if (!isCents(commissionTotalCents) || !isCents(earnedTotalCents)) return null
  if (typeof cashTipReceived !== 'boolean' || typeof cardTipReceived !== 'boolean') return null
  if (!isTime(createdAt) || !isTime(updatedAt)) return null
  return {
    id,
    salonId,
    occurredAt,
    localWorkDate,
    turnCount,
    clientType,
    ...(note ? { note } : {}),
    cashTipCents,
    cardTipCents,
    cashTipReceived,
    cardTipReceived,
    serviceRevenueTotalCents,
    commissionTotalCents,
    earnedTotalCents,
    createdAt,
    updatedAt,
  }
}

function toTurnService(value: unknown): TurnService | null {
  if (!isObject(value)) return null
  const {
    id,
    turnId,
    servicePresetId,
    serviceNameSnapshot,
    servicePriceCents,
    commissionRateSnapshotBp,
    commissionCents,
    sortOrder,
    createdAt,
    updatedAt,
  } = value
  if (!isText(id) || !isText(turnId) || !isTextOrNull(servicePresetId)) return null
  if (
    !isText(serviceNameSnapshot) ||
    !isOwnCents(servicePriceCents) ||
    !isRate(commissionRateSnapshotBp) ||
    !isCents(commissionCents) ||
    !isNumber(sortOrder)
  ) {
    return null
  }
  if (!isTime(createdAt) || !isTime(updatedAt)) return null
  return {
    id,
    turnId,
    servicePresetId,
    serviceNameSnapshot,
    servicePriceCents,
    commissionRateSnapshotBp,
    commissionCents,
    sortOrder,
    createdAt,
    updatedAt,
  }
}

function toAdjustment(value: unknown): Adjustment | null {
  if (!isObject(value)) return null
  const { id, occurredAt, localWorkDate, amountCents, category, note, createdAt, updatedAt } = value
  if (!isText(id) || !isTime(occurredAt) || !isIsoDate(localWorkDate)) return null
  if (!isCents(amountCents) || !isAdjustmentCategory(category) || !isOptionalText(note)) return null
  if (!isTime(createdAt) || !isTime(updatedAt)) return null
  return {
    id,
    occurredAt,
    localWorkDate,
    amountCents,
    category,
    ...(note ? { note } : {}),
    createdAt,
    updatedAt,
  }
}

function toPayment(value: unknown): Payment | null {
  if (!isObject(value)) return null
  const { id, paymentDate, amountCents, paymentMethod, notes, createdAt, updatedAt } = value
  if (!isText(id) || !isIsoDate(paymentDate) || !isPaymentMethod(paymentMethod)) return null
  if (!isCents(amountCents) || amountCents <= 0 || !isOptionalText(notes)) return null
  if (!isTime(createdAt) || !isTime(updatedAt)) return null
  return {
    id,
    paymentDate,
    amountCents,
    paymentMethod,
    ...(notes ? { notes } : {}),
    createdAt,
    updatedAt,
  }
}

function toPaymentAllocation(value: unknown): PaymentAllocation | null {
  if (!isObject(value)) return null
  const { id, paymentId, payPeriodId, amountCents } = value
  if (!isText(id) || !isText(paymentId) || !isText(payPeriodId)) return null
  if (!isCents(amountCents) || amountCents <= 0) return null
  return { id, paymentId, payPeriodId, amountCents }
}

function toPayPeriod(value: unknown): PayPeriod | null {
  if (!isObject(value)) return null
  const { id, startDate, endDate, status, createdAt, updatedAt } = value
  if (!isText(id) || !isIsoDate(startDate) || !isIsoDate(endDate)) return null
  if (endDate < startDate || !isPeriodStatus(status)) return null
  if (!isTime(createdAt) || !isTime(updatedAt)) return null
  return { id, startDate, endDate, status, createdAt, updatedAt }
}

function toSupplyFee(value: unknown): SupplyFee | null {
  if (!isObject(value)) return null
  const { kind } = value
  if (kind === 'none') return { kind: 'none' }
  if (kind === 'perService') {
    const { cents, when } = value
    if (!isOwnCents(cents) || !isFeeWhen(when)) return null
    return { kind: 'perService', cents, when }
  }
  if (kind === 'percent') {
    const { bp, when } = value
    if (!isRate(bp) || !isFeeWhen(when)) return null
    return { kind: 'percent', bp, when }
  }
  return null
}

function toPayRules(value: unknown): PayRules | null {
  if (!isObject(value)) return null
  const { id, startDate, supplyFee, cardTipFeeBp, checkBp, cardTipsPaidIn, createdAt, updatedAt } =
    value
  if (!isText(id) || !isIsoDate(startDate)) return null
  const fee = toSupplyFee(supplyFee)
  if (fee === null || !isRate(cardTipFeeBp) || !isRateOrNull(checkBp)) return null
  if (!isCardTipsPaidIn(cardTipsPaidIn)) return null
  if (!isTime(createdAt) || !isTime(updatedAt)) return null
  return {
    id,
    startDate,
    supplyFee: fee,
    cardTipFeeBp,
    checkBp,
    cardTipsPaidIn,
    createdAt,
    updatedAt,
  }
}

function toPaycheckRecord(value: unknown): PaycheckRecord | null {
  if (!isObject(value)) return null
  const {
    id,
    payPeriodId,
    stubServicesCents,
    stubTipsCents,
    stubDeductionsCents,
    note,
    checkedDate,
    createdAt,
    updatedAt,
  } = value
  if (!isText(id) || !isText(payPeriodId)) return null
  if (!isOwnCentsOrNull(stubServicesCents) || !isOwnCentsOrNull(stubTipsCents)) return null
  if (!isOwnCentsOrNull(stubDeductionsCents) || !isOptionalText(note)) return null
  if (!isIsoDateOrNull(checkedDate)) return null
  if (!isTime(createdAt) || !isTime(updatedAt)) return null
  return {
    id,
    payPeriodId,
    stubServicesCents,
    stubTipsCents,
    stubDeductionsCents,
    ...(note ? { note } : {}),
    checkedDate,
    createdAt,
    updatedAt,
  }
}

function readArray(data: Record<string, unknown>, key: string): unknown[] {
  const value = data[key]
  if (!Array.isArray(value)) throw new ImportError('notBackup', key)
  return value
}

function toRecords<T>(values: readonly unknown[], convert: (value: unknown) => T | null, name: string): T[] {
  return values.map((value, index) => {
    const record = convert(value)
    if (record === null) throw new ImportError('invalidRecord', `${name} ${index}`)
    return record
  })
}

function assertUniqueIds(records: readonly { id: string }[], name: string): void {
  const seen = new Set<string>()
  for (const record of records) {
    if (seen.has(record.id)) throw new ImportError('invalidRecord', `duplicate ${name}`)
    seen.add(record.id)
  }
}

interface TimedRecord {
  id: string
  updatedAt: number
}

/** Counts what a merge would do, and returns the records that need writing. */
function pickWrites<T extends TimedRecord>(
  records: readonly T[],
  existing: readonly (T | undefined)[],
  result: ImportResult,
): T[] {
  const writes: T[] = []
  records.forEach((record, index) => {
    const current = existing[index]
    if (!current) {
      result.added += 1
      writes.push(record)
    } else if (record.updatedAt > current.updatedAt) {
      result.updated += 1
      writes.push(record)
    } else {
      result.unchanged += 1
    }
  })
  return writes
}

/**
 * Reads a backup file back into the database. A bad file is refused as a
 * whole before anything is written. Restoring never deletes: records that
 * are not in the file stay, and a record already here is replaced only when
 * the file's copy was edited later. Runs in one transaction, so it is all or
 * nothing.
 */
export async function importJson(db: NailDb, text: string): Promise<ImportOutcome> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ImportError('notJson')
  }
  if (!isObject(parsed) || parsed.app !== 'nail-tracker') throw new ImportError('notBackup')

  const data = migrateBackup(parsed)

  const salons = toRecords(readArray(data, 'salons'), toSalon, 'salon')
  const servicePresets = toRecords(readArray(data, 'servicePresets'), toServicePreset, 'service preset')
  const turns = toRecords(readArray(data, 'turns'), toTurn, 'turn')
  const turnServices = toRecords(readArray(data, 'turnServices'), toTurnService, 'turn service')
  const adjustments = toRecords(readArray(data, 'adjustments'), toAdjustment, 'adjustment')
  const payPeriods = toRecords(readArray(data, 'payPeriods'), toPayPeriod, 'pay period')
  const payments = toRecords(readArray(data, 'payments'), toPayment, 'payment')
  const paymentAllocations = toRecords(
    readArray(data, 'paymentAllocations'),
    toPaymentAllocation,
    'payment allocation',
  )
  const payRules = toRecords(readArray(data, 'payRules'), toPayRules, 'pay rules')
  const paycheckRecords = toRecords(readArray(data, 'paycheckRecords'), toPaycheckRecord, 'paycheck record')

  for (const [records, name] of [
    [salons, 'salon'],
    [servicePresets, 'service preset'],
    [turns, 'turn'],
    [turnServices, 'turn service'],
    [adjustments, 'adjustment'],
    [payPeriods, 'pay period'],
    [payments, 'payment'],
    [paymentAllocations, 'payment allocation'],
    [payRules, 'pay rules'],
    [paycheckRecords, 'paycheck record'],
  ] as const) {
    assertUniqueIds(records, name)
  }

  const turnIds = new Set(turns.map((turn) => turn.id))
  if (turnServices.some((service) => !turnIds.has(service.turnId))) {
    throw new ImportError('invalidRecord', 'turn service link')
  }
  const paymentIds = new Set(payments.map((payment) => payment.id))
  const payPeriodIds = new Set(payPeriods.map((period) => period.id))
  if (
    paymentAllocations.some(
      (allocation) => !paymentIds.has(allocation.paymentId) || !payPeriodIds.has(allocation.payPeriodId),
    )
  ) {
    throw new ImportError('invalidRecord', 'payment allocation link')
  }
  if (paycheckRecords.some((record) => !payPeriodIds.has(record.payPeriodId))) {
    throw new ImportError('invalidRecord', 'paycheck record link')
  }

  return db.transaction(
    'rw',
    [
      db.salons,
      db.servicePresets,
      db.turns,
      db.turnServices,
      db.adjustments,
      db.payPeriods,
      db.payments,
      db.paymentAllocations,
      db.payRules,
      db.paycheckRecords,
    ],
    async (): Promise<ImportOutcome> => {
      const [turnCount, adjustmentCount, paymentCount, periodCount] = await Promise.all([
        db.turns.count(),
        db.adjustments.count(),
        db.payments.count(),
        db.payPeriods.count(),
      ])
      const wasEmpty = turnCount === 0 && adjustmentCount === 0 && paymentCount === 0 && periodCount === 0

      const result: ImportResult = { added: 0, updated: 0, unchanged: 0 }

      const salonWrites = pickWrites(salons, await db.salons.bulkGet(salons.map((r) => r.id)), result)
      if (salonWrites.length > 0) await db.salons.bulkPut(salonWrites)

      const presetWrites = pickWrites(
        servicePresets,
        await db.servicePresets.bulkGet(servicePresets.map((r) => r.id)),
        result,
      )
      if (presetWrites.length > 0) await db.servicePresets.bulkPut(presetWrites)

      const adjustmentWrites = pickWrites(
        adjustments,
        await db.adjustments.bulkGet(adjustments.map((r) => r.id)),
        result,
      )
      if (adjustmentWrites.length > 0) await db.adjustments.bulkPut(adjustmentWrites)

      const periodWrites = pickWrites(
        payPeriods,
        await db.payPeriods.bulkGet(payPeriods.map((r) => r.id)),
        result,
      )
      if (periodWrites.length > 0) await db.payPeriods.bulkPut(periodWrites)

      // A turn and its services move together, so they are never half restored.
      const turnWrites = pickWrites(turns, await db.turns.bulkGet(turns.map((r) => r.id)), result)
      if (turnWrites.length > 0) {
        const writtenTurnIds = new Set(turnWrites.map((turn) => turn.id))
        await db.turnServices.where('turnId').anyOf([...writtenTurnIds]).delete()
        await db.turns.bulkPut(turnWrites)
        const fileServices = turnServices.filter((service) => writtenTurnIds.has(service.turnId))
        if (fileServices.length > 0) await db.turnServices.bulkAdd(fileServices)
      }

      // The same for a payment and its allocations.
      const paymentWrites = pickWrites(
        payments,
        await db.payments.bulkGet(payments.map((r) => r.id)),
        result,
      )
      if (paymentWrites.length > 0) {
        const writtenPaymentIds = new Set(paymentWrites.map((payment) => payment.id))
        await db.paymentAllocations.where('paymentId').anyOf([...writtenPaymentIds]).delete()
        await db.payments.bulkPut(paymentWrites)
        const fileAllocations = paymentAllocations.filter((allocation) =>
          writtenPaymentIds.has(allocation.paymentId),
        )
        if (fileAllocations.length > 0) await db.paymentAllocations.bulkAdd(fileAllocations)
      }

      const ruleWrites = pickWrites(
        payRules,
        await db.payRules.bulkGet(payRules.map((rule) => rule.id)),
        result,
      )
      if (ruleWrites.length > 0) await db.payRules.bulkPut(ruleWrites)

      const paycheckWrites = pickWrites(
        paycheckRecords,
        await db.paycheckRecords.bulkGet(paycheckRecords.map((record) => record.id)),
        result,
      )
      if (paycheckWrites.length > 0) await db.paycheckRecords.bulkPut(paycheckWrites)

      return {
        ...result,
        settings: wasEmpty ? resolveSettings(JSON.stringify(data.settings), ['en']) : null,
      }
    },
  )
}
