import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shareOrDownload } from '../../src/features/backup/backupFormat.ts'

const downloaded: string[] = []
let share: ReturnType<typeof vi.fn>

function backupFile(): File {
  return new File(['{"app":"nail-tracker"}'], 'nail-tracker-backup-2026-11-04.json', {
    type: 'application/json',
  })
}

beforeEach(() => {
  downloaded.length = 0
  share = vi.fn()
  vi.stubGlobal('navigator', { share, canShare: () => true })
  vi.stubGlobal('document', {
    createElement: () => ({ href: '', download: '', click: () => downloaded.push('click') }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('shareOrDownload', () => {
  it('downloads the file when the share sheet refuses after user activation expired', async () => {
    share.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'))

    const result = await shareOrDownload(backupFile())

    expect(result).toBe('downloaded')
    expect(share).toHaveBeenCalledOnce()
    expect(downloaded).toEqual(['click'])
  })

  it('treats a cancelled share as no backup and does not download', async () => {
    share.mockRejectedValue(new DOMException('Cancelled', 'AbortError'))

    const result = await shareOrDownload(backupFile())

    expect(result).toBe('cancelled')
    expect(downloaded).toEqual([])
  })

  it('downloads a picture as its own PNG file, not as broken text', async () => {
    share.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'))
    const created: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value: Blob | MediaSource) => {
      created.push(value as Blob)
      return 'blob:test'
    })
    const bytes = new Uint8Array([137, 80, 78, 71])
    const picture = new File([bytes], 'nail-tracker-statement-2026-11-07.png', {
      type: 'image/png',
    })

    const result = await shareOrDownload(picture)

    expect(result).toBe('downloaded')
    expect(created).toHaveLength(1)
    expect(created[0].type).toBe('image/png')
    expect(created[0].size).toBe(bytes.length)
  })
})
