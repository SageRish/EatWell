/**
 * Simple caching layer with in-memory store, optional IndexedDB persistence, TTL and basic rate-limiting.
 * - getOrFetch(key, fetcher, opts) will return cached value if present and valid, otherwise runs fetcher and caches result.
 * - set/get/invalidate/clear exposed.
 * - privacyMode prevents writing to persistent storage.
 * - basic token-bucket rate limiter prevents too many fetches in short time.
 */

export type CacheEntry<T = any> = {
  value: T
  expiresAt: number // epoch ms
}

export type CacheOptions = {
  ttlMs?: number
  persistent?: boolean
  // min interval between actual fetches (ms) for rate limiting
  minFetchIntervalMs?: number
}

const DEFAULT_TTL = 1000 * 60 * 60 // 1 hour
const DEFAULT_MIN_FETCH_INTERVAL = 200 // 200ms

// in-memory store
const memStore = new Map<string, CacheEntry>()

// last fetch timestamps to enforce per-key min interval
const lastFetchTs = new Map<string, number>()

let privacyMode = false

// IndexedDB wrapper (very small)
const DB_NAME = 'eatwell_cache_db'
const STORE_NAME = 'cache_store'
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'))
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function idbGet<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const r = store.get(key)
      r.onsuccess = () => resolve(r.result || null)
      r.onerror = () => resolve(null)
    })
  } catch (e) {
    return null
  }
}

async function idbSet<T>(key: string, entry: CacheEntry<T>): Promise<void> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const r = store.put(entry, key)
      r.onsuccess = () => resolve()
      r.onerror = () => resolve()
    })
  } catch (e) {
    return
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const r = store.delete(key)
      r.onsuccess = () => resolve()
      r.onerror = () => resolve()
    })
  } catch (e) {
    return
  }
}

export function setPrivacyMode(enabled: boolean) {
  privacyMode = !!enabled
}

export function now() {
  return Date.now()
}

export function get<T = any>(key: string): CacheEntry<T> | null {
  const e = memStore.get(key)
  if (!e) return null
  if (e.expiresAt < now()) {
    memStore.delete(key)
    return null
  }
  return e as CacheEntry<T>
}

export async function getPersistent<T = any>(key: string): Promise<CacheEntry<T> | null> {
  // try idb then fallback to mem
  const mem = get<T>(key)
  if (mem) return mem
  try {
    const e = await idbGet<T>(key)
    if (!e) return null
    if (e.expiresAt < now()) return null
    // populate mem for faster access
    memStore.set(key, e)
    return e
  } catch (e) {
    return null
  }
}

export async function set<T = any>(key: string, value: T, ttlMs = DEFAULT_TTL, persistent = true) {
  const entry: CacheEntry<T> = { value, expiresAt: now() + ttlMs }
  memStore.set(key, entry)
  if (persistent && !privacyMode) {
    // best-effort persist
    await idbSet(key, entry)
  }
}

export async function invalidate(key: string) {
  memStore.delete(key)
  try { await idbDelete(key) } catch (e) { /* ignore */ }
}

export async function clear() {
  memStore.clear()
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
  } catch (e) {
    // ignore
  }
}

// Basic token-bucket like global rate limiter
let tokens = 10
const maxTokens = 10
const refillIntervalMs = 1000
const refillAmount = 10

setInterval(() => {
  tokens = Math.min(maxTokens, tokens + refillAmount)
}, refillIntervalMs)

export async function getOrFetch<T = any>(key: string, fetcher: () => Promise<T>, opts?: CacheOptions): Promise<T> {
  const ttl = opts?.ttlMs ?? DEFAULT_TTL
  const persistent = opts?.persistent ?? true
  const minInterval = opts?.minFetchIntervalMs ?? DEFAULT_MIN_FETCH_INTERVAL

  // try mem or persistent
  const cached = await getPersistent<T>(key)
  if (cached) return cached.value

  // check per-key min interval
  const last = lastFetchTs.get(key) || 0
  const elapsed = now() - last
  if (elapsed < minInterval) {
    // if too soon, return any mem value or reject
    const mem = get<T>(key)
    if (mem) return mem.value
    // otherwise wait until allowed
    await new Promise((r) => setTimeout(r, minInterval - elapsed))
  }

  // global rate limit: consume a token or wait
  if (tokens <= 0) {
    // wait briefly for refill
    await new Promise((r) => setTimeout(r, 200))
  }
  tokens = Math.max(0, tokens - 1)

  lastFetchTs.set(key, now())
  const v = await fetcher()
  await set<T>(key, v, ttl, persistent)
  return v
}

export default { getOrFetch, get, set, invalidate, clear, setPrivacyMode }
