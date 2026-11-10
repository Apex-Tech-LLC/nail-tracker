// The voice reader: turns the words a technician said into draft turns that
// the Check screen can show. English and Vietnamese, spoken or typed, with or
// without accents. Everything the reader knows about words lives in the tables
// at the top, so a new phrase is one more line there.
// Plain TypeScript: no network, no database, no React.

import { MAX_CENTS, formatUsdShort } from './money.ts'
import { lettersOf, soundFits, soundNames, type SoundName } from './soundAlike.ts'
import { foldText } from './textFold.ts'
import { MISHEARD_FORMS } from './voiceMishearings.ts'

export type ReaderLocale = 'en' | 'vi' | 'mixed'

/** The part of a service preset the reader needs. */
export interface ReaderPreset {
  id: string
  nameEn: string
  nameVi: string
  defaultPriceCents: number | null
}

export interface ReaderInput {
  text: string
  presets: readonly ReaderPreset[]
  // Last price per preset id, for the "usual price" when the preset has none.
  lastPrices?: ReadonlyMap<string, number>
  // `mixed` text is read as Vietnamese.
  locale: ReaderLocale
  // Words the person has fixed before, folded, to the preset id they meant. They match with no check.
  learned?: ReadonlyMap<string, string>
}

export type CheckCode =
  | 'noPrice'
  | 'noService'
  | 'unclearService'
  | 'shorthand'
  | 'guessedWord'
  | 'sharedTotal'
  | 'badAmount'
  | 'halfShorthand'
  | 'decimalComma'
  | 'currencyAssumed'
  | 'countMismatch'
  | 'repeatExpanded'
  | 'inferredSplit'
  | 'correction'
  | 'tipNoAmount'
  | 'paymentNotTip'
  | 'appointment'
  | 'requestConflict'
  | 'priceChange'
  | 'timeNotRead'
  | 'timeGuessedHalf'
  | 'backReference'
  | 'priceBeforeService'

/** A reason to look at a turn again. `text` is plain English for the next card to translate. */
export interface DraftCheck {
  code: CheckCode
  text: string
}

export interface DraftService {
  presetId: string
  // The words this service was read from, as said; empty when it did not come from words.
  heard: string
  // The price as heard, or null when none was heard or it could not be read.
  priceCents: number | null
  // The preset's own price, else the last price used, else null.
  usualPriceCents: number | null
}

export interface DraftTurn {
  // This turn's own slice of the text.
  heard: string
  services: DraftService[]
  cashTipCents: number
  cardTipCents: number
  request: boolean
  // The time of day said for this turn, "HH:MM" in 24 hours, or null when none was said or it could not be read.
  startTime: string | null
  checks: DraftCheck[]
}

export interface ReaderResult {
  turns: DraftTurn[]
  // Leftover words the reader could not place; a non-empty list needs a whole-text check.
  notUnderstood: string[]
}

// ---------------------------------------------------------------------------
// Vocabulary. Phrases are written without accents and in lower case; the
// reader folds the spoken text the same way. Longest phrase wins.
// ---------------------------------------------------------------------------

interface ServiceWords {
  // Clear names for this service.
  names: string[]
  // Short words that probably mean it: read, but marked `Check this`.
  assumed?: string[]
  // Speech-to-text slips seen or guessed: read, but marked `Check this`.
  misheard?: string[]
  // Phrases that are this service unless a price follows ("take off $5").
  unlessPriceFollows?: string[]
}

// By seed preset id. Used only when the person still has a preset with that id.
const SERVICE_WORDS: Record<string, ServiceWords> = {
  manicure: {
    names: ['manicure', 'regular manicure', 'basic manicure', 'mani', 'lam mong tay', 'tay thuong', 'lam mani', 'regular tay'],
    assumed: ['tay'],
    misheard: ['man a cure', 'many cure'],
  },
  pedicure: {
    names: ['pedicure', 'regular pedicure', 'basic pedicure', 'pedi', 'lam mong chan', 'chan thuong', 'lam pedi', 'regular chan'],
    assumed: ['chan'],
    misheard: ['peddy cure', 'petty cure'],
  },
  'gel-manicure': {
    names: [
      'gel manicure',
      'gel mani',
      'gel polish manicure',
      'gel on hands',
      'son gel tay',
      'lam gel tay',
      'gel tay',
      'mani gel',
      'son gel manicure',
    ],
    assumed: ['son gel'],
    misheard: ['jail manicure', 'son deo tay', 'gel many cure'],
  },
  'gel-pedicure': {
    names: [
      'gel pedicure',
      'gel pedi',
      'gel polish pedicure',
      'gel on toes',
      'son gel chan',
      'lam gel chan',
      'gel chan',
      'pedi gel',
    ],
    misheard: ['jail pedicure', 'son deo chan', 'gel petty cure'],
  },
  'gel-x': {
    names: ['gel x', 'gel x extensions', 'gel x tips', 'full set gel x', 'gel x full set', 'noi mong gel x', 'dap gel x', 'lam gel x'],
    misheard: ['gel ex', 'jello ex', 'jox', 'gel ich', 'gel et'],
  },
  'acrylic-full-set': {
    names: ['acrylic full set', 'full set acrylic', 'new acrylic set', 'full set bot', 'bo bot moi', 'acrylic bo moi'],
    assumed: ['full set', 'dap bot'],
  },
  'acrylic-fill': {
    names: ['acrylic fill', 'acrylic refill', 'dam bot', 'dap bot lai', 'fill bot', 'refill bot'],
    assumed: ['fill', 'refill', 'fill in'],
    misheard: ['acrylic feel', 'acrylic field'],
  },
  'dip-powder': {
    names: ['dip powder', 'dipping powder', 'sns dip', 'dip', 'bot nhung', 'nhung bot', 'lam dip', 'dip bot', 'lam sns'],
    assumed: ['sns'],
    misheard: ['deep powder', 'dip power', 'bot nhun'],
  },
  'nail-art': {
    names: ['nail art', 'nail design', 'design', 'designs', 've mong', 'trang tri mong', 'lam nail art'],
    assumed: ['ve'],
    misheard: ['nail heart'],
  },
  removal: {
    names: ['removal', 'soak off', 'take off nails', 'thao mong', 'thao bot', 'thao gel', 'remove mong'],
    misheard: ['soak of'],
    unlessPriceFollows: ['take off'],
  },
}

// Service words that name no preset on their own. The price after them is
// kept out of the way and the turn is marked.
const UNCLEAR_SERVICES = [
  'gel',
  'acrylic',
  'bot',
  'lam mong',
  'shellac',
  'biab',
  'opi',
  'dnd',
  'hard gel',
  'hard gel fill',
  'hard gel refill',
  'hard gel full set',
  'builder gel',
  'gel fill',
  'gel refill',
  'pink and white',
]

type Channel = 'cash' | 'card'

type MarkerBody =
  | { t: 'noTip' | 'request' | 'walkIn' | 'appointment' | 'join' | 'next' | 'same' | 'backRef' }
  | { t: 'tip'; guessed?: boolean }
  | { t: 'correct' | 'priceWord' | 'total' | 'pay' | 'each' }
  | { t: 'channel'; channel: Channel; guessed: boolean }

interface MarkerWords {
  body: MarkerBody
  phrases: string[]
  // Match the spoken form including accents, for words that differ only by tone.
  strict?: boolean
  // Only in these locales; any when left out.
  locales?: ReaderLocale[]
}

const MARKER_WORDS: MarkerWords[] = [
  { body: { t: 'tip' }, phrases: ['tip', 'tips', 'gratuity', 'boa', 'tien tip', 'tien boa', 'tien bo'] },
  { body: { t: 'tip' }, phrases: ['bo'], strict: true },
  {
    body: { t: 'noTip' },
    phrases: ['no tip', 'no tips', 'zero tip', 'without tip', 'khong co tip', 'khong tip', 'khong co boa', 'khong boa'],
  },
  { body: { t: 'channel', channel: 'cash', guessed: false }, phrases: ['cash', 'tien mat'] },
  { body: { t: 'channel', channel: 'card', guessed: false }, phrases: ['card', 'credit', 'debit'] },
  { body: { t: 'channel', channel: 'card', guessed: false }, phrases: ['thẻ'], strict: true },
  { body: { t: 'channel', channel: 'card', guessed: false }, phrases: ['the'], strict: true, locales: ['vi', 'mixed'] },
  { body: { t: 'channel', channel: 'card', guessed: true }, phrases: ['cart'] },
  { body: { t: 'channel', channel: 'card', guessed: true }, phrases: ['thể'], strict: true },
  {
    body: { t: 'request' },
    phrases: [
      'request',
      'requested',
      'request me',
      'requested me',
      'requested me by name',
      'asked for me',
      'ask for me',
      'asked for me by name',
      'khach goi ten',
      'goi ten',
      'khach quen',
      'khach chi dinh',
      'chi dinh',
      'khach request',
      'khach yeu cau',
      'request em',
    ],
  },
  {
    body: { t: 'walkIn' },
    phrases: [
      'walk in',
      'walkin',
      'khach vang lai',
      'vang lai',
      'khach walk in',
      'khach khong hen',
      'no request',
      'not request',
      'not a request',
      'not requested',
      "didn't ask for me",
      'did not ask for me',
      "didn't request me",
      'khong request',
      'khong phai request',
      'khong goi ten',
      'khong phai khach goi ten',
      'khong phai khach quen',
      'khong chi dinh',
    ],
  },
  { body: { t: 'appointment' }, phrases: ['appointment', 'by appointment', 'khach co hen', 'co hen'] },
  { body: { t: 'join' }, phrases: ['and', 'with', 'plus', 'va', 'voi', 'them'] },
  {
    body: { t: 'next' },
    phrases: [
      'next',
      'next customer',
      'next client',
      'next khach',
      'then',
      'another',
      'another customer',
      'another client',
      'roi',
      'roi next',
      'tiep',
      'khach tiep',
      'khach tiep theo',
      'khach nua',
    ],
  },
  {
    body: { t: 'backRef' },
    phrases: ['first customer', 'first client', 'last customer', 'last client', 'khach dau', 'khach dau tien', 'khach cuoi', 'khach thu nhat'],
  },
  { body: { t: 'same' }, phrases: ['same customer', 'same client', 'same khach', 'cung mot khach', 'cung khach'] },
  {
    body: { t: 'correct' },
    phrases: ['no i mean', 'i mean', 'make that', 'make it', 'sorry', 'actually', 'no', 'a khong', 'y la', 'sua thanh', 'sua lai', 'oops'],
  },
  { body: { t: 'priceWord' }, phrases: ['price'] },
  { body: { t: 'priceWord' }, phrases: ['giá'], strict: true },
  { body: { t: 'total' }, phrases: ['total', 'tong', 'tong cong'] },
  { body: { t: 'pay' }, phrases: ['paid', 'pay', 'payment', 'paying'] },
  { body: { t: 'pay' }, phrases: ['trả'], strict: true },
  { body: { t: 'each' }, phrases: ['each', 'moi khach'] },
]

