// Sound-alike matching for the voice reader: words no list has are compared by
// how they sound against the person's own service names. The rules follow
// docs/voice/mishearing-rules.md. Everything the key knows is in the tables
// below, and one function turns words into a key. Plain TypeScript.
//
// A key is a string of sounds. An upper-case sound must be matched; a
// lower-case sound is weak (a dropped final consonant, or an l) and may be
// missing on either side.

import { foldText } from './textFold.ts'

// Spelling to sound, applied in order to one folded word. Upper case is a
// finished sound; whatever is left in lower case is a plain consonant.
const SPELLING: [RegExp, string][] = [
  [/ch$/, 'K'], // a Vietnamese final -ch is a k: "lich"
  [/tch|ch|tr/g, 'C'], // ch and tr are one sound
  [/ph/g, 'F'],
  [/th/g, 'T'],
  [/kh/g, 'K'],
  [/sh/g, 'S'],
  [/ck|q/g, 'K'],
  [/c(?=[eiy])/g, 'S'],
  [/c|k/g, 'K'],
  [/dz|gi|[jzd]/g, 'J'], // soft g, j, gi, d and z are one sound
  [/g(?=[eiy])/g, 'J'],
  [/x/g, 'X'],
]

// Whole words that are the letter X in "Gel-X".
const X_WORDS = new Set(['x', 's', 'ex', 'es', 'eks', 'ecs', 'ics', 'ich', 'ic', 'et', 'ech', 'egg', 'eggs'])

// Sounds that may be dropped at the end of a word, and the sounds dropped anywhere.
const WEAK_FINALS = 'TKPS'
const WEAK_ANYWHERE = 'L'

// Words too general to pick a service on their own.
export const GENERIC_SOUND_WORDS = new Set(['gel', 'acrylic', 'art', 'dip', 'nail', 'nails', 'and', 'with'])

export const lettersOf = (text: string): string[] => foldText(text).match(/[a-z]+/g) ?? []

function wordSound(word: string): string {
  if (X_WORDS.has(word)) return 'X'
  let sound = word
  for (const [pattern, sounds] of SPELLING) sound = sound.replace(pattern, sounds)
  sound = sound.replace(/[aeiouyh]/g, '').toUpperCase().replace(/(.)\1+/g, '$1')
  const last = sound.length - 1
  return [...sound]
    .map((letter, index) => (WEAK_ANYWHERE.includes(letter) || (index === last && WEAK_FINALS.includes(letter)) ? letter.toLowerCase() : letter))
    .join('')
}

/** The sounds of the words said one after another; joined or split words give the same key. */
export function soundKey(words: readonly string[]): string {
  return words.map(wordSound).join('')
}

/** How many sounds must be matched. A key with fewer than two is too short to trust. */
export const strongSounds = (key: string): number => [...key].filter((letter) => letter === letter.toUpperCase()).length

/** The two keys are the same once weak sounds are allowed to be missing on either side. */
export function sameSound(a: string, b: string): boolean {
  const seen = new Set<number>()
  const match = (i: number, j: number): boolean => {
    if (i === a.length && j === b.length) return true
    const id = i * (b.length + 1) + j
    if (seen.has(id)) return false
    seen.add(id)
    if (i < a.length && j < b.length && a[i].toLowerCase() === b[j].toLowerCase() && match(i + 1, j + 1)) return true
    if (i < a.length && a[i] === a[i].toLowerCase() && match(i + 1, j)) return true
    return j < b.length && b[j] === b[j].toLowerCase() && match(i, j + 1)
  }
  return match(0, 0)
}

export interface SoundName {
  presetId: string
  key: string
}

/** One entry per name of a service: English and Vietnamese, and each slash or bracket part. A name made only of general words gives none. */
export function soundNames(presetId: string, names: readonly string[]): SoundName[] {
  const result: SoundName[] = []
  for (const name of names) {
    for (const part of name.split(/[/()]/)) {
      const words = lettersOf(part)
      if (words.every((word) => GENERIC_SOUND_WORDS.has(word))) continue
      const key = soundKey(words)
      if (strongSounds(key) >= 2) result.push({ presetId, key })
    }
  }
  return result
}

/** The services whose names sound like these words; empty when the words are too general or too short. */
export function soundFits(words: readonly string[], names: readonly SoundName[]): string[] {
  if (words.every((word) => GENERIC_SOUND_WORDS.has(word))) return []
  const key = soundKey(words)
  if (strongSounds(key) < 2) return []
  return [...new Set(names.filter((name) => sameSound(key, name.key)).map((name) => name.presetId))]
}
