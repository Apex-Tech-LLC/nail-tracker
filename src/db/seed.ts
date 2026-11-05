import type { Salon, ServicePreset } from './schema.ts'

export const DEFAULT_SALON: Salon = {
  id: 'default',
  name: 'My salon',
  defaultCommissionRateBp: null,
  isActive: true,
  createdAt: 0,
  updatedAt: 0,
}

// Readable, stable ids instead of UUIDs, so a backup from one phone matches
// the presets on another. "Other" is not here: the form always adds that chip.
const NAMES: [id: string, nameEn: string, nameVi: string][] = [
  ['manicure', 'Manicure', 'Làm móng tay'],
  ['pedicure', 'Pedicure', 'Làm móng chân'],
  ['gel-manicure', 'Gel Manicure', 'Sơn gel tay'],
  ['gel-pedicure', 'Gel Pedicure', 'Sơn gel chân'],
  ['gel-x', 'Gel-X', 'Gel-X'],
  ['acrylic-full-set', 'Acrylic Full Set', 'Full set bột'],
  ['acrylic-fill', 'Acrylic Fill', 'Dặm bột'],
  ['dip-powder', 'Dip Powder', 'Bột nhúng (Dip)'],
  ['nail-art', 'Nail Art / Design', 'Vẽ móng / Design'],
  ['removal', 'Removal', 'Tháo móng'],
]

export const DEFAULT_PRESETS: ServicePreset[] = NAMES.map(([id, nameEn, nameVi], index) => ({
  id,
  salonId: null,
  nameEn,
  nameVi,
  defaultPriceCents: null,
  defaultCommissionRateBp: null,
  isCustom: false,
  sortOrder: index + 1,
  isActive: true,
  createdAt: 0,
  updatedAt: 0,
}))
