import type { Locale } from './locale.ts'

// Spells out an amount under the amount field ("صد و بیست هزار") so a
// missing or extra zero is obvious before saving.

const FA = {
  ones: ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'],
  teens: ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'],
  tens: ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'],
  hundreds: ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'],
  scales: ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'],
}

const EN = {
  ones: ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  teens: ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'],
  tens: ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'],
  scales: ['', 'thousand', 'million', 'billion', 'trillion'],
}

function belowThousandFa(n: number): string {
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h) parts.push(FA.hundreds[h])
  if (rest >= 10 && rest < 20) parts.push(FA.teens[rest - 10])
  else {
    if (rest >= 20) parts.push(FA.tens[Math.floor(rest / 10)])
    if (rest % 10) parts.push(FA.ones[rest % 10])
  }
  return parts.join(' و ')
}

function belowThousandEn(n: number): string {
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h) parts.push(`${EN.ones[h]} hundred`)
  if (rest >= 10 && rest < 20) parts.push(EN.teens[rest - 10])
  else if (rest >= 20) parts.push(EN.tens[Math.floor(rest / 10)] + (rest % 10 ? `-${EN.ones[rest % 10]}` : ''))
  else if (rest) parts.push(EN.ones[rest])
  return parts.join(' ')
}

/** Positive whole numbers below 10^15 in words; empty string otherwise. */
export function numberToWords(n: number, locale: Locale): string {
  if (!Number.isInteger(n) || n <= 0 || n >= 1e15) return ''

  const groups: number[] = []
  for (let rest = n; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000)

  const words: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]
    if (!group) continue
    if (locale === 'fa') {
      // "هزار", not "یک هزار", is how Persian says a plain thousand.
      const count = group === 1 && i === 1 ? '' : belowThousandFa(group)
      words.push([count, FA.scales[i]].filter(Boolean).join(' '))
    } else {
      words.push([belowThousandEn(group), EN.scales[i]].filter(Boolean).join(' '))
    }
  }
  return words.join(locale === 'fa' ? ' و ' : ' ')
}
