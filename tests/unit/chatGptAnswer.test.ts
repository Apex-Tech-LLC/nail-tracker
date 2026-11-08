import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESETS } from '../../src/db/seed.ts'
import {
  ANSWER_FORMAT,
  answerAsReaderResult,
  chatGptPrompt,
  decodeProblem,
  readChatGptAnswer,
} from '../../src/domain/chatGptAnswer.ts'
import type { ReaderPreset } from '../../src/domain/voiceReader.ts'

const presets: ReaderPreset[] = DEFAULT_PRESETS.map((preset) => ({
  id: preset.id,
  nameEn: preset.nameEn,
  nameVi: preset.nameVi,
  defaultPriceCents: preset.id === 'pedicure' ? 3500 : null,
}))

const read = (text: string) => readChatGptAnswer({ text, presets })
const turn = (body: string) => `{"turns":[${body}]}`
const GOOD = '{"services":[{"id":"gel-manicure","price":"45.00"}],"cashTip":"10.00","cardTip":"0","request":false}'

describe('readChatGptAnswer: good answers', () => {
  it('reads the format the prompt asks for', () => {
    const { turns, problems } = read(ANSWER_FORMAT)
    expect(problems).toEqual([])
    expect(turns).toHaveLength(1)
    expect(turns[0]).toMatchObject({
      services: [{ presetId: 'gel-manicure', priceCents: 4500, usualPriceCents: null }],
      cashTipCents: 1000,
      cardTipCents: 0,
      request: false,
      checks: [],
    })
  })

  it('reads several turns, tips on card, requests and amounts without cents', () => {
    const { turns, problems } = read(
      turn(
        `${GOOD},{"services":[{"id":"manicure","price":"30"},{"id":"nail-art","price":"7.5"}],"cashTip":"0","cardTip":"8.05","request":true}`,
      ),
    )
    expect(problems).toEqual([])
    expect(turns[1]).toMatchObject({
      services: [
        { presetId: 'manicure', priceCents: 3000 },
        { presetId: 'nail-art', priceCents: 750 },
      ],
      cashTipCents: 0,
      cardTipCents: 805,
      request: true,
    })
  })

  it('treats a null price as none said: the usual price and a noPrice check', () => {
    const { turns } = read(turn('{"services":[{"id":"pedicure","price":null}]}'))
    expect(turns[0]?.services).toEqual([{ presetId: 'pedicure', priceCents: null, usualPriceCents: 3500 }])
    expect(turns[0]?.checks.map((check) => check.code)).toEqual(['noPrice'])
    expect(turns[0]).toMatchObject({ cashTipCents: 0, cardTipCents: 0, request: false })
  })

  it('falls back to the last price used when the service has no usual price', () => {
    const { turns } = readChatGptAnswer({
      text: turn('{"services":[{"id":"manicure","price":null}]}'),
      presets,
      lastPrices: new Map([['manicure', 2800]]),
    })
    expect(turns[0]?.services[0]?.usualPriceCents).toBe(2800)
  })

  it('ignores fields it does not know', () => {
    const { turns, problems } = read(
      '{"note":"hi","turns":[{"services":[{"id":"manicure","price":"30","color":"red"}],"mood":"great"}]}',
    )
    expect(problems).toEqual([])
    expect(turns).toHaveLength(1)
  })

  it('hands the Check screen the same result shape as the spoken reader', () => {
    const result = answerAsReaderResult(read(turn(`${GOOD},{"services":[{"id":"nope"}]}`)))
    expect(result.turns).toHaveLength(1)
    expect(result.notUnderstood).toHaveLength(1)
    expect(decodeProblem(result.notUnderstood[0] ?? '')).toEqual({
      code: 'unknownService',
      turn: 2,
      detail: 'nope',
    })
  })
})

describe('readChatGptAnswer: finding the block', () => {
  it('finds it inside a code fence', () => {
    const { turns, problems } = read('```json\n' + turn(GOOD) + '\n```')
    expect(problems).toEqual([])
    expect(turns).toHaveLength(1)
  })

  it('finds it with prose before and after, and uses only the first block', () => {
    const second = turn('{"services":[{"id":"manicure","price":"20"}]}')
    const { turns } = read(`Sure! Here you go {not json}:\n${turn(GOOD)}\nHope it helps. Also ${second}`)
    expect(turns).toHaveLength(1)
    expect(turns[0]?.services[0]?.presetId).toBe('gel-manicure')
  })

  it('is not fooled by braces inside strings', () => {
    const { turns, problems } = read('{"note":"a } b { c","turns":[' + GOOD + ']}')
    expect(problems).toEqual([])
    expect(turns).toHaveLength(1)
  })

  it('refuses text with no block, and a broken block', () => {
    expect(read('I could not do that.').problems[0]?.code).toBe('noJson')
    expect(read('{"turns":[').problems[0]?.code).toBe('badJson')
    expect(read('{turns: nope}').problems[0]?.code).toBe('badJson')
  })

  it('refuses an answer with no turns list or an empty one', () => {
    expect(read('{"turns":"x"}').problems[0]?.code).toBe('noTurns')
    expect(read('{"turns":[]}').problems[0]?.code).toBe('noTurns')
    expect(read('{"services":[]}').problems[0]?.code).toBe('noTurns')
  })
})

