// ChatGPT by copy and paste: the prompt the person gives ChatGPT, and the
// strict reader for the answer that comes back. The answer is text from
// outside, so it is only ever parsed as JSON data: never run as code, never
// shown as HTML. Every field is checked; a turn that fails any check is
// refused with a short reason and the rest still go through.
// Plain TypeScript: no network, no database, no React.

import { formatUsdShort, parseCents } from './money.ts'
import type { DraftCheck, DraftService, DraftTurn, ReaderPreset, ReaderResult } from './voiceReader.ts'

/** The exact reply shape the prompt asks for. */
export const ANSWER_FORMAT =
  '{"turns":[{"services":[{"id":"gel-manicure","price":"45.00"}],"cashTip":"10.00","cardTip":"0","request":false}]}'

const WORKED_EXAMPLE_SAID =
  '"Gel manicure 45 with a 10 dollar cash tip. Then a pedicure, she asked for me, and I forgot the price."'
const WORKED_EXAMPLE_REPLY =
  '{"turns":[{"services":[{"id":"gel-manicure","price":"45.00"}],"cashTip":"10.00","cardTip":"0","request":false},' +
  '{"services":[{"id":"pedicure","price":null}],"cashTip":"0","cardTip":"0","request":true}]}'

// Limits so a huge answer cannot freeze the phone.
const MAX_ANSWER_CHARS = 100_000
const MAX_TURNS = 100
const MAX_SERVICES = 20
const MAX_BLOCK_TRIES = 20

/** The text to copy and give ChatGPT: the person's services, the reply format and one worked example. */
export function chatGptPrompt(presets: readonly ReaderPreset[]): string {
  const services = presets.map((preset) =>
    preset.nameEn === preset.nameVi
      ? `- ${preset.id}: ${preset.nameEn}`
      : `- ${preset.id}: ${preset.nameEn} / ${preset.nameVi}`,
  )
  return [
    'I am a nail technician. I will tell you about the jobs I did today, in English or Vietnamese. Turn each client into one "turn".',
    '',
    'My services (id: English name / Vietnamese name). Use only these ids:',
    ...services,
    '',
    'Reply with exactly one JSON block and nothing else, in this format:',
    ANSWER_FORMAT,
    '',
    'Rules:',
    '- "turns" has one item per client, in the order I said them.',
    '- Money is a string of dollars with at most two decimals, like "45.00". No $ sign and no commas.',
    '- "price" is null when I did not say a price.',
    '- "cashTip" and "cardTip" are "0" when there is no tip.',
    '- "request" is true when the client asked for me by name, otherwise false.',
    '',
    `Example. I say: ${WORKED_EXAMPLE_SAID}`,
    `You reply: ${WORKED_EXAMPLE_REPLY}`,
  ].join('\n')
}

/** Why one part of the answer was refused. Shown to the person as plain words. */
export type ProblemCode =
  | 'empty'
  | 'tooBig'
  | 'noJson'
  | 'badJson'
  | 'noTurns'
  | 'tooMany'
  | 'notObject'
  | 'noServices'
  | 'unknownService'
  | 'badPrice'
  | 'badTip'
  | 'negativeTip'
  | 'badRequest'

export interface AnswerProblem {
  code: ProblemCode
  // 1-based turn number, null when the whole answer is the problem.
  turn: number | null
  // A short piece of the offending value, for "unknown service "xyz"".
  detail: string
}

export interface AnswerResult {
  turns: DraftTurn[]
  problems: AnswerProblem[]
}

const PREFIX = 'ChatGPT answer|'

/** A problem as one line of ReaderResult.notUnderstood; the Check screen turns it back into words. */
export function encodeProblem(problem: AnswerProblem): string {
  return `${PREFIX}${problem.code}|${problem.turn ?? ''}|${problem.detail}`
}

export function decodeProblem(line: string): AnswerProblem | null {
  if (!line.startsWith(PREFIX)) return null
  const [code, turn, ...detail] = line.slice(PREFIX.length).split('|')
  if (!code) return null
  return { code: code as ProblemCode, turn: turn ? Number(turn) : null, detail: detail.join('|') }
}

function short(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? ''
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 30 ? `${flat.slice(0, 30)}…` : flat
}

/**
 * The first `{ ... }` in the text that is valid JSON, whether or not it sits
 * inside a code fence. Braces inside strings do not count.
 */
function firstJsonBlock(text: string): { found: boolean; value: unknown } {
  let tries = 0
  let from = text.indexOf('{')
  let sawBrace = false
  while (from !== -1 && tries < MAX_BLOCK_TRIES) {
    sawBrace = true
    tries += 1
    const end = blockEnd(text, from)
    if (end !== -1) {
      try {
        return { found: true, value: JSON.parse(text.slice(from, end + 1)) as unknown }
      } catch {
        // Not JSON after all: look at the next brace.
      }
    }
    from = text.indexOf('{', from + 1)
  }
  return { found: sawBrace, value: undefined }
}