// Words and phrases that carry nothing for the reader, and are skipped quietly.
const SKIPPED_PHRASES = ['let me see', 'de xem', 'chi oi', 'french included', 'in cash']

const SKIPPED_WORDS = new Set(
  [
    // English
    'um', 'uh', 'uhm', 'ah', 'hmm', 'okay', 'ok', 'well', 'please', 'let', 'me', 'see', 'she', 'he', 'her', 'they',
    'i', 'the', 'a', 'an', 'of', 'for', 'on', 'in', 'at', 'by', 'is', 'was', 'to', 'it', 'that', 'this', 'customer',
    'customers', 'client', 'clients', 'french', 'included', 'ish', 'ombre', 'chrome',
    // Vietnamese
    'da', 'o', 'nhe', 'nha', 'oi', 'chi', 'anh', 'em', 'toi', 'minh', 'ma', 'la', 'co', 'khach', 'cua', 'cho', 'bang',
    'qua', 'tren', 'ay', 'nay', 'thi', 'tien', 'lam',
    // Loose money and time words
    'do', 'dollar', 'dollars', 'buck', 'bucks', 'usd', 'dong', 'pm', 'am', 'gio',
  ].map(foldText),
)

// ---------------------------------------------------------------------------
// Number words.
// ---------------------------------------------------------------------------

type Piece =
  | { k: 'digit'; v: number; lang: 'en' | 'vi'; five: boolean }
  | { k: 'unit'; v: number } // Vietnamese lăm, mốt, tư: a last digit after a tens digit
  | { k: 'teen'; v: number } // English ten to nineteen
  | { k: 'tens'; v: number } // English twenty to ninety
  | { k: 'hundred' }
  | { k: 'muoi'; role: 'ten' | 'tens' | 'either' } // mười (10), mươi (x10), or unaccented muoi
  | { k: 'chuc' }
  | { k: 'le' }
  | { k: 'half' }

const EN_DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const EN_TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const EN_TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

const EN_PIECES = new Map<string, Piece>([
  ...EN_DIGITS.map((word, v): [string, Piece] => [word, { k: 'digit', v, lang: 'en', five: false }]),
  ...EN_TEENS.map((word, i): [string, Piece] => [word, { k: 'teen', v: 10 + i }]),
  ...EN_TENS.map((word, i): [string, Piece] => [word, { k: 'tens', v: 20 + i * 10 }]),
  ['hundred', { k: 'hundred' }],
])

const viDigit = (v: number, five = false): Piece => ({ k: 'digit', v, lang: 'vi', five })

// Spoken with accents: the tone decides the word (mười is 10, mươi is x10).
const VI_STRICT = new Map<string, Piece>([
  ['không', viDigit(0)],
  ['một', viDigit(1)],
  ['hai', viDigit(2)],
  ['ba', viDigit(3)],
  ['bốn', viDigit(4)],
  ['năm', viDigit(5, true)],
  ['sáu', viDigit(6)],
  ['bảy', viDigit(7)],
  ['bẩy', viDigit(7)],
  ['tám', viDigit(8)],
  ['chín', viDigit(9)],
  ['lăm', { k: 'unit', v: 5 }],
  ['mốt', { k: 'unit', v: 1 }],
  ['tư', { k: 'unit', v: 4 }],
  ['mười', { k: 'muoi', role: 'ten' }],
  ['mươi', { k: 'muoi', role: 'tens' }],
  ['chục', { k: 'chuc' }],
  ['trăm', { k: 'hundred' }],
  ['lẻ', { k: 'le' }],
  ['linh', { k: 'le' }],
  ['rưỡi', { k: 'half' }],
])

// Typed without accents: only for a word that has no accent on it at all.
const VI_PLAIN = new Map<string, Piece>([
  ['khong', viDigit(0)],
  ['mot', viDigit(1)],
  ['hai', viDigit(2)],
  ['ba', viDigit(3)],
  ['bon', viDigit(4)],
  ['nam', viDigit(5, true)],
  ['sau', viDigit(6)],
  ['bay', viDigit(7)],
  ['tam', viDigit(8)],
  ['chin', viDigit(9)],
  ['lam', { k: 'unit', v: 5 }],
  ['tu', { k: 'unit', v: 4 }],
  ['muoi', { k: 'muoi', role: 'either' }],
  ['chuc', { k: 'chuc' }],
  ['tram', { k: 'hundred' }],
  ['le', { k: 'le' }],
  ['linh', { k: 'le' }],
  ['ruoi', { k: 'half' }],
])

const DOLLAR_UNITS = new Set(['do', 'dollar', 'dollars', 'buck', 'bucks', 'usd'])
const DONG_UNITS = new Set(['dong'])
const CENT_UNITS = new Set(['xu', 'cent', 'cents'])
const FOREIGN_UNITS = new Set(['nghin', 'ngan', 'vnd'])
const POINT_WORDS = new Set(['point', 'phay', 'cham'])
const MINUS_WORDS = new Set(['minus', 'negative'])
const HOUR_UNITS = new Set(['gio', 'h'])
const MINUTE_UNITS = new Set(['phut', 'min', 'mins', 'minute', 'minutes'])
type DayPart = 'am' | 'pm' | 'noon' | 'evening'
const DAY_PARTS = new Map<string, DayPart>([
  ['am', 'am'],
  ['sang', 'am'],
  ['pm', 'pm'],
  ['chieu', 'pm'],
  ['trua', 'noon'],
  ['toi', 'evening'],
])
const COUNT_NOUNS = new Set(['customer', 'customers', 'client', 'clients', 'job', 'jobs', 'turn', 'turns', 'khach', 'luot'])

// ---------------------------------------------------------------------------
// Text to tokens.
// ---------------------------------------------------------------------------

type TokenKind = 'word' | 'number' | 'comma' | 'colon' | 'stop' | 'symbol'

interface Token {
  kind: TokenKind
  lo: string // lower case, accents kept
  fo: string // lower case, accents dropped
  start: number
  end: number
}

// Numbers first (1,000 / 35,50 / 45.50), then words, then the marks that matter.
const TOKEN_PATTERN = /(\d{1,3}(?:,\d{3})+(?!\d)|\d+(?:[.,]\d+)?)|([\p{L}\p{M}][\p{L}\p{M}']*)|([\n.!?;])|(,)|(:)|([$%])/gu

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const [raw, num, word, stop, comma, colon] = match
    const lo = raw.toLowerCase()
    const kind: TokenKind = num ? 'number' : word ? 'word' : stop ? 'stop' : comma ? 'comma' : colon ? 'colon' : 'symbol'
    tokens.push({ kind, lo, fo: foldText(raw), start: match.index, end: match.index + raw.length })
  }
  return tokens
}

function normalize(text: string): string {
  return text.normalize('NFC').replace(/[’‘]/g, "'")
}

// ---------------------------------------------------------------------------
// Amounts: digits and number words, in dollars and cents.
// ---------------------------------------------------------------------------

type MoneyNote = 'halfShorthand' | 'decimalComma' | 'currencyAssumed' | 'guessedFive'

interface Money {
  cents: number | null
  // Why no amount could be taken, in plain English.
  problem: string | null
  notes: MoneyNote[]
}

interface Quantity {
  whole: number
  extraCents: number
  end: number
  notes: MoneyNote[]
  ambiguous: boolean
  tooManyDecimals: boolean
}

function pieceAt(tokens: readonly Token[], k: number): Piece | null {
  const token = tokens[k]
  if (!token || token.kind !== 'word') return null
  const strict = VI_STRICT.get(token.lo)
  if (strict) return strict
  const english = EN_PIECES.get(token.fo)
  if (english) return english
  return token.lo === token.fo ? (VI_PLAIN.get(token.fo) ?? null) : null
}

const isWord = (tokens: readonly Token[], k: number, words: ReadonlySet<string>) => {
  const token = tokens[k]
  return token !== undefined && token.kind === 'word' && words.has(token.fo)
}

