import { beforeEach, describe, expect, it, vi } from 'vitest'
import { persistState, requestPersistence, resetPersistenceRequest } from '../../src/pwa/persistStorage.ts'

function fakeStorage({ persisted = false, grant = true } = {}) {
  let state = persisted
  return {
    persisted: vi.fn(async () => state),
    persist: vi.fn(async () => {
      state = grant
      return grant
    }),
  }
}

beforeEach(() => resetPersistenceRequest())

describe('requestPersistence', () => {
  it('asks once and reports a grant', async () => {
    const storage = fakeStorage()
    expect(await requestPersistence(storage)).toBe('persisted')
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('does not ask when already persisted', async () => {
    const storage = fakeStorage({ persisted: true })
    expect(await requestPersistence(storage)).toBe('persisted')
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('asks at most once per session after a refusal', async () => {
    const storage = fakeStorage({ grant: false })
    expect(await requestPersistence(storage)).toBe('not-persisted')
    expect(await requestPersistence(storage)).toBe('not-persisted')
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('is safe when the API is missing or throws', async () => {
    expect(await requestPersistence(undefined)).toBe('unsupported')
    const broken = { persisted: vi.fn(async () => { throw new Error('nope') }), persist: vi.fn() }
    expect(await requestPersistence(broken)).toBe('not-persisted')
  })
})

describe('persistState', () => {
  it('reports without asking', async () => {
    const storage = fakeStorage()
    expect(await persistState(storage)).toBe('not-persisted')
    expect(storage.persist).not.toHaveBeenCalled()
  })
})
