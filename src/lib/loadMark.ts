// Each screen marks its own database reads, from the first read to the data
// being ready. The speed test reads the last entry of each name.

export type LoadMark = 'load:home' | 'load:reports' | 'load:history' | 'load:paycheck'

export function startLoad(mark: LoadMark): void {
  performance.mark(`${mark}:start`)
}

export function endLoad(mark: LoadMark): void {
  performance.measure(mark, `${mark}:start`)
}