interface Part {
  value: number
  end: number
  single?: boolean
  chuc?: boolean
  five?: boolean
}

function viUnitAt(tokens: readonly Token[], k: number): { v: number; five: boolean } | null {
  const piece = pieceAt(tokens, k)
  if (piece?.k === 'unit') return { v: piece.v, five: false }
  if (piece?.k === 'digit' && piece.lang === 'vi' && piece.v >= 1) return { v: piece.v, five: piece.five }
  return null
}

// 1 to 99: mười hai, bốn mươi lăm, năm chục, bốn lăm, hai mốt.
function readViBelowHundred(tokens: readonly Token[], i: number): Part | null {
  const first = pieceAt(tokens, i)
  if (first?.k === 'muoi' && first.role !== 'tens') {
    const unit = viUnitAt(tokens, i + 1)
    return unit ? { value: 10 + unit.v, end: i + 2, five: unit.five } : { value: 10, end: i + 1 }
  }
  if (first?.k !== 'digit' || first.lang !== 'vi' || first.v === 0) return null

  const next = pieceAt(tokens, i + 1)
  // "mươi", or unaccented "muoi" right after a digit.
  if (next?.k === 'muoi' && next.role !== 'ten') {
    const unit = viUnitAt(tokens, i + 2)
    return unit
      ? { value: first.v * 10 + unit.v, end: i + 3, five: unit.five }
      : { value: first.v * 10, end: i + 2 }
  }
  if (next?.k === 'chuc') return { value: first.v * 10, end: i + 2, chuc: true }
  // Short form: a tens digit and a last digit, "bốn lăm", "bốn năm" (45).
  const unit = first.v >= 2 ? viUnitAt(tokens, i + 1) : null
  if (unit) return { value: first.v * 10 + unit.v, end: i + 2, five: unit.five }
  return { value: first.v, end: i + 1, single: true }
}

function readViNumber(tokens: readonly Token[], i: number): Quantity | null {
  const first = pieceAt(tokens, i)
  if (first?.k === 'digit' && first.lang === 'vi' && first.v === 0) {
    // "không" alone means no; it is a zero only before a dollar word.
    return isWord(tokens, i + 1, DOLLAR_UNITS) ? quantity(0, i + 1) : null
  }

  let part: Part | null = null
  const notes: MoneyNote[] = []
  if (first?.k === 'digit' && first.lang === 'vi' && pieceAt(tokens, i + 1)?.k === 'hundred') {
    let value = first.v * 100
    let end = i + 2
    const next = pieceAt(tokens, end)
    if (next?.k === 'le') {
      const digit = pieceAt(tokens, end + 1)
      if (digit?.k === 'digit' && digit.lang === 'vi' && digit.v >= 1) {
        value += digit.v
        end += 2
      } else end += 1
    } else if (next?.k === 'half') {
      value += 50
      end += 1
      notes.push('halfShorthand')
    } else {
      const rest = readViBelowHundred(tokens, end)
      if (rest && !rest.single) {
        value += rest.value
        end = rest.end
        if (rest.five) notes.push('guessedFive')
      }
    }
    part = { value, end }
  } else {
    part = readViBelowHundred(tokens, i)
    if (part?.five) notes.push('guessedFive')
    // "ba chục rưỡi" is 35: a half of the next unit up.
    if (part?.chuc && pieceAt(tokens, part.end)?.k === 'half') {
      part = { value: part.value + 5, end: part.end + 1 }
      notes.push('halfShorthand')
    }
  }
  if (!part) return null

  const result = quantity(part.value, part.end)
  result.notes = notes
  return extendIfAmbiguous(tokens, result, (piece) => piece.k === 'digit' ? piece.lang === 'vi' && piece.v >= 1 : piece.k === 'unit' || piece.k === 'muoi')
}

function readEnBelowHundred(tokens: readonly Token[], i: number): { value: number; end: number } | null {
  const piece = pieceAt(tokens, i)
  if (piece?.k === 'tens') {
    const next = pieceAt(tokens, i + 1)
    if (next?.k === 'digit' && next.lang === 'en' && next.v >= 1) return { value: piece.v + next.v, end: i + 2 }
    return { value: piece.v, end: i + 1 }
  }
  if (piece?.k === 'teen') return { value: piece.v, end: i + 1 }
  if (piece?.k === 'digit' && piece.lang === 'en') return { value: piece.v, end: i + 1 }
  return null
}

function readEnNumber(tokens: readonly Token[], i: number): Quantity | null {
  const lead = readEnBelowHundred(tokens, i)
  if (!lead) return null

  let { value, end } = lead
  if (lead.value >= 1 && lead.value <= 9 && pieceAt(tokens, end)?.k === 'hundred') {
    value *= 100
    end += 1
    const skipAnd = tokens[end]?.fo === 'and' && readEnBelowHundred(tokens, end + 1) !== null
    const rest = readEnBelowHundred(tokens, skipAnd ? end + 1 : end)
    if (rest) {
      value += rest.value
      end = rest.end
    }
  }
  // "four five", "forty five fifty": digits that do not form one number.
  return extendIfAmbiguous(tokens, quantity(value, end), (piece) =>
    piece.k === 'tens' || piece.k === 'teen' || (piece.k === 'digit' && piece.lang === 'en' && piece.v >= 1),
  )
}

function quantity(whole: number, end: number): Quantity {
  return { whole, extraCents: 0, end, notes: [], ambiguous: false, tooManyDecimals: false }
}

function extendIfAmbiguous(tokens: readonly Token[], result: Quantity, isNumberWord: (piece: Piece) => boolean): Quantity {
  let end = result.end
  for (let piece = pieceAt(tokens, end); piece && isNumberWord(piece); piece = pieceAt(tokens, end)) end += 1
  if (end === result.end) return result
  return { ...result, end, ambiguous: true }
}

function readLiteral(raw: string, end: number): Quantity {
  if (/^\d{1,3}(,\d{3})+$/.test(raw)) return quantity(Number(raw.replace(/,/g, '')), end)

  const match = /^(\d+)([.,])(\d+)$/.exec(raw)
  if (!match) return quantity(Number(raw), end)

  const result = quantity(Number(match[1]), end)
  const fraction = match[3]
  if (fraction.length > 2) result.tooManyDecimals = true
  else result.extraCents = Number(fraction.padEnd(2, '0'))
  if (match[2] === ',') result.notes.push('decimalComma')
  return result
}

function readQuantity(tokens: readonly Token[], i: number): Quantity | null {
  const token = tokens[i]
  if (!token) return null
  if (token.kind === 'number') return readLiteral(token.lo, i + 1)
  if (token.kind !== 'word') return null
  return readEnNumber(tokens, i) ?? readViNumber(tokens, i)
}

function readDigitWords(tokens: readonly Token[], i: number): { digits: string; end: number } {
  let digits = ''
  let end = i
  for (;;) {
    const token = tokens[end]
    const piece = pieceAt(tokens, end)
    if (token?.kind === 'number' && /^\d+$/.test(token.lo)) digits += token.lo
    else if (piece?.k === 'digit') digits += String(piece.v)
    else break
    end += 1
  }
  return { digits, end }
}

interface MoneyRead {
  money: Money
  end: number
}

// "45", "$45.50", "forty five dollars and five cents", "bốn mươi lăm đô rưỡi".
function readMoney(tokens: readonly Token[], i: number): MoneyRead | null {
  let k = i
  const negative = isWord(tokens, k, MINUS_WORDS) || tokens[k]?.lo === 'âm'
  if (negative) k += 1
  if (tokens[k]?.lo === '$') k += 1

  const lead = readQuantity(tokens, k)
  if (!lead) return null

  const notes = [...lead.notes]
  let problem: string | null = null
  if (negative) problem = 'a negative amount'
  else if (lead.tooManyDecimals) problem = 'more than two decimal places'
  else if (lead.ambiguous) problem = 'digits that could mean more than one amount'

  let cents = lead.whole * 100 + lead.extraCents
  let end = lead.end

  if (tokens[end]?.fo === 'and' && tokens[end + 1]?.fo === 'a' && tokens[end + 2]?.fo === 'half') {
    cents += 50
    end += 3
  }
  if (isWord(tokens, end, POINT_WORDS)) {
    const { digits, end: tailEnd } = readDigitWords(tokens, end + 1)
    if (digits !== '') {
      if (digits.length > 2) problem ??= 'more than two decimal places'
      else cents += Number(digits.padEnd(2, '0'))
      end = tailEnd
    }
  }

  const at = tokens[end]
  if (at?.lo === '%' || at?.fo === 'percent' || (at?.fo === 'phan' && tokens[end + 1]?.fo === 'tram')) {
    problem ??= 'a percentage'
    end += at.lo === '%' || at.fo === 'percent' ? 1 : 2
  } else if (isWord(tokens, end, FOREIGN_UNITS)) {
    problem ??= 'not US dollars'
    end += isWord(tokens, end + 1, DONG_UNITS) ? 2 : 1
  } else if (isWord(tokens, end, CENT_UNITS)) {
    cents = lead.whole + lead.extraCents
    end += 1
  } else if (isWord(tokens, end, DOLLAR_UNITS) || isWord(tokens, end, DONG_UNITS)) {
    if (isWord(tokens, end, DONG_UNITS)) notes.push('currencyAssumed')
    end += 1
    // A half dollar, or a second amount in cents: "đô rưỡi", "dollars and five cents".
    if (pieceAt(tokens, end)?.k === 'half') {
      cents += 50
      end += 1
    } else {
      const skipAnd = tokens[end]?.fo === 'and'
      const extra = readQuantity(tokens, skipAnd ? end + 1 : end)
      if (extra && extra.whole < 100 && !extra.ambiguous && isWord(tokens, extra.end, CENT_UNITS)) {
        cents += extra.whole
        end = extra.end + 1
      }
    }
  } else if (pieceAt(tokens, end)?.k === 'half') {
    problem ??= 'half of an unclear unit'
    end += 1
  } else if (isWord(tokens, end, new Set(['ish']))) {
    problem ??= 'an approximate amount'
    end += 1
  }

  if (problem === null && cents > MAX_CENTS) problem = 'an amount that is too large'
  return { money: { cents: problem === null ? cents : null, problem, notes }, end }
}

