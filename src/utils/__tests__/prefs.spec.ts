import { expect, test } from 'vitest'
import { getPrefs, setPrefs, onChange, DEFAULT_PREFS } from '../prefs/storage'

test('local fallback persists prefs and getPrefs returns merged defaults', async () => {
  // ensure starting clean by resetting prefs via API (works in test env)
  await setPrefs(DEFAULT_PREFS)

  const p1 = await getPrefs()
  expect(p1).toEqual(DEFAULT_PREFS)

  await setPrefs({ allergens: ['peanut'], locale: 'en-uk' })
  const p2 = await getPrefs()
  expect(p2.allergens).toEqual(['peanut'])
  expect(p2.locale).toBe('en-uk')
})

test('onChange fires when prefs updated (local fallback)', async () => {
  let called = false
  const unsub = onChange((newPrefs) => {
    called = true
    expect(newPrefs.allergens).toContain('shellfish')
  })

  await setPrefs({ allergens: ['shellfish'] })
  // give event loop a tick
  await new Promise((r) => setTimeout(r, 50))
  expect(called).toBe(true)
  unsub()
})
