import { expect, test } from 'vitest'
import { localizeIngredient } from '../localization'

test('dictionary lookup returns localized name and high confidence', async () => {
  const res = await localizeIngredient('coriander', 'en-IN')
  expect(res.source).toBe('dictionary')
  expect(res.confidence).toBeGreaterThan(0.9)
  expect(typeof res.localName).toBe('string')
  expect(res.localName.toLowerCase()).toContain('dhaniya')
})

test('uk mapping uses aubergine for eggplant', async () => {
  const res = await localizeIngredient('eggplant', 'en-UK')
  expect(res.source).toBe('dictionary')
  expect(res.localName.toLowerCase()).toBe('aubergine')
})

test('fallback uses translatorFn when dictionary missing', async () => {
  const mockTranslator = async (text: string, locale: string) => {
    // simple mock: append locale tag
    return `${text} (${locale} translated)`
  }

  const res = await localizeIngredient('dragon fruit', 'en-IN', { translatorFn: mockTranslator })
  expect(res.source).toBe('translator')
  expect(res.confidence).toBeGreaterThan(0.5)
  expect(res.localName).toContain('dragon fruit')
  expect(res.localName).toContain('en-IN')
})
