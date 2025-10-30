import { expect, test } from 'vitest'
import { getNutrition } from '../nutrition'

test('mock provider returns per100g and scaled for quantity', async () => {
  const res = await getNutrition('peanut butter', 50)
  expect(res).not.toBeNull()
  if (!res) return
  expect(res.per100g.calories).toBeGreaterThan(0)
  // per100g was 588 in mock; for 50g should be about 294
  expect(res.forQuantity.calories).toBeGreaterThan(200)
  expect(res.forQuantity.calories).toBeLessThan(350)
})
