// Layout for the shared pictures. Plain maths only: no canvas, no DOM, so the
// heights and the wrapping can be tested in Node with a fake measurer.

export const SHARE_WIDTH = 1080
export const SHARE_PADDING = 64
export const SHARE_CONTENT_WIDTH = SHARE_WIDTH - SHARE_PADDING * 2

const FONT_FAMILY = '"Be Vietnam Pro", sans-serif'
const AMOUNT_GAP = 24
const LINE_GAP = 10
const SECTION_GAP = 40
const TITLE_GAP = 20
const RULE_GAP = 28
const BAR_GAP = 10

export function shareFont(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT_FAMILY}`
}

const TITLE = { weight: 700, size: 58, line: 74 }
const TITLE_SUB = { weight: 400, size: 32, line: 44 }
const HEADING = { weight: 600, size: 36, line: 48 }
const HEADING_SUB = { weight: 400, size: 26, line: 36 }
const LABEL = { weight: 400, size: 32, line: 44 }
const SUB = { weight: 400, size: 25, line: 34 }
const AMOUNT = { weight: 500, size: 32, line: 44 }
const AMOUNT_STRONG = { weight: 700, size: 38, line: 50 }
const FOOTER = { weight: 400, size: 24, line: 34 }
const BAR_LABEL = { weight: 400, size: 22, line: 30 }

/** Width of a piece of text at a font, given by the canvas in the app and faked in tests. */
export type Measure = (text: string, font: string) => number

export interface ShareLine {
  label: string
  /** A smaller second line, used for the second language or a figure under a name. */
  sub?: string
  amount?: string
  strong?: boolean
  /** A divider rather than a row, as before "Salon should pay you". */
  rule?: boolean
}

export interface ShareSection {
  heading?: string
  headingSub?: string
  lines: ShareLine[]
}

export interface ShareBar {
  label: string
  value: number
  current: boolean
}

export interface ShareBars {
  heading?: string
  bars: ShareBar[]
  height: number
}

export interface ShareLayoutInput {
  title: string
  titleSub?: string
  lines?: ShareLine[]
  sections?: ShareSection[]
  bars?: ShareBars
  footer?: string
}

export type ShareTextRole =
  | 'title'
  | 'titleSub'
  | 'heading'
  | 'headingSub'
  | 'label'
  | 'sub'
  | 'amount'
  | 'footer'
  | 'barLabel'

export type ShareDrawItem =
  | {
      kind: 'text'
      role: ShareTextRole
      text: string
      x: number
      y: number
      font: string
      align: 'left' | 'right'
    }
  | { kind: 'rule'; x: number; y: number; width: number; thickness: number }
  | {
      kind: 'bar'
      x: number
      y: number
      width: number
      height: number
      current: boolean
    }

export interface ShareLayout {
  width: number
  height: number
  items: ShareDrawItem[]
}

/** Splits text on words so it never runs under a right-aligned amount. */
export function wrapText(
  text: string,
  font: string,
  maxWidth: number,
  measure: Measure,
): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = words[0]
  for (const word of words.slice(1)) {
    const next = `${current} ${word}`
    if (measure(next, font) <= maxWidth) current = next
    else {
      lines.push(current)
      current = word
    }
  }
  lines.push(current)
  return lines
}

export function layoutShare(input: ShareLayoutInput, measure: Measure): ShareLayout {
  const items: ShareDrawItem[] = []
  const left = SHARE_PADDING
  const right = SHARE_WIDTH - SHARE_PADDING
  let y = SHARE_PADDING

  items.push({
    kind: 'text',
    role: 'title',
    text: input.title,
    x: left,
    y,
    font: shareFont(TITLE.weight, TITLE.size),
    align: 'left',
  })
  y += TITLE.line

  if (input.titleSub) {
    items.push({
      kind: 'text',
      role: 'titleSub',
      text: input.titleSub,
      x: left,
      y,
      font: shareFont(TITLE_SUB.weight, TITLE_SUB.size),
      align: 'left',
    })
    y += TITLE_SUB.line
  }
  y += TITLE_GAP

  const sections: ShareSection[] = input.lines
    ? [{ lines: input.lines }, ...(input.sections ?? [])]
    : (input.sections ?? [])

  sections.forEach((section, index) => {
    if (index > 0) y += SECTION_GAP

    if (section.heading) {
      items.push({
        kind: 'text',
        role: 'heading',
        text: section.heading,
        x: left,
        y,
        font: shareFont(HEADING.weight, HEADING.size),
        align: 'left',
      })
      y += HEADING.line
    }
    if (section.headingSub) {
      items.push({
        kind: 'text',
        role: 'headingSub',
        text: section.headingSub,
        x: left,
        y,
        font: shareFont(HEADING_SUB.weight, HEADING_SUB.size),
        align: 'left',
      })
      y += HEADING_SUB.line
    }
    if (section.heading || section.headingSub) y += LINE_GAP

    for (const line of section.lines) {
      if (line.rule) {
        items.push({
          kind: 'rule',
          x: left,
          y: y + RULE_GAP / 2 - 1,
          width: SHARE_CONTENT_WIDTH,
          thickness: 3,
        })
        y += RULE_GAP
        continue
      }

      const amount = line.strong ? AMOUNT_STRONG : AMOUNT
      const amountWidth = line.amount ? measure(line.amount, shareFont(amount.weight, amount.size)) : 0
      const labelWidth = SHARE_CONTENT_WIDTH - (line.amount ? amountWidth + AMOUNT_GAP : 0)
      const labelFont = shareFont(LABEL.weight, LABEL.size)
      const subFont = shareFont(SUB.weight, SUB.size)

      if (line.amount) {
        items.push({
          kind: 'text',
          role: 'amount',
          text: line.amount,
          x: right,
          y,
          font: shareFont(amount.weight, amount.size),
          align: 'right',
        })
      }

      let lineTop = y
      for (const piece of wrapText(line.label, labelFont, labelWidth, measure)) {
        items.push({
          kind: 'text',
          role: 'label',
          text: piece,
          x: left,
          y: lineTop,
          font: labelFont,
          align: 'left',
        })
        lineTop += LABEL.line
      }
      if (line.sub) {
        for (const piece of wrapText(line.sub, subFont, labelWidth, measure)) {
          items.push({
            kind: 'text',
            role: 'sub',
            text: piece,
            x: left,
            y: lineTop,
            font: subFont,
            align: 'left',
          })
          lineTop += SUB.line
        }
      }
      y = lineTop + LINE_GAP
    }
  })

  const barsBlock = input.bars
  if (barsBlock && barsBlock.bars.length > 0) {
    y += SECTION_GAP
    if (barsBlock.heading) {
      items.push({
        kind: 'text',
        role: 'heading',
        text: barsBlock.heading,
        x: left,
        y,
        font: shareFont(HEADING.weight, HEADING.size),
        align: 'left',
      })
      y += HEADING.line + LINE_GAP
    }

    const bars = barsBlock.bars
    const chartTop = y
    const barWidth = (SHARE_CONTENT_WIDTH - BAR_GAP * (bars.length - 1)) / bars.length
    const max = Math.max(1, ...bars.map((bar) => bar.value))
    bars.forEach((bar, index) => {
      const height = bar.value <= 0 ? 0 : Math.max(3, (bar.value / max) * barsBlock.height)
      items.push({
        kind: 'bar',
        x: left + index * (barWidth + BAR_GAP),
        y: chartTop + barsBlock.height - height,
        width: barWidth,
        height,
        current: bar.current,
      })
    })
    y += barsBlock.height + LINE_GAP

    items.push({
      kind: 'text',
      role: 'barLabel',
      text: bars[0].label,
      x: left,
      y,
      font: shareFont(BAR_LABEL.weight, BAR_LABEL.size),
      align: 'left',
    })
    items.push({
      kind: 'text',
      role: 'barLabel',
      text: bars[bars.length - 1].label,
      x: right,
      y,
      font: shareFont(BAR_LABEL.weight, BAR_LABEL.size),
      align: 'right',
    })
    y += BAR_LABEL.line
  }

  if (input.footer) {
    y += SECTION_GAP
    items.push({
      kind: 'text',
      role: 'footer',
      text: input.footer,
      x: left,
      y,
      font: shareFont(FOOTER.weight, FOOTER.size),
      align: 'left',
    })
    y += FOOTER.line
  }

  return { width: SHARE_WIDTH, height: y + SHARE_PADDING, items }
}