interface TimeRead {
  end: number
  // "HH:MM" in 24 hours; null when a time was said but cannot be read.
  time: string | null
  // 7 or 8 with no am/pm: the hour was guessed.
  guessed: boolean
}

const pad2 = (value: number) => String(value).padStart(2, '0')

/** The 24-hour hour for what was said. With no am/pm: 1 to 6 is afternoon, 9 to 12 morning or noon, 7 and 8 a guess. */
function twentyFourHour(hour: number, part: DayPart | null): { hour: number; guessed: boolean } {
  if (hour > 12) return { hour, guessed: false }
  if (part === 'pm') return { hour: hour === 12 ? 12 : hour + 12, guessed: false }
  if (part === 'am') return { hour: hour === 12 ? 0 : hour, guessed: false }
  if (part === 'noon') return { hour: hour >= 1 && hour <= 5 ? hour + 12 : hour, guessed: false }
  if (part === 'evening') return { hour: hour === 12 ? 0 : hour + 12, guessed: false }
  if (hour >= 1 && hour <= 6) return { hour: hour + 12, guessed: false }
  if (hour === 7) return { hour: 19, guessed: true }
  if (hour === 8) return { hour: 8, guessed: true }
  return { hour, guessed: false }
}

/** Minutes straight after "giờ" or "h": "15", "mười lăm", "rưỡi" (30). */
function readMinutes(tokens: readonly Token[], k: number): { minutes: number; end: number } | null {
  if (pieceAt(tokens, k)?.k === 'half') return { minutes: 30, end: k + 1 }
  const token = tokens[k]
  if (!token || (token.kind !== 'number' && token.kind !== 'word')) return null
  if (token.kind === 'number' && /[.,]/.test(token.lo)) return null
  const read = readQuantity(tokens, k)
  if (!read || read.ambiguous || read.extraCents > 0 || read.whole >= 60) return null
  return { minutes: read.whole, end: read.end }
}

/**
 * A time of day: "at 2", "at 2 PM", "2:30", "14:30", "lúc hai giờ chiều", "2 giờ rưỡi", "3 giờ 15".
 * Minutes count only straight after a colon, "giờ" or "h", never after am/pm or a day part ("at 2 PM 45 gel":
 * 45 is a price). "at 2 30" and "at two thirty" are times that cannot be read. `afterService` is true when the
 * words just before are a service with no price yet: "pedicure at 20" is a price, not a time.
 */
function readTime(tokens: readonly Token[], i: number, afterService: boolean): TimeRead | null {
  const token = tokens[i]
  if (!token || (token.kind !== 'word' && token.kind !== 'number')) return null
  const marked = token.kind === 'word' && (token.fo === 'at' || token.fo === 'luc')
  const first = marked ? i + 1 : i
  const lead = readQuantity(tokens, first)
  if (!lead || lead.extraCents > 0 || lead.tooManyDecimals || lead.whole > 23) return null
  if (tokens[first].kind === 'number' && /[.,]/.test(tokens[first].lo)) return null
  // Words that may be two numbers: a time, but not a readable one.
  if (lead.ambiguous) return marked ? { end: lead.end, time: null, guessed: false } : null

  let end = lead.end
  let minutes = 0
  let colon = false
  let unit = false
  const mark = tokens[end]
  const digits = tokens[end + 1]
  if (
    mark?.kind === 'colon' &&
    tokens[first].kind === 'number' &&
    mark.start === tokens[end - 1].end &&
    digits?.kind === 'number' &&
    digits.start === mark.end
  ) {
    // "2:75": a time with minutes that do not exist.
    if (!/^\d{2}$/.test(digits.lo) || Number(digits.lo) >= 60) return { end: end + 2, time: null, guessed: false }
    minutes = Number(digits.lo)
    colon = true
    end += 2
  } else if (isWord(tokens, end, HOUR_UNITS)) {
    unit = true
    end += 1
    const read = readMinutes(tokens, end)
    if (read) {
      minutes = read.minutes
      end = read.end
      if (isWord(tokens, end, MINUTE_UNITS)) end += 1
    }
  }

  let part: DayPart | null = null
  let clock = false
  for (; end < tokens.length; end++) {
    const word = tokens[end]
    if (word.kind !== 'word') break
    const found = DAY_PARTS.get(word.fo)
    if (found) {
      part ??= found
      clock ||= word.fo === 'am' || word.fo === 'pm'
    } else if (word.fo === "o'clock" || word.fo === 'oclock') clock = true
    else if (word.fo !== 'gio') break
  }

  // Said without a mark: only a time when it says so itself.
  if (!marked && !colon && !unit && !clock) return null
  const sure = colon || unit || part !== null
  if (!sure) {
    if (lead.whole < 1 || lead.whole > 12) return null
    if (token.fo === 'at' && afterService) return null
    // "at 2 30": a time followed by a number with nothing to say they belong together.
    const tail = readQuantity(tokens, end)
    if (tail) return { end: tail.end, time: null, guessed: false }
  }

  const { hour, guessed } = twentyFourHour(lead.whole, part)
  return { end, time: `${pad2(hour)}:${pad2(minutes)}`, guessed }
}

// ---------------------------------------------------------------------------
// Words to atoms.
// ---------------------------------------------------------------------------

interface Span {
  start: number
  end: number
}

type AtomBody =
  | MarkerBody
  // `priceFirst`: read only because a price came right before it, so that price is its price.
  | { t: 'service'; presetId: string; assumed: boolean; guessed: boolean; priceFirst?: boolean }
  | { t: 'unclear'; priceFirst?: boolean }
  | { t: 'money'; money: Money }
  | { t: 'time'; time: string | null; guessed: boolean }
  | { t: 'reduce' }
  | { t: 'count'; n: number; noun: string }
  | { t: 'comma' | 'colon' | 'stop' | 'unknown' }

type Atom = Span & AtomBody

// Where a guessed form from the mishearing table may be read: a price or a tip
// amount right next to it, or right after a tip amount as its channel.
type Guard = 'price' | 'tipAmount' | 'afterTip'

interface LexEntry {
  // Null: a phrase to skip.
  body: AtomBody | null
  // A price straight after it makes this a price change instead.
  unlessPriceFollows?: boolean
  // Read only where this holds; otherwise the words are not understood, as before.
  guard?: Guard
  // A guess that a learned word may replace: the table and the older misheard lists.
  soft?: boolean
}

interface Lexicon {
  folded: Map<string, LexEntry>
  strict: Map<string, LexEntry>
  maxWords: number
  // What the person's own service names sound like.
  sounds: SoundName[]
}

function buildLexicon(presets: readonly ReaderPreset[], locale: ReaderLocale, learned?: ReadonlyMap<string, string>): Lexicon {
  const lexicon: Lexicon = { folded: new Map(), strict: new Map(), maxWords: 1, sounds: [] }

  const keyOf = (phrase: string, strict = false): string | null => {
    const tokens = tokenize(normalize(phrase)).filter((token) => token.kind === 'word' || token.kind === 'number')
    return tokens.length === 0 ? null : tokens.map((token) => (strict ? token.lo : token.fo)).join(' ')
  }
  const add = (phrase: string, entry: LexEntry, strict = false) => {
    const key = keyOf(phrase, strict)
    if (key === null) return
    ;(strict ? lexicon.strict : lexicon.folded).set(key, entry)
    lexicon.maxWords = Math.max(lexicon.maxWords, key.split(' ').length)
  }

  for (const phrase of UNCLEAR_SERVICES) add(phrase, { body: { t: 'unclear' } })
  for (const phrase of SKIPPED_PHRASES) add(phrase, { body: null })
  for (const marker of MARKER_WORDS) {
    if (marker.locales && !marker.locales.includes(locale)) continue
    for (const phrase of marker.phrases) add(phrase, { body: marker.body }, marker.strict)
  }

  const known = new Set(presets.map((preset) => preset.id))
  for (const [presetId, words] of Object.entries(SERVICE_WORDS)) {
    if (!known.has(presetId)) continue
    for (const phrase of words.names) add(phrase, { body: { t: 'service', presetId, assumed: false, guessed: false } })
    for (const phrase of words.assumed ?? []) add(phrase, { body: { t: 'service', presetId, assumed: true, guessed: false } })
    for (const phrase of words.misheard ?? []) add(phrase, { body: { t: 'service', presetId, assumed: false, guessed: true }, soft: true })
    for (const phrase of words.unlessPriceFollows ?? []) {
      add(phrase, { body: { t: 'service', presetId, assumed: false, guessed: false }, unlessPriceFollows: true })
    }
  }

  // Trust order: the clear words above, then the words this person fixed before,
  // then the mishearing table, then sound-alikes (see `soundMatch`). Every table
  // form is a guess: it never replaces a word that is already read, and it is read
  // only where its guard holds. Both keyboard languages are loaded whatever the app's language.
  for (const [phrase, presetId] of learned ?? []) {
    const key = keyOf(phrase)
    if (key === null || !known.has(presetId)) continue
    // Never over a service name or a marker; only over a guess.
    const existing = lexicon.folded.get(key)
    if (existing && !existing.soft) continue
    add(phrase, { body: { t: 'service', presetId, assumed: false, guessed: false } })
  }
  for (const [formKey, forms] of Object.entries(MISHEARD_FORMS)) {
    const entry = tableEntry(formKey, known)
    if (!entry) continue
    for (const form of forms) {
      const key = keyOf(form)
      if (key !== null && !lexicon.folded.has(key)) add(form, entry)
    }
  }
  lexicon.sounds = presets.flatMap((preset) => soundNames(preset.id, [preset.nameEn, preset.nameVi]))

  // The person's own names win over everything above: "Nail Art / Design",
  // "Bột nhúng (Dip)" give two names each.
  for (const preset of presets) {
    for (const name of [preset.nameEn, preset.nameVi]) {
      for (const part of name.split(/[/()]/)) {
        if (part.trim().length >= 2) add(part, { body: { t: 'service', presetId: preset.id, assumed: false, guessed: false } })
      }
    }
  }

  return lexicon
}