describe('readChatGptAnswer: strict fields', () => {
  const only = (body: string) => {
    const { turns, problems } = read(turn(body))
    return { turns, problem: problems[0] }
  }

  it('refuses an id that is not on the list', () => {
    const { turns, problem } = only('{"services":[{"id":"pedicure-deluxe","price":"30"}]}')
    expect(turns).toEqual([])
    expect(problem).toEqual({ code: 'unknownService', turn: 1, detail: 'pedicure-deluxe' })
    expect(only('{"services":[{"price":"30"}]}').problem?.code).toBe('unknownService')
    expect(only('{"services":[{"id":"other","price":"30"}]}').problem?.code).toBe('unknownService')
  })

  it.each(['forty-ish', '45.123', '1,000', '$45', ' 45', '-5', '4 5', '', '.5', '45.', '1e2', 'NaN'])(
    'refuses the price %j',
    (price) => {
      const { turns, problem } = only(`{"services":[{"id":"manicure","price":${JSON.stringify(price)}}]}`)
      expect(turns).toEqual([])
      expect(problem?.code).toBe('badPrice')
    },
  )

  it('refuses a price that is a JSON number, because money is text', () => {
    expect(only('{"services":[{"id":"manicure","price":45}]}').problem?.code).toBe('badPrice')
    expect(only('{"services":[{"id":"manicure","price":45.5}]}').problem?.code).toBe('badPrice')
  })

  it('refuses a price above the cents limit', () => {
    expect(only('{"services":[{"id":"manicure","price":"1000000.00"}]}').problem?.code).toBe('badPrice')
  })

  it('refuses negative tips by name, and other bad tips', () => {
    expect(only(`{"services":[{"id":"manicure","price":"30"}],"cashTip":"-5"}`).problem?.code).toBe('negativeTip')
    expect(only(`{"services":[{"id":"manicure","price":"30"}],"cardTip":"−5.00"}`).problem?.code).toBe('negativeTip')
    expect(only(`{"services":[{"id":"manicure","price":"30"}],"cashTip":"ten"}`).problem?.code).toBe('badTip')
    expect(only(`{"services":[{"id":"manicure","price":"30"}],"cashTip":10}`).problem?.code).toBe('badTip')
    expect(only(`{"services":[{"id":"manicure","price":"30"}],"cardTip":"2.555"}`).problem?.code).toBe('badTip')
  })

  it('needs request to be a real true or false', () => {
    expect(only(`{"services":[{"id":"manicure","price":"30"}],"request":"yes"}`).problem?.code).toBe('badRequest')
    expect(only(`{"services":[{"id":"manicure","price":"30"}],"request":1}`).problem?.code).toBe('badRequest')
    expect(only(`{"services":[{"id":"manicure","price":"30"}],"request":true}`).turns[0]?.request).toBe(true)
  })

  it('refuses a turn with no services, or shapes that are not objects', () => {
    expect(only('{"services":[]}').problem?.code).toBe('noServices')
    expect(only('{"cashTip":"5"}').problem?.code).toBe('noServices')
    expect(only('"manicure"').problem?.code).toBe('notObject')
    expect(only('{"services":["manicure"]}').problem?.code).toBe('notObject')
  })

  it('keeps the good turns and names the number of each refused one', () => {
    const { turns, problems } = read(
      turn(`${GOOD},{"services":[{"id":"manicure","price":"abc"}]},{"services":[{"id":"manicure","price":"20"}]}`),
    )
    expect(turns).toHaveLength(2)
    expect(problems).toEqual([{ code: 'badPrice', turn: 2, detail: 'abc' }])
  })

  it('cuts a long bad value short in the reason', () => {
    const { problem } = only(`{"services":[{"id":"manicure","price":"${'x'.repeat(500)}"}]}`)
    expect(problem?.detail.length).toBeLessThan(40)
  })
})

describe('readChatGptAnswer: empty and huge answers', () => {
  it('refuses an empty answer', () => {
    expect(read('').problems).toEqual([{ code: 'empty', turn: null, detail: '' }])
    expect(read('  \n ').problems[0]?.code).toBe('empty')
  })

  it('refuses a huge answer without reading it', () => {
    const started = Date.now()
    const result = read(turn(GOOD) + ' '.repeat(200_000))
    expect(result.turns).toEqual([])
    expect(result.problems[0]?.code).toBe('tooBig')
    expect(Date.now() - started).toBeLessThan(500)
  })

  it('refuses too many turns, and stays fast on a pile of open braces', () => {
    const many = Array.from({ length: 101 }, () => GOOD).join(',')
    expect(read(turn(many)).problems[0]?.code).toBe('tooMany')

    const started = Date.now()
    expect(read('{'.repeat(90_000)).problems[0]?.code).toBe('badJson')
    expect(Date.now() - started).toBeLessThan(2000)
  })
})

describe('chatGptPrompt', () => {
  const prompt = chatGptPrompt(presets)

  it('lists every service with its id and both names', () => {
    expect(prompt).toContain('- gel-manicure: Gel Manicure / Sơn gel tay')
    expect(prompt).toContain('- gel-x: Gel-X')
    expect(prompt).not.toContain('- gel-x: Gel-X / Gel-X')
    for (const preset of presets) expect(prompt).toContain(`- ${preset.id}: `)
  })

  it('holds the exact reply format and a worked example the reader accepts', () => {
    expect(prompt).toContain(ANSWER_FORMAT)
    const example = /You reply: (.*)$/m.exec(prompt)?.[1] ?? ''
    const { turns, problems } = read(example)
    expect(problems).toEqual([])
    expect(turns).toHaveLength(2)
    expect(turns[1]).toMatchObject({ request: true, services: [{ presetId: 'pedicure', priceCents: null }] })
  })
})
