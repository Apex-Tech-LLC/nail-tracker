// A service keeps the same colour mark everywhere, chosen by its name alone.
const COLORS = [
  '#a3164d',
  '#d98fb0',
  '#6b2c91',
  '#2c7a91',
  '#c06a2b',
  '#3d8b5f',
  '#8a5a44',
  '#4a5bb5',
] as const

export function serviceColor(name: string): string {
  let hash = 0
  for (const character of name.trim().toLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return COLORS[hash % COLORS.length]
}