/** The entry a table key stands for, or null when it is for a service the person no longer has. */
function tableEntry(key: string, known: ReadonlySet<string>): LexEntry | null {
  if (key === 'tip') return { body: { t: 'tip', guessed: true }, guard: 'tipAmount', soft: true }
  if (key === 'cash' || key === 'card') {
    return { body: { t: 'channel', channel: key, guessed: true }, guard: 'afterTip', soft: true }
  }
  if (!known.has(key)) return null
  return { body: { t: 'service', presetId: key, assumed: false, guessed: true }, guard: 'price', soft: true }
}

// `accept` can refuse a guarded entry; the next shorter phrase is then tried.
function lookup(
  tokens: readonly Token[],
  i: number,
  lexicon: Lexicon,
  accept: (entry: LexEntry, length: number) => boolean = (entry) => entry.guard === undefined,
): { entry: LexEntry; length: number } | null {
  for (let length = Math.min(lexicon.maxWords, tokens.length - i); length >= 1; length--) {
    const words = tokens.slice(i, i + length)
    if (words.some((token) => token.kind !== 'word' && token.kind !== 'number')) continue

    const strict = lexicon.strict.get(words.map((token) => token.lo).join(' '))
    if (strict && accept(strict, length)) return { entry: strict, length }
    const folded = lexicon.folded.get(words.map((token) => token.fo).join(' '))
    if (folded && accept(folded, length)) return { entry: folded, length }
  }
  return null
}

// "Three jobs:", "Hai khách,": a count that opens a sentence.
function readCount(tokens: readonly Token[], i: number): { atom: AtomBody; end: number } | null {
  const lead = readQuantity(tokens, i)
  if (!lead || lead.ambiguous || lead.extraCents > 0 || lead.whole < 1 || lead.whole > 20) return null

  const noun = tokens[lead.end]
  if (!noun || noun.kind !== 'word' || !COUNT_NOUNS.has(noun.fo)) return null
  const after = tokens[lead.end + 1]
  if (after && after.kind !== 'comma' && after.kind !== 'colon' && after.kind !== 'stop') return null
  return { atom: { t: 'count', n: lead.whole, noun: noun.fo }, end: lead.end + 1 }
}

// A price right before a word counts for it only when it is not already the price or tip of what came before.
const NOT_A_PRICE_BEFORE = new Set<AtomBody['t']>(['service', 'unclear', 'tip', 'channel', 'pay', 'total', 'priceWord', 'reduce', 'correct'])

function priceBefore(tokens: readonly Token[], i: number, atoms: readonly Atom[]): boolean {
  const money = atoms.at(-1)
  if (money?.t !== 'money' || money.end !== tokens[i - 1]?.end) return false
  const before = atoms.at(-2)
  return !before || !NOT_A_PRICE_BEFORE.has(before.t)
}

// "tip 10 the", "10 tip the": the amount of a tip, then the word for how it was paid.
function afterTipAmount(tokens: readonly Token[], i: number, atoms: readonly Atom[]): boolean {
  const last = atoms.at(-1)
  const before = atoms.at(-2)
  if (!last || last.end !== tokens[i - 1]?.end) return false
  return (last.t === 'money' && before?.t === 'tip') || (last.t === 'tip' && before?.t === 'money')
}

/** Whether a guessed form from the table may be read here. Forms that are not guarded always may. */
function guardHolds(guard: Guard | undefined, tokens: readonly Token[], i: number, length: number, atoms: readonly Atom[]): boolean {
  if (guard === undefined) return true
  if (guard === 'afterTip') return afterTipAmount(tokens, i, atoms)
  return readMoney(tokens, i + length) !== null || priceBefore(tokens, i, atoms)
}

const SOUND_SPAN_MAX = 3

/**
 * Words no list has, one to three of them, right next to a price: compared by
 * sound with the person's own service names. Exactly one service must fit; two
 * fits are left for the person as an unclear service, never guessed.
 */
function soundMatch(tokens: readonly Token[], i: number, atoms: readonly Atom[], lexicon: Lexicon): { body: AtomBody; length: number } | null {
  if (lexicon.sounds.length === 0) return null
  let run = 0
  while (run < SOUND_SPAN_MAX && unplaced(tokens, i + run, lexicon)) run += 1

  for (let length = run; length >= 1; length--) {
    const priceAfter = readMoney(tokens, i + length) !== null
    if (!priceAfter && !priceBefore(tokens, i, atoms)) continue

    const fits = soundFits(tokens.slice(i, i + length).flatMap((token) => lettersOf(token.fo)), lexicon.sounds)
    const priceFirst = !priceAfter || undefined
    if (fits.length === 1) return { body: { t: 'service', presetId: fits[0], assumed: false, guessed: true, priceFirst }, length }
    if (fits.length > 1) return { body: { t: 'unclear', priceFirst }, length }
  }
  return null
}

// A table form that also sounds like another service the person has (a custom
// "Mini Mani" beside "mini cure" for Manicure) is left for the person to pick.
function soundsLikeAnother(tokens: readonly Token[], i: number, length: number, presetId: string, lexicon: Lexicon): boolean {
  const fits = soundFits(tokens.slice(i, i + length).flatMap((token) => lettersOf(token.fo)), lexicon.sounds)
  return fits.some((id) => id !== presetId)
}

// A word the reader would otherwise leave as not understood.
function unplaced(tokens: readonly Token[], k: number, lexicon: Lexicon): boolean {
  const token = tokens[k]
  return (
    token?.kind === 'word' &&
    !SKIPPED_WORDS.has(token.fo) &&
    pieceAt(tokens, k) === null &&
    lookup(tokens, k, lexicon) === null &&
    readTime(tokens, k, false) === null
  )
}

function scan(tokens: readonly Token[], lexicon: Lexicon): Atom[] {
  const atoms: Atom[] = []
  const push = (body: AtomBody, from: number, to: number) => {
    // "Bột nhúng dip": two names for one service in a row are one mention.
    const last = atoms.at(-1)
    if (last?.t === 'service' && body.t === 'service' && last.presetId === body.presetId && last.end === tokens[from - 1]?.end) {
      last.end = tokens[to - 1].end
      return
    }
    atoms.push({ ...body, start: tokens[from].start, end: tokens[to - 1].end })
  }

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    if (token.kind === 'comma' || token.kind === 'colon' || token.kind === 'stop') {
      push({ t: token.kind }, i, i + 1)
      i += 1
      continue
    }
    if (token.kind === 'symbol' && token.lo !== '$') {
      i += 1
      continue
    }

    if (i === 0 || tokens[i - 1].kind === 'stop') {
      const count = readCount(tokens, i)
      if (count) {
        push(count.atom, i, count.end)
        i = count.end
        continue
      }
    }

    const previous = atoms.at(-1)
    const time = readTime(tokens, i, previous?.t === 'service' || previous?.t === 'unclear')
    if (time) {
      push({ t: 'time', time: time.time, guessed: time.guessed }, i, time.end)
      i = time.end
      continue
    }

    const hit = lookup(tokens, i, lexicon, (entry, length) => guardHolds(entry.guard, tokens, i, length, atoms))
    const money = readMoney(tokens, i)
    if (money && (!hit || money.end - i > hit.length)) {
      push({ t: 'money', money: money.money }, i, money.end)
      i = money.end
    } else if (hit) {
      if (hit.entry.unlessPriceFollows && readMoney(tokens, i + hit.length)) push({ t: 'reduce' }, i, i + hit.length)
      else if (hit.entry.body) {
        // A guessed service read from the price before it takes that price.
        const priceFirst = hit.entry.guard === 'price' && readMoney(tokens, i + hit.length) === null
        const body = hit.entry.guard === 'price' && hit.entry.body.t === 'service' && soundsLikeAnother(tokens, i, hit.length, hit.entry.body.presetId, lexicon)
          ? ({ t: 'unclear' } as AtomBody)
          : hit.entry.body
        push(priceFirst ? ({ ...body, priceFirst } as AtomBody) : body, i, i + hit.length)
      }
      i += hit.length
    } else {
      const sound = token.kind === 'word' ? soundMatch(tokens, i, atoms, lexicon) : null
      if (sound) {
        push(sound.body, i, i + sound.length)
        i += sound.length
        continue
      }
      if (token.kind === 'word' && !SKIPPED_WORDS.has(token.fo)) push({ t: 'unknown' }, i, i + 1)
      i += 1
    }
  }

  return atoms
}

