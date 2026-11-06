import { useEffect, useState } from 'react'

// Browsers may evict a site's data under storage pressure (Safari also
// after weeks without use). Persistent storage opts out of that. Chrome
// decides silently from engagement and installation; Firefox asks the user,
// which is why we only ask after the first turn, once the data is worth
// keeping, and not on the first visit.

type StorageApi = Pick<StorageManager, 'persist' | 'persisted'>

export type PersistState = 'persisted' | 'not-persisted' | 'unsupported'

function storageApi(): StorageApi | undefined {
  // Older Safari and some embedded browsers have no StorageManager.
  return typeof navigator !== 'undefined' && 'storage' in navigator && 'persist' in navigator.storage ? navigator.storage : undefined
}

let askedThisSession = false

/**
 * Asks for persistent storage at most once per session, and not at all if
 * already granted. Never throws: the app works either way.
 */
export async function requestPersistence(storage: StorageApi | undefined = storageApi()): Promise<PersistState> {
  if (!storage) return 'unsupported'
  try {
    if (await storage.persisted()) return 'persisted'
    if (askedThisSession) return 'not-persisted'
    askedThisSession = true
    return (await storage.persist()) ? 'persisted' : 'not-persisted'
  } catch {
    return 'not-persisted'
  }
}

export async function persistState(storage: StorageApi | undefined = storageApi()): Promise<PersistState> {
  if (!storage) return 'unsupported'
  try {
    return (await storage.persisted()) ? 'persisted' : 'not-persisted'
  } catch {
    return 'not-persisted'
  }
}

/** For tests: forget that we asked. */
export function resetPersistenceRequest(): void {
  askedThisSession = false
}

/** Current persistence state; undefined while checking. */
export function usePersistState(): PersistState | undefined {
  const [state, setState] = useState<PersistState>()
  useEffect(() => {
    let active = true
    persistState().then((s) => active && setState(s))
    return () => {
      active = false
    }
  }, [])
  return state
}
