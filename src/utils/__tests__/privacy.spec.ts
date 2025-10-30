import { expect, test, vi } from 'vitest'
import privacy, { setPrivacyMode, isPrivacyMode } from '../privacy'
import * as usda from '../nutrition/providers/usdaProvider'
import config from '../../../src/config/nutritionConfig'
import { getNutrition } from '../nutrition'

test('when privacy mode enabled, providerLookup uses mock and does not call usda', async () => {
  // force provider to usda to test enforcement
  ;(config as any).provider = 'usda'
  const spy = vi.spyOn(usda, 'lookupUsda')
  await setPrivacyMode(true)
  expect(isPrivacyMode()).toBe(true)

  const res = await getNutrition('peanut', 100)
  // in privacy mode, mock provider should be used; usda lookup should not be called
  expect(spy).not.toHaveBeenCalled()
  expect(res).not.toBeNull()

  // cleanup
  await setPrivacyMode(false)
  spy.mockRestore()
})