// ---------------------------------------------------------------------------
// Atoms to draft turns.
// ---------------------------------------------------------------------------

interface Entry {
  // A clear service, or words for one the reader could not name.
  kind: 'service' | 'unclear'
  presetId: string
  heard: string
  priceCents: number | null
  priced: boolean
  // Priced together with the services before it ("60 total").
  shared: boolean
  // Came after "and" / "với" / "và".
  joined: boolean
}

interface Draft {
  entries: Entry[]
  loose: Atom[]
  cash: number
  card: number
  lastTip: Channel | null
  tipSeen: boolean
  tipWithoutAmount: boolean
  noTip: boolean
  startTime: string | null
  sawRequest: boolean
  sawWalkIn: boolean
  // Pointed back at an earlier client ("first customer was 30").
  backRef: boolean
  checks: DraftCheck[]
  start: number
  end: number
  // A correction was said and has not yet changed anything.
  correcting: boolean
  lastField: 'price' | 'tip' | null
  nextIsPrice: boolean
  nextIsTotal: boolean
  nextIsReduction: boolean
  joinPending: boolean
  // Said "each" after a count: how many copies of this turn to make.
  copies: number
  // Started without a separator being heard.
  inferred: boolean
}

interface Context {
  text: string
  presets: ReadonlyMap<string, ReaderPreset>
  lastPrices: ReadonlyMap<string, number> | undefined
}

function newDraft(): Draft {
  return {
    entries: [],
    loose: [],
    cash: 0,
    card: 0,
    lastTip: null,
    tipSeen: false,
    tipWithoutAmount: false,
    noTip: false,
    startTime: null,
    sawRequest: false,
    sawWalkIn: false,
    backRef: false,
    checks: [],
    start: -1,
    end: -1,
    correcting: false,
    lastField: null,
    nextIsPrice: false,
    nextIsTotal: false,
    nextIsReduction: false,
    joinPending: false,
    copies: 1,
    inferred: false,
  }
}

const NOT_CONTENT = new Set<AtomBody['t']>(['comma', 'colon', 'stop', 'next', 'count', 'each', 'unknown'])

const heardOf = (ctx: Context, atom: Span) => ctx.text.slice(atom.start, atom.end)
const nameOf = (ctx: Context, presetId: string) => ctx.presets.get(presetId)?.nameEn ?? presetId
const channelWord = (channel: Channel) => (channel === 'cash' ? 'cash' : 'card')

function check(draft: Draft, code: CheckCode, text: string) {
  draft.checks.push({ code, text })
}

function noteChecks(draft: Draft, ctx: Context, atom: Atom & { t: 'money' }) {
  const heard = heardOf(ctx, atom)
  const as = atom.money.cents === null ? '' : ` as ${formatUsdShort(atom.money.cents)}`
  for (const note of atom.money.notes) {
    if (note === 'halfShorthand') check(draft, 'halfShorthand', `Read "${heard}"${as}, half of a larger unit; confirm the amount.`)
    else if (note === 'decimalComma') check(draft, 'decimalComma', `Read the comma in "${heard}" as a decimal point${as}; confirm the amount.`)
    else if (note === 'currencyAssumed') check(draft, 'currencyAssumed', `Read "${heard}" as US dollars${as}; confirm the currency.`)
    else check(draft, 'guessedWord', `Read "${heard}"${as}, taking the last digit as five; confirm the amount.`)
  }
  if (atom.money.problem) {
    check(draft, 'badAmount', `Could not read "${heard}" (${atom.money.problem}); enter the amount.`)
  }
}

function addEntry(draft: Draft, ctx: Context, atom: Atom & ({ t: 'service' } | { t: 'unclear' })) {
  const heard = heardOf(ctx, atom)
  const entry: Entry = {
    kind: atom.t,
    presetId: atom.t === 'service' ? atom.presetId : '',
    heard,
    priceCents: null,
    priced: false,
    shared: false,
    joined: draft.joinPending,
  }
  draft.joinPending = false

  if (atom.t === 'service') {
    const name = nameOf(ctx, atom.presetId)
    if (atom.assumed) check(draft, 'shorthand', `Assumed ${name} from "${heard}"; confirm the service.`)
    if (atom.guessed) check(draft, 'guessedWord', `Possible dictation error: "${heard}" matched to ${name}.`)
  }

  const previous = draft.entries.at(-1)
  if (draft.correcting && previous && draft.lastField !== 'tip') {
    draft.entries.pop()
    draft.correcting = false
    const old = previous.priceCents === null ? '' : ` at ${formatUsdShort(previous.priceCents)}`
    check(draft, 'correction', `Replaced ${previous.heard}${old} with ${heard}.`)
  }
  draft.entries.push(entry)
  draft.lastField = 'price'
}

function setPrice(draft: Draft, ctx: Context, entry: Entry, atom: Atom & { t: 'money' }) {
  entry.priced = true
  entry.priceCents = atom.money.cents
  draft.lastField = 'price'
  noteChecks(draft, ctx, atom)
}

function addTip(draft: Draft, ctx: Context, channel: Channel, atom: Atom & { t: 'money' }, replace: boolean) {
  draft.tipSeen = true
  draft.lastField = 'tip'
  draft.lastTip = channel
  noteChecks(draft, ctx, atom)
  if (atom.money.cents === null) return

  const key = channel === 'cash' ? 'cash' : 'card'
  const old = draft[key]
  draft[key] = replace ? atom.money.cents : old + atom.money.cents
  if (replace) {
    draft.correcting = false
    check(draft, 'correction', `Corrected the ${channelWord(channel)} tip from ${formatUsdShort(old)} to ${formatUsdShort(atom.money.cents)}.`)
  }
}

function noteGuessedChannel(draft: Draft, ctx: Context, atom: Atom & { t: 'channel' }) {
  if (atom.guessed) check(draft, 'guessedWord', `Possible dictation error: "${heardOf(ctx, atom)}" matched to ${channelWord(atom.channel)}.`)
}

function noteGuessedTip(draft: Draft, ctx: Context, atom: Atom & { t: 'tip' }) {
  if (atom.guessed) check(draft, 'guessedWord', `Possible dictation error: "${heardOf(ctx, atom)}" matched to tip.`)
}

/** A service read from the price said right before it takes that price, if nothing else has. */
function takePriceBefore(draft: Draft, ctx: Context, before: Atom | undefined) {
  const entry = draft.entries.at(-1)
  if (!entry || before?.t !== 'money' || draft.loose.at(-1) !== before) return
  draft.loose.pop()
  setPrice(draft, ctx, entry, before)
}

// "2 pedi" is a count; "$2 pedi", "2 dollars pedi" and "2.50 pedi" are prices.
const DOLLAR_WORDS = /\$|\b(dollars?|bucks?|usd|do)\b/

/**
 * The amount said right before the service at `i`, when it can be that service's price. An amount said right
 * after the service is still its price, as before.
 */
function priceSaidBefore(ctx: Context, atoms: readonly Atom[], i: number): (Atom & { t: 'money' }) | null {
  const money = atoms[i - 1]
  if (money?.t !== 'money' || money.money.cents === null) return null
  const earlier = atoms[i - 2]
  if (earlier && NOT_A_PRICE_BEFORE.has(earlier.t)) return null
  if (atoms[i + 1]?.t === 'money') return null
  const cents = money.money.cents
  const bareCount = cents < 1000 && cents % 100 === 0 && !DOLLAR_WORDS.test(foldText(heardOf(ctx, money)))
  return bareCount ? null : money
}

/** "45 manicure": an amount no open service took, said right before a service, is that service's price. */
function takeLoosePrice(draft: Draft, ctx: Context, atoms: readonly Atom[], i: number) {
  const money = priceSaidBefore(ctx, atoms, i)
  const entry = draft.entries.at(-1)
  if (!money || !entry || draft.loose.at(-1) !== money) return
  takePriceBefore(draft, ctx, money)
  check(draft, 'priceBeforeService', `Read "${heardOf(ctx, money)}" as the price of ${entry.heard}, said before it; confirm the price.`)
}

function onMoney(draft: Draft, ctx: Context, atoms: readonly Atom[], i: number): number {
  const atom = atoms[i] as Atom & { t: 'money' }

  if (draft.nextIsReduction) {
    draft.nextIsReduction = false
    check(draft, 'priceChange', `"${heardOf(ctx, atom)}" looks like a price change; the price was left as heard.`)
    return i
  }

  // "10 tip", "10 cash tip", "8 on card": the amount comes before its word.
  const before = atoms[i - 1]
  const afterService = before?.t === 'service' || before?.t === 'unclear' || before?.t === 'priceWord'
  let j = i + 1
  const lead = atoms[j]?.t === 'channel' ? (atoms[j] as Atom & { t: 'channel' }) : null
  if (lead) j += 1
  const word = atoms[j]
  const tipWord = word?.t === 'tip'
  if (!draft.correcting && !afterService && (tipWord || (lead && draft.entries.length > 0))) {
    let channel = lead?.channel ?? null
    if (lead) noteGuessedChannel(draft, ctx, lead)
    if (tipWord) {
      noteGuessedTip(draft, ctx, word)
      j += 1
      const trailing = atoms[j]
      if (!channel && trailing?.t === 'channel') {
        channel = trailing.channel
        noteGuessedChannel(draft, ctx, trailing)
        j += 1
      }
    }
    addTip(draft, ctx, channel ?? 'cash', atom, false)
    return j - 1
  }

  if (draft.correcting) {
    onCorrectedMoney(draft, ctx, atom)
    return i
  }

  const last = draft.entries.at(-1)
  if (atoms[i + 1]?.t === 'total' || draft.nextIsTotal) {
    draft.nextIsTotal = false
    const open = draft.entries.filter((entry) => !entry.priced)
    if (open.length > 0) return shareTotal(draft, ctx, open, atom, atoms[i + 1]?.t === 'total' ? i + 1 : i)
  }
  const paired = pairedPrices(draft, atoms, i)
  if (paired) {
    paired.run.forEach((entry, n) => setPrice(draft, ctx, entry, atoms[paired.at[n]] as Atom & { t: 'money' }))
    return paired.at[paired.at.length - 1]
  }
  if (last && !last.priced) {
    const earlier = draft.entries.at(-2)
    if (last.joined && earlier && !earlier.priced) shareTotal(draft, ctx, [earlier, last], atom, i)
    else setPrice(draft, ctx, last, atom)
    return i
  }
  draft.loose.push(atom)
  return i
}

