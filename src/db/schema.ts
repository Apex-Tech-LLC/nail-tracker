import Dexie, { type EntityTable } from 'dexie'
import type { IsoDate } from '../domain/dates.ts'
import { defaultPayRules, type PayRules } from '../domain/payRules.ts'
import type { AdjustmentCategory } from '../domain/totals.ts'
import { DEFAULT_PRESETS, DEFAULT_SALON } from './seed.ts'

export interface Salon {
  id: string
  name: string
  defaultCommissionRateBp: number | null // null: use the rate in Settings
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface ServicePreset {
  id: string
  salonId: string | null
  nameEn: string
  nameVi: string
  defaultPriceCents: number | null
  defaultCommissionRateBp: number | null
  isCustom: boolean
  sortOrder: number
  isActive: boolean // false: removed by the user, kept so old links still resolve
  createdAt: number
  updatedAt: number
}

export type ClientType = 'unspecified' | 'walkIn' | 'request'

export interface Turn {
  id: string // crypto.randomUUID()
  salonId: string | null
  occurredAt: number // UTC milliseconds
  localWorkDate: IsoDate // the work day this belongs to, even past midnight
  turnCount: number
  clientType: ClientType
  note?: string
  cashTipCents: number
  cardTipCents: number
  // Saved on each turn, so changing a setting later never rewrites history.
  cashTipReceived: boolean
  cardTipReceived: boolean
  serviceRevenueTotalCents: number
  commissionTotalCents: number
  earnedTotalCents: number
  createdAt: number
  updatedAt: number
}

export interface TurnService {
  id: string
  turnId: string
  servicePresetId: string | null
  serviceNameSnapshot: string
  servicePriceCents: number
  commissionRateSnapshotBp: number
  commissionCents: number
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface Adjustment {
  id: string
  occurredAt: number
  localWorkDate: IsoDate
  amountCents: number // signed
  category: AdjustmentCategory
  note?: string
  createdAt: number
  updatedAt: number
}

export type PaymentMethod = 'cash' | 'check' | 'directDeposit' | 'zelle' | 'other'

export interface Payment {
  id: string
  paymentDate: IsoDate
  amountCents: number
  paymentMethod: PaymentMethod
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface PaymentAllocation {
  id: string
  paymentId: string
  payPeriodId: string
  amountCents: number
}

export interface PayPeriod {
  id: string
  startDate: IsoDate
  endDate: IsoDate
  status: 'open' | 'closed'
  createdAt: number
  updatedAt: number
}

export interface PaycheckRecord {
  id: string
  payPeriodId: string
  stubServicesCents: number | null
  stubTipsCents: number | null
  stubDeductionsCents: number | null
  note?: string
  checkedDate: IsoDate | null
  createdAt: number
  updatedAt: number
}

export interface WorkDay {
  date: IsoDate // primary key: one record per work day
  dayOff: boolean
  startTime: string | null // 'HH:MM', filled by hours tracking later; null in this task
  endTime: string | null
  createdAt: number
  updatedAt: number
}

export type NailDb = Dexie & {
  salons: EntityTable<Salon, 'id'>
  servicePresets: EntityTable<ServicePreset, 'id'>
  turns: EntityTable<Turn, 'id'>
  turnServices: EntityTable<TurnService, 'id'>
  adjustments: EntityTable<Adjustment, 'id'>
  payments: EntityTable<Payment, 'id'>
  paymentAllocations: EntityTable<PaymentAllocation, 'id'>
  payPeriods: EntityTable<PayPeriod, 'id'>
  payRules: EntityTable<PayRules, 'id'>
  paycheckRecords: EntityTable<PaycheckRecord, 'id'>
  workDays: EntityTable<WorkDay, 'date'>
}

/**
 * Opens the database. Each schema change gets a new version() with an
 * upgrade() that converts old data; never edit a released version.
 */
export function createDb(name = 'nail-tracker'): NailDb {
  const db = new Dexie(name) as NailDb

  db.version(1).stores({
    salons: 'id',
    servicePresets: 'id, sortOrder',
    turns: 'id, localWorkDate, occurredAt, updatedAt',
    turnServices: 'id, turnId, serviceNameSnapshot',
    adjustments: 'id, localWorkDate',
    payments: 'id, paymentDate',
    paymentAllocations: 'id, paymentId, payPeriodId',
    payPeriods: 'id, startDate, endDate',
  })

  db.version(2)
    .stores({
      payRules: 'id, startDate',
      paycheckRecords: 'id, payPeriodId',
    })
    .upgrade(async (tx) => {
      const firstTurn = await tx.table('turns').orderBy('localWorkDate').first()
      await tx.table('payRules').add(defaultPayRules(firstTurn?.localWorkDate))
    })

  // No upgrade step: a work day with no record is a normal working day.
  db.version(3).stores({
    workDays: 'date',
  })

  // Runs once, when the database is first created.
  db.on('populate', (tx) => {
    tx.table('salons').add(DEFAULT_SALON)
    tx.table('servicePresets').bulkAdd(DEFAULT_PRESETS)
    tx.table('payRules').add(defaultPayRules())
  })

  return db
}

export const db = createDb()