/** Index of the brace that closes the one at `start`, or -1. */
function blockEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (char === '\\') index += 1
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

type Fail = { problem: AnswerProblem }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Dollars ("45", "45.5", "45.00") to whole cents. No signs, commas or spaces;
 * at most two decimals. ChatGPT often writes a bare number despite the prompt,
 * so a plain JSON number is read through its text the same way.
 */
function moneyCents(value: unknown): number | null {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value
  if (typeof text !== 'string' || !/^\d+(\.\d{1,2})?$/.test(text)) return null
  return parseCents(text)
}

function readTurn(
  raw: unknown,
  turn: number,
  presets: ReadonlyMap<string, ReaderPreset>,
  lastPrices: ReadonlyMap<string, number> | undefined,
): DraftTurn | Fail {
  const fail = (code: ProblemCode, detail = ''): Fail => ({ problem: { code, turn, detail } })
  if (!isRecord(raw)) return fail('notObject')
  if (!Array.isArray(raw.services) || raw.services.length === 0 || raw.services.length > MAX_SERVICES) {
    return fail('noServices')
  }

  const services: DraftService[] = []
  const checks: DraftCheck[] = []
  for (const item of raw.services) {
    if (!isRecord(item)) return fail('notObject')
    const preset = typeof item.id === 'string' ? presets.get(item.id) : undefined
    if (!preset) return fail('unknownService', short(item.id))

    let priceCents: number | null = null
    if (item.price !== undefined && item.price !== null) {
      priceCents = moneyCents(item.price)
      if (priceCents === null) return fail('badPrice', short(item.price))
    }
    const usual = preset.defaultPriceCents ?? lastPrices?.get(preset.id) ?? null
    services.push({ presetId: preset.id, heard: '', priceCents, usualPriceCents: usual })
    if (priceCents === null) {
      const text =
        usual === null
          ? `No price heard for ${preset.nameEn}; enter one.`
          : `No price heard for ${preset.nameEn}; your usual is ${formatUsdShort(usual)}.`
      checks.push({ code: 'noPrice', text })
    }
  }

  const tips: number[] = []
  for (const key of ['cashTip', 'cardTip'] as const) {
    const value = raw[key]
    if (value === undefined || value === null) {
      tips.push(0)
      continue
    }
    if ((typeof value === 'string' && /^\s*[-−]/.test(value)) || (typeof value === 'number' && value < 0))
      return fail('negativeTip', short(value))
    const cents = moneyCents(value)
    if (cents === null) return fail('badTip', short(value))
    tips.push(cents)
  }

  if (raw.request !== undefined && typeof raw.request !== 'boolean') return fail('badRequest', short(raw.request))

  return {
    heard: '',
    services,
    cashTipCents: tips[0] ?? 0,
    cardTipCents: tips[1] ?? 0,
    request: raw.request === true,
    startTime: null,
    checks,
  }
}

/**
 * Reads ChatGPT's answer. Only the first JSON block counts; unknown fields are
 * ignored. A price of null means none was said, so the usual price is used and
 * the card is marked, exactly as for a spoken turn with no price.
 */
export function readChatGptAnswer(input: {
  text: string
  presets: readonly ReaderPreset[]
  lastPrices?: ReadonlyMap<string, number>
}): AnswerResult {
  const refuse = (code: ProblemCode): AnswerResult => ({
    turns: [],
    problems: [{ code, turn: null, detail: '' }],
  })
  if (input.text.trim() === '') return refuse('empty')
  if (input.text.length > MAX_ANSWER_CHARS) return refuse('tooBig')

  const block = firstJsonBlock(input.text)
  if (!block.found) return refuse('noJson')
  if (!isRecord(block.value)) return refuse('badJson')
  const list = block.value.turns
  if (!Array.isArray(list) || list.length === 0) return refuse('noTurns')
  if (list.length > MAX_TURNS) return refuse('tooMany')

  const presets = new Map(input.presets.map((preset) => [preset.id, preset]))
  const turns: DraftTurn[] = []
  const problems: AnswerProblem[] = []
  list.forEach((raw, index) => {
    const read = readTurn(raw, index + 1, presets, input.lastPrices)
    if ('problem' in read) problems.push(read.problem)
    else turns.push(read)
  })
  return { turns, problems }
}

/**
 * Whether the text in the one Say box is a pasted ChatGPT answer rather than
 * dictation. Dictation never types braces, so any brace (even a lone or
 * truncated one) or an opening code fence sends the text down the ChatGPT path,
 * where a bad paste gets its refusal reasons instead of a confusing voice read.
 */
export function looksLikeChatGptAnswer(text: string): boolean {
  const folded = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  return /[{}]/.test(folded) || /^\s*```/.test(folded)
}

/** The answer as the same result the spoken-word reader returns, so the Check screen can show either. */
export function answerAsReaderResult(answer: AnswerResult): ReaderResult {
  return { turns: answer.turns, notUnderstood: answer.problems.map(encodeProblem) }
}