/**
 * "manicure and pedicure 25 and 35", "mani pedi 25 35": services named one after another, then exactly as many
 * prices. A price with a tip, channel or total word after it is not one of them. Any other count: null.
 */
function pairedPrices(draft: Draft, atoms: readonly Atom[], i: number): { run: Entry[]; at: number[] } | null {
  let from = draft.entries.length
  while (from > 0 && !draft.entries[from - 1].priced) from -= 1
  const run = draft.entries.slice(from)
  if (run.length < 2 || draft.nextIsTotal) return null

  const at: number[] = []
  for (let k = i; atoms[k]?.t === 'money'; k++) {
    const after = atoms[k + 1]
    if (after && (after.t === 'tip' || after.t === 'channel' || after.t === 'total')) break
    at.push(k)
    if (atoms[k + 1]?.t === 'join') k += 1
  }
  return at.length === run.length ? { run, at } : null
}

function shareTotal(draft: Draft, ctx: Context, entries: Entry[], atom: Atom & { t: 'money' }, at: number): number {
  for (const entry of entries) {
    entry.priced = true
    entry.shared = true
  }
  const total = atom.money.cents === null ? 'one price' : formatUsdShort(atom.money.cents)
  check(draft, 'sharedTotal', `${total} was said for ${entries.map((entry) => entry.heard).join(' and ')} together; split it between them.`)
  noteChecks(draft, ctx, atom)
  return at
}

function onCorrectedMoney(draft: Draft, ctx: Context, atom: Atom & { t: 'money' }) {
  const target = draft.nextIsPrice ? 'price' : (draft.lastField ?? (draft.entries.length > 0 ? 'price' : 'tip'))
  draft.nextIsPrice = false
  draft.correcting = false

  if (target === 'tip') {
    const channel = draft.lastTip ?? 'cash'
    addTip(draft, ctx, channel, atom, true)
    return
  }
  const entry = draft.entries.at(-1)
  if (!entry) {
    draft.loose.push(atom)
    return
  }
  const old = entry.priceCents === null ? 'none' : formatUsdShort(entry.priceCents)
  setPrice(draft, ctx, entry, atom)
  check(draft, 'correction', `Corrected the price from ${old} to ${atom.money.cents === null ? 'an unreadable amount' : formatUsdShort(atom.money.cents)}.`)
}

function onTip(draft: Draft, ctx: Context, atoms: readonly Atom[], i: number): number {
  draft.tipSeen = true
  noteGuessedTip(draft, ctx, atoms[i] as Atom & { t: 'tip' })
  let channel: Channel | null = null
  const before = atoms[i - 1]
  if (before?.t === 'channel') {
    channel = before.channel
    noteGuessedChannel(draft, ctx, before)
  }

  let j = i + 1
  while (atoms[j]?.t === 'channel') {
    const word = atoms[j] as Atom & { t: 'channel' }
    channel ??= word.channel
    noteGuessedChannel(draft, ctx, word)
    j += 1
  }
  const amount = atoms[j]
  if (amount?.t !== 'money') {
    if (!draft.correcting) draft.tipWithoutAmount = true
    return i
  }

  j += 1
  const trailing = atoms[j]
  if (!channel && trailing?.t === 'channel') {
    channel = trailing.channel
    noteGuessedChannel(draft, ctx, trailing)
    j += 1
  }
  addTip(draft, ctx, channel ?? 'cash', amount, draft.correcting)
  return j - 1
}

/** Moves past the atoms a handler used up, so the heard text reaches the last of them. */
function skipTo(draft: Draft, atoms: readonly Atom[], from: number, to: number): number {
  if (to > from) draft.end = atoms[to].end
  return to
}

function onTime(draft: Draft, ctx: Context, atom: Atom & { t: 'time' }) {
  const heard = heardOf(ctx, atom)
  if (atom.time === null) {
    check(draft, 'timeNotRead', `A time was said ("${heard}") but it could not be read; set it on the turn.`)
  } else if (draft.startTime === null) {
    draft.startTime = atom.time
    if (atom.guessed) check(draft, 'timeGuessedHalf', 'Is that morning or evening?')
  } else if (draft.startTime !== atom.time) {
    check(draft, 'timeNotRead', `A second time was said ("${heard}"); the first one was kept. Set the time on the turn.`)
  }
}

function run(draft: Draft, ctx: Context, atoms: readonly Atom[]) {
  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i]
    if (!NOT_CONTENT.has(atom.t)) {
      if (draft.start < 0) draft.start = atom.start
      draft.end = atom.end
    }

    switch (atom.t) {
      case 'service':
      case 'unclear':
        addEntry(draft, ctx, atom)
        if (atom.priceFirst) takePriceBefore(draft, ctx, atoms[i - 1])
        else takeLoosePrice(draft, ctx, atoms, i)
        break
      case 'money':
        i = skipTo(draft, atoms, i, onMoney(draft, ctx, atoms, i))
        break
      case 'tip':
        i = skipTo(draft, atoms, i, onTip(draft, ctx, atoms, i))
        break
      case 'noTip':
        draft.noTip = true
        if (draft.correcting) {
          const old = draft.cash + draft.card
          draft.cash = 0
          draft.card = 0
          draft.correcting = false
          check(draft, 'correction', `Corrected the tip from ${formatUsdShort(old)} to no tip.`)
        }
        break
      case 'channel':
        noteGuessedChannel(draft, ctx, atom)
        if (draft.correcting && draft.lastTip && draft.lastTip !== atom.channel) {
          const from = draft.lastTip
          draft[atom.channel] += draft[from]
          draft[from] = 0
          draft.lastTip = atom.channel
          draft.correcting = false
          check(draft, 'correction', `Moved the tip from ${channelWord(from)} to ${channelWord(atom.channel)}.`)
        }
        break
      case 'request':
        if (draft.correcting) {
          draft.sawWalkIn = false
          draft.correcting = false
          check(draft, 'correction', 'Changed the client from walk-in to request.')
        }
        draft.sawRequest = true
        break
      case 'walkIn':
        if (draft.correcting) {
          draft.sawRequest = false
          draft.correcting = false
          check(draft, 'correction', 'Changed the client from request to walk-in.')
        }
        draft.sawWalkIn = true
        break
      case 'appointment':
        check(draft, 'appointment', 'An appointment does not mean the client asked for you by name.')
        break
      case 'time':
        onTime(draft, ctx, atom)
        break
      case 'pay': {
        // "paid 35 on card": how the client paid, not a tip.
        let j = i + 1
        if (atoms[j]?.t === 'money') j += 1
        if (atoms[j]?.t === 'channel') j += 1
        check(draft, 'paymentNotTip', 'How the client paid is not a tip; no tip was taken from it.')
        i = skipTo(draft, atoms, i, j - 1)
        break
      }
      case 'backRef':
        draft.backRef = true
        break
      case 'join':
      case 'next':
        draft.joinPending = true
        break
      case 'correct':
        draft.correcting = true
        break
      case 'priceWord':
        draft.nextIsPrice = true
        break
      case 'total':
        draft.nextIsTotal = true
        break
      case 'reduce':
        draft.nextIsReduction = true
        break
      default:
        break
    }
  }
}

// ---------------------------------------------------------------------------
// Splitting into turns.
// ---------------------------------------------------------------------------

const LINKS = new Set<AtomBody['t']>(['join', 'correct', 'priceWord', 'total', 'pay', 'reduce'])

// A new service right after a priced one, with nothing joining them.
function startsNewTurn(current: readonly Atom[]): boolean {
  const lastService = current.findLastIndex((atom) => atom.t === 'service' || atom.t === 'unclear')
  if (lastService < 0) return false
  const lastMoney = current.findLastIndex((atom, k) => k > lastService && atom.t === 'money')
  if (lastMoney < 0) return false
  return !current.slice(lastMoney + 1).some((atom) => LINKS.has(atom.t))
}

interface Segment {
  atoms: Atom[]
  // Said "next" (or similar): never a continuation of the turn before.
  fresh: boolean
  inferred: boolean
}

// "gel 45, 35 pedi": an amount left over at the end of the turn before is the price of the service that follows.
function trailingPrice(current: Atom[], ctx: Context, ahead: readonly Atom[]): Atom | null {
  const probe = newDraft()
  run(probe, ctx, current)
  const last = current.at(-1)
  if (!last || probe.loose.at(-1) !== last || priceSaidBefore(ctx, [...current, ...ahead], current.length) !== last) return null
  return current.pop() ?? null
}

