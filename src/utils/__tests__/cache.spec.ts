import { expect, test } from 'vitest'
import cache, { getOrFetch, setPrivacyMode } from '../cache'

test('repeated identical queries within TTL hit cache', async () => {
  // simple fetcher that counts calls
  let calls = 0
  const fetcher = async () => {
    calls++
    return { time: Date.now(), calls }
  }

  // ensure privacy mode to avoid IndexedDB interference in tests
  setPrivacyMode(true)

  const key = 'test-key-ttl'
  const first = await getOrFetch(key, fetcher, { ttlMs: 500, persistent: false })
  const second = await getOrFetch(key, fetcher, { ttlMs: 500, persistent: false })

  expect(calls).toBe(1)
  expect(second).toEqual(first)

  // after TTL expires, fetcher should be called again
  await new Promise((r) => setTimeout(r, 600))
  const third = await getOrFetch(key, fetcher, { ttlMs: 500, persistent: false })
  expect(calls).toBeGreaterThan(1)
  expect(third).not.toEqual(first)
})
