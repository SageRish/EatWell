import { expect, test } from 'vitest'
import { scaleRecipe } from '../scaleRecipe'
import { IngredientInput } from '../nutrition/recipeNutrition'

test('scales recipe to half servings correctly (nutrients halved)', async () => {
  // recipe for 2 servings
  const inputs: IngredientInput[] = [
    { canonicalName: 'wheat flour', grams: 200 }, // 200g
    { canonicalName: 'peanut butter', grams: 100 } // 100g
  ]

  const currentServings = 2

  const resHalf = await scaleRecipe(inputs, currentServings, { newServingsCount: 1 })

  // scaleFactor should be 0.5
  expect(resHalf.scaleFactor).toBeCloseTo(0.5)

  // total calories should be halved relative to original
  const original = await (await import('../nutrition/recipeNutrition')).aggregateRecipeNutrition(inputs, currentServings)
  expect(resHalf.totalNutrients.calories).toBeCloseTo(Math.round((original.totalNutrients.calories * 0.5) * 100) / 100)
})

test('scales recipe to double servings correctly (nutrients doubled)', async () => {
  // recipe for 2 servings
  const inputs: IngredientInput[] = [
    { canonicalName: 'wheat flour', grams: 200 },
    { canonicalName: 'peanut butter', grams: 100 }
  ]
  const currentServings = 2
  const resDouble = await scaleRecipe(inputs, currentServings, { newServingsCount: 4 })
  expect(resDouble.scaleFactor).toBeCloseTo(2)

  const original = await (await import('../nutrition/recipeNutrition')).aggregateRecipeNutrition(inputs, currentServings)
  // when doubling servings (2->4), total nutrients should double
  expect(resDouble.totalNutrients.calories).toBeCloseTo(Math.round((original.totalNutrients.calories * 2) * 100) / 100)
})
