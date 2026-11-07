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
})
