import { expect, test } from 'vitest'
import { aggregateRecipeNutrition } from '../nutrition/recipeNutrition'

test('aggregate recipe nutrition calculates totals and per-serving correctly', async () => {
  const inputs = [
    { canonicalName: 'peanut butter', grams: 50 }, // 588 kcal/100g => 294
    { canonicalName: 'wheat flour', grams: 100 }, // 364 kcal/100g => 364
    { canonicalName: 'soy sauce', grams: 10 } // 53 kcal/100g => 5.3
  ]

  const res = await aggregateRecipeNutrition(inputs, 4)
  expect(res).not.toBeNull()
  const total = res.totalNutrients
  // expected total calories approx 294 + 364 + 5.3 = 663.3
  expect(total.calories).toBeGreaterThan(660)
  expect(total.calories).toBeLessThan(666)

  const perServing = res.perServingNutrients
  // per serving approx 165.825 -> rounded 165.83
  // exact hand-calculated per-serving expected ~165.83
  expect(perServing.calories).toBeCloseTo(165.83, 2)
  expect(res.uncertain).toBe(false)
})

test('propagates uncertainty when grams are estimated or data missing', async () => {
  const inputs = [
    { canonicalName: 'peanut butter', grams: 50, estimated: true },
    { canonicalName: 'unknown ingredient', grams: 30 }
  ]
  const res = await aggregateRecipeNutrition(inputs, 2)
  expect(res.uncertain).toBe(true)
  // unknown ingredient will have null nutrients in perIngredient
  const unknown = res.perIngredient?.find(p => p.input.canonicalName === 'unknown ingredient')
  expect(unknown).toBeDefined()
  expect(unknown?.nutrients).toBeNull()
})
