// What the last 30 days of turns suggest for the next one: the services used,
// their last prices and the whole-turn combinations worth one tap.
// Plain TypeScript: no React, no database.

export interface QuickPickLine {
  // The service preset id, or `name:<lower-cased name>` with no preset.
  key: string
  name: string
  priceCents: number
}

export interface QuickPickEntry {
  turn: { id: string; occurredAt: number }
  lines: QuickPickLine[]
}

export interface QuickPickCombo {
  lines: QuickPickLine[]
  count: number
}

/** How many turns used each service key (once per turn, even with repeat lines). */
export function serviceUse(entries: readonly QuickPickEntry[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    const keys = new Set(entry.lines.map((line) => line.key))
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

/** The price on the most recent turn that used each service key. */
export function lastPrice(entries: readonly QuickPickEntry[]): Map<string, number> {
  const newest = new Map<string, { at: number; priceCents: number }>()

  for (const entry of entries) {
    for (const line of entry.lines) {
      const seen = newest.get(line.key)
      if (!seen || entry.turn.occurredAt > seen.at) {
        newest.set(line.key, { at: entry.turn.occurredAt, priceCents: line.priceCents })
      }
    }
  }

  const prices = new Map<string, number>()
  for (const [key, value] of newest) prices.set(key, value.priceCents)
  return prices
}

/** Order-independent signature of the whole turn: its set of service-and-price pairs. */
function signature(lines: readonly QuickPickLine[]): string {
  return [...new Set(lines.map((line) => `${line.key}\u0000${line.priceCents}`))].sort().join('\u0001')
}

/**
 * The whole-turn combinations used at least twice, most used first and, on a
 * tie, the one used most recently. The lines keep the order of the most recent
 * turn that used them.
 */
export function topCombos(
  entries: readonly QuickPickEntry[],
  limit = 4,
): QuickPickCombo[] {
  const groups = new Map<
    string,
    { count: number; at: number; lines: QuickPickLine[] }
  >()

  for (const entry of entries) {
    if (entry.lines.length === 0) continue
    const key = signature(entry.lines)
    const group = groups.get(key)
    if (!group) {
      groups.set(key, { count: 1, at: entry.turn.occurredAt, lines: entry.lines })
      continue
    }
    group.count += 1
    if (entry.turn.occurredAt >= group.at) {
      group.at = entry.turn.occurredAt
      group.lines = entry.lines
    }
  }

  return [...groups.values()]
    .filter((group) => group.count >= 2)
    .sort((a, b) => b.count - a.count || b.at - a.at)
    .slice(0, limit)
    .map((group) => ({ lines: [...group.lines], count: group.count }))
}
