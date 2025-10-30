/**
 * Preferences storage for EatWell extension.
 *
 * Strategy:
 * - Prefer chrome.storage.sync when available (keeps prefs synced across user's Chrome instances)
 * - Fallback to localStorage when chrome.storage is not available (e.g., tests or non-extension env)
 *
 * API:
 * - getPrefs(): Promise<Prefs>
 * - setPrefs(p: Partial<Prefs>): Promise<void>
 * - onChange(cb): unsubscribe()
 *
 * Privacy: this module never sends preferences to any external server. chrome.storage.sync is
 * a browser-managed sync mechanism and remains entirely under user control.
 */

export type DietaryGoals = {
  caloriesPerServing?: number | null
  dailyCalories?: number | null
}

export type Prefs = {
  allergens: string[]
  locale: string
  dietaryGoals: DietaryGoals
  // whether user completed first-run onboarding
  hasSeenOnboarding?: boolean
  // telemetry / anonymous usage opt-in
  telemetryOptIn?: boolean
  // USDA API key provided by the user via Options. Never hardcode provider keys in source.
  usdaApiKey?: string
  // privacy mode (prevent external calls / persistent writes)
  privacyMode?: boolean
}

const STORAGE_KEY = 'eatwell_prefs_v1'

export const DEFAULT_PREFS: Prefs = {
  allergens: [],
  locale: 'en-us',
  dietaryGoals: {}
  , hasSeenOnboarding: false
  , telemetryOptIn: false
  , usdaApiKey: undefined
  , privacyMode: false
}

function hasChromeStorage(): boolean {
  try {
    const c = (window as any).chrome
    return !!(c && c.storage && c.storage.sync)
  } catch (e) {
    return false
  }
}

/** Read from localStorage fallback */
let __inMemoryPrefs: Prefs | null = null

function readLocal(): Prefs {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DEFAULT_PREFS
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_PREFS, ...parsed }
    }
    return __inMemoryPrefs || DEFAULT_PREFS
  } catch (e) {
    return DEFAULT_PREFS
  }
}

/** Write to localStorage fallback */
const __listeners: Array<(p: Prefs) => void> = []

function writeLocal(p: Prefs) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
      // broadcast change for listeners in same origin (works in both content/background contexts)
      try {
        const ev = new CustomEvent('eatwell_prefs_changed', { detail: p })
        window.dispatchEvent(ev)
      } catch (e) {
        // ignore
      }
    } else {
      __inMemoryPrefs = p
      // call in-memory listeners
      for (const l of __listeners) {
        try {
          l(p)
        } catch (e) {
          // ignore listener errors
        }
      }
    }
  } catch (e) {
    // ignore storage errors
  }
}

export async function getPrefs(): Promise<Prefs> {
  if (hasChromeStorage()) {
    const c = (window as any).chrome
    return new Promise<Prefs>((resolve) => {
      try {
        c.storage.sync.get([STORAGE_KEY], (items: any) => {
          const raw = items && items[STORAGE_KEY]
          if (!raw) return resolve(DEFAULT_PREFS)
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
            resolve({ ...DEFAULT_PREFS, ...parsed })
          } catch (e) {
            resolve(DEFAULT_PREFS)
          }
        })
      } catch (e) {
        resolve(readLocal())
      }
    })
  }

  return Promise.resolve(readLocal())
}

export async function setPrefs(update: Partial<Prefs>): Promise<void> {
  if (hasChromeStorage()) {
    const c = (window as any).chrome
    return new Promise<void>((resolve) => {
      try {
        // read-modify-write to keep unspecified keys
        c.storage.sync.get([STORAGE_KEY], (items: any) => {
          const raw = items && items[STORAGE_KEY]
          let base: any = DEFAULT_PREFS
          try {
            base = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : DEFAULT_PREFS
          } catch (e) {
            base = DEFAULT_PREFS
          }
          const merged = { ...base, ...update }
          // store as object (chrome.storage serializes)
          const toStore: any = {}
          toStore[STORAGE_KEY] = merged
          c.storage.sync.set(toStore, () => {
            resolve()
          })
        })
      } catch (e) {
        // if chrome fails, fallback to local
        const local = { ...readLocal(), ...update }
        writeLocal(local)
        resolve()
      }
    })
  }

  // local fallback
  const base = readLocal()
  const merged = { ...base, ...update }
  writeLocal(merged)
  return Promise.resolve()
}

export function onChange(cb: (newPrefs: Prefs) => void): () => void {
  let unsub = () => {}
  if (hasChromeStorage()) {
    const c = (window as any).chrome
    const listener = (changes: any, areaName: string) => {
      if (areaName !== 'sync') return
      if (!changes || !changes[STORAGE_KEY]) return
      const after = changes[STORAGE_KEY].newValue
      try {
        const parsed = typeof after === 'string' ? JSON.parse(after) : after
        cb({ ...DEFAULT_PREFS, ...parsed })
      } catch (e) {
        cb(DEFAULT_PREFS)
      }
    }
    c.storage.onChanged.addListener(listener)
    unsub = () => c.storage.onChanged.removeListener(listener)
    return unsub
  }

  const handler = (e: Event) => {
    try {
      // support both StorageEvent and our CustomEvent
      if ((e as StorageEvent).key && (e as StorageEvent).key === STORAGE_KEY) {
        const se = e as StorageEvent
        const newVal = se.newValue ? JSON.parse(se.newValue) : null
        cb({ ...DEFAULT_PREFS, ...(newVal || {}) })
      } else if ((e as CustomEvent).detail) {
        const d = (e as CustomEvent).detail
        cb({ ...DEFAULT_PREFS, ...(d || {}) })
      }
    } catch (err) {
      cb(DEFAULT_PREFS)
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handler)
    window.addEventListener('eatwell_prefs_changed', handler as EventListener)
    unsub = () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('eatwell_prefs_changed', handler as EventListener)
    }
  } else {
    // fallback: in-memory listeners when window not available (e.g., test environment)
    __listeners.push(cb)
    unsub = () => {
      const idx = __listeners.indexOf(cb)
      if (idx >= 0) __listeners.splice(idx, 1)
    }
  }
  return unsub
}

export default { getPrefs, setPrefs, onChange }