function segmentsOf(sentence: readonly Atom[], ctx: Context): Segment[] {
  const same = sentence.some((atom) => atom.t === 'same')
  const segments: Segment[] = [{ atoms: [], fresh: false, inferred: false }]
  for (const [n, atom] of sentence.entries()) {
    const current = segments[segments.length - 1]
    if (atom.t === 'next' && !same) {
      segments.push({ atoms: [], fresh: true, inferred: false })
    } else if ((atom.t === 'service' || atom.t === 'unclear') && !same && startsNewTurn(current.atoms)) {
      const price = trailingPrice(current.atoms, ctx, sentence.slice(n, n + 3))
      segments.push({ atoms: price ? [price, atom] : [atom], fresh: true, inferred: true })
    } else current.atoms.push(atom)
  }
  return segments
}

// "at 2 PM. gel x 45": a time said on its own is the time of the first service that follows it.
const TIME_ONLY = new Set<AtomBody['t']>(['time', ...NOT_CONTENT])

function isTimeOnly(atoms: readonly Atom[]): boolean {
  return atoms.some((atom) => atom.t === 'time') && atoms.every((atom) => TIME_ONLY.has(atom.t))
}

function finish(draft: Draft, ctx: Context, leftovers: string[]): DraftTurn {
  const checks = [...draft.checks]
  const services: DraftService[] = []

  for (const entry of draft.entries) {
    if (entry.kind === 'unclear') {
      const price = entry.priceCents === null ? '' : `; its price ${formatUsdShort(entry.priceCents)} was not used`
      checks.push({ code: 'unclearService', text: `Could not tell which service "${entry.heard}" is${price}; pick the service.` })
      continue
    }
    const preset = ctx.presets.get(entry.presetId)
    const usual = preset?.defaultPriceCents ?? ctx.lastPrices?.get(entry.presetId) ?? null
    services.push({ presetId: entry.presetId, heard: entry.heard, priceCents: entry.priceCents, usualPriceCents: usual })

    if (!entry.priced) {
      const name = nameOf(ctx, entry.presetId)
      const text = usual === null ? `No price heard for ${name}; enter one.` : `No price heard for ${name}; your usual is ${formatUsdShort(usual)}.`
      checks.push({ code: 'noPrice', text })
    }
  }

  if (draft.entries.length === 0) {
    const first = draft.loose[0]
    const price = first?.t === 'money' ? first.money.cents : null
    const text = price === null ? 'No service heard; choose one.' : `No service heard for the ${formatUsdShort(price)} said; choose a service.`
    checks.push({ code: 'noService', text })
  }
  for (const extra of draft.loose.slice(draft.entries.length === 0 ? 1 : 0)) leftovers.push(heardOf(ctx, extra))

  if (draft.tipWithoutAmount) checks.push({ code: 'tipNoAmount', text: 'A tip was mentioned without an amount; enter the tip.' })
  if (draft.sawRequest && draft.sawWalkIn) {
    checks.push({ code: 'requestConflict', text: 'Both request and walk-in were said; choose one.' })
  }
  if (draft.inferred) {
    checks.push({ code: 'inferredSplit', text: 'No separator was heard before this turn; confirm it is a new client.' })
  }

  return {
    heard: ctx.text.slice(draft.start, draft.end).trim(),
    services,
    cashTipCents: draft.cash,
    cardTipCents: draft.card,
    request: draft.sawRequest && !draft.sawWalkIn,
    startTime: draft.startTime,
    checks,
  }
}

function hasWork(draft: Draft) {
  return draft.entries.length > 0 || draft.loose.length > 0
}

function hasFollowUp(draft: Draft) {
  return draft.tipSeen || draft.noTip || draft.sawRequest || draft.sawWalkIn || draft.startTime !== null || draft.checks.length > 0
}

export function readVoice(input: ReaderInput): ReaderResult {
  const text = normalize(input.text)
  const locale: ReaderLocale = input.locale === 'mixed' ? 'vi' : input.locale
  const ctx: Context = {
    text,
    presets: new Map(input.presets.map((preset) => [preset.id, preset])),
    lastPrices: input.lastPrices,
  }

  const atoms = scan(tokenize(text), buildLexicon(input.presets, locale, input.learned))
  const notUnderstood: string[] = []
  for (let i = 0; i < atoms.length; i++) {
    if (atoms[i].t !== 'unknown') continue
    let last = i
    while (atoms[last + 1]?.t === 'unknown') last += 1
    notUnderstood.push(text.slice(atoms[i].start, atoms[last].end))
    i = last
  }

  const sentences: Atom[][] = [[]]
  for (const atom of atoms) {
    if (atom.t === 'stop') sentences.push([])
    else sentences[sentences.length - 1].push(atom)
  }

  const drafts: Draft[] = []
  let declared: { n: number; noun: string } | null = null
  // A time said on its own before any card, kept to see if a service follows.
  let waiting: { segment: Segment; copies: number } | null = null
  const startDraft = (segment: Segment, copies: number, atoms: readonly Atom[]) => {
    const draft = newDraft()
    draft.inferred = segment.inferred
    draft.copies = copies
    run(draft, ctx, atoms)
    drafts.push(draft)
  }
  for (const sentence of sentences) {
    let rest = sentence
    let copies = 1
    const count = rest[0]
    if (count?.t === 'count') {
      rest = rest.slice(1)
      while (rest[0]?.t === 'colon' || rest[0]?.t === 'comma') rest = rest.slice(1)
      if (rest[0]?.t === 'each') {
        copies = count.n
        rest = rest.slice(1)
      } else declared ??= { n: count.n, noun: count.noun }
    }

    for (const segment of segmentsOf(rest, ctx)) {
      const probe = newDraft()
      run(probe, ctx, segment.atoms)
      if (waiting && probe.entries.length > 0 && !segment.atoms.some((atom) => atom.t === 'time')) {
        startDraft(segment, copies, [...waiting.segment.atoms, ...segment.atoms])
        waiting = null
        continue
      }
      if (waiting && (hasWork(probe) || hasFollowUp(probe))) {
        startDraft(waiting.segment, waiting.copies, waiting.segment.atoms)
        waiting = null
      }
      const previous = drafts.at(-1)
      if (probe.backRef && previous && probe.entries.length === 0) {
        const said = segment.atoms.map((atom) => heardOf(ctx, atom)).join(' ')
        previous.checks.push({
          code: 'backReference',
          text: `"${said}" points back at an earlier client; nothing was changed, so fix it by hand.`,
        })
        continue
      }
      if (!segment.fresh && previous && !hasWork(probe) && hasFollowUp(probe)) {
        run(previous, ctx, segment.atoms)
      } else if (drafts.length === 0 && !hasWork(probe) && isTimeOnly(segment.atoms)) {
        waiting = { segment, copies }
      } else if (hasWork(probe) || hasFollowUp(probe)) {
        startDraft(segment, copies, segment.atoms)
      }
    }
  }

  if (waiting) startDraft(waiting.segment, waiting.copies, waiting.segment.atoms)

  const turns = drafts.flatMap((draft) => {
    const turn = finish(draft, ctx, notUnderstood)
    if (draft.copies === 1) return [turn]
    turn.checks.push({ code: 'repeatExpanded', text: `Repeated this turn for each of the ${draft.copies} clients; confirm them.` })
    return Array.from({ length: draft.copies }, () => structuredClone(turn))
  })

  if (declared && declared.n !== turns.length) {
    const noun = (n: number) => (n === 1 ? 'client' : 'clients')
    const text = `Count mismatch: you said ${declared.n} ${noun(declared.n)}, but ${turns.length} ${noun(turns.length)} were found.`
    if (turns.length > 0) turns[0].checks.push({ code: 'countMismatch', text })
    else notUnderstood.push(text)
  }

  return { turns, notUnderstood }
}

/** Words in the form the learned list keeps them: lower case, accents dropped, single spaces. */
export function foldPhrase(phrase: string): string {
  return tokenize(normalize(phrase))
    .filter((token) => token.kind === 'word' || token.kind === 'number')
    .map((token) => token.fo)
    .join(' ')
}

/**
 * Words the reader already owns, which a fix may never teach it to read
 * differently: a service name, a marker such as tip or cash, or a number.
 */
export function isReservedPhrase(phrase: string, presets: readonly ReaderPreset[], locale: ReaderLocale): boolean {
  const tokens = tokenize(normalize(phrase)).filter((token) => token.kind === 'word' || token.kind === 'number')
  if (tokens.length === 0) return true
  const lexicon = buildLexicon(presets, locale === 'mixed' ? 'vi' : locale)
  const owned = (words: readonly Token[]) => {
    const folded = lexicon.folded.get(words.map((token) => token.fo).join(' '))
    const strict = lexicon.strict.get(words.map((token) => token.lo).join(' '))
    return [folded, strict].some((entry) => entry !== undefined && !entry.soft && entry.body !== null && entry.body.t !== 'unclear')
  }
  if (owned(tokens)) return true
  // A single word that is a marker (tip, cash, request...) or part of a number.
  const marker = (token: Token) => {
    const body = lexicon.folded.get(token.fo)?.body
    return body != null && body.t !== 'service' && body.t !== 'unclear'
  }
  return tokens.some((token, index) => token.kind === 'number' || readQuantity(tokens, index) !== null || marker(token))
}
