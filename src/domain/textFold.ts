// Lower-cases text and drops accents, so "Sơn Gel" and "son gel" compare equal.
// Plain TypeScript: no React, no database.

export const foldText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
