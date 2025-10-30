import { IngredientInput, RecipeNutritionResult, aggregateRecipeNutrition } from './nutrition/recipeNutrition'

export type ScaledIngredient = IngredientInput & {
  originalGrams: number
  scaledGramsExact: number
  scaledGramsRounded: number
  roundingNote?: string
}

export type ScaleResult = {
  ingredientsScaled: ScaledIngredient[]
  totalNutrients: RecipeNutritionResult['totalNutrients']
  perServingNutrients: RecipeNutritionResult['perServingNutrients']
  scaleFactor: number
}

function roundGrams(g: number) {
  if (!isFinite(g) || isNaN(g)) return g
  if (g >= 10) return Math.round(g)
  if (g >= 1) return Math.round(g * 2) / 2 // nearest 0.5g
  return Math.round(g * 10) / 10 // nearest 0.1g
}

/**
 * Scale recipe ingredients either by newServingsCount or by targetCaloriesPerServing
 * - If newServingsCount provided: scaleFactor = newServingsCount / currentServings
 * - Else if targetCaloriesPerServing provided: compute current per-serving calories and derive scaleFactor
 */
export async function scaleRecipe(
  inputs: IngredientInput[],
  currentServings: number,
  opts: { newServingsCount?: number; targetCaloriesPerServing?: number }
): Promise<ScaleResult> {
  const { newServingsCount, targetCaloriesPerServing } = opts

  // Defensive
  const safeCurrentServings = currentServings > 0 ? currentServings : 1

  let scaleFactor = 1

  if (typeof newServingsCount === 'number' && newServingsCount > 0) {
    scaleFactor = newServingsCount / safeCurrentServings
  } else if (typeof targetCaloriesPerServing === 'number' && targetCaloriesPerServing > 0) {
    // compute current calories per serving
    const baseNutrition = await aggregateRecipeNutrition(inputs, safeCurrentServings)
    const currentPerServingCalories = baseNutrition.perServingNutrients.calories || 0
    if (currentPerServingCalories > 0) {
      scaleFactor = targetCaloriesPerServing / currentPerServingCalories
    } else {
      scaleFactor = 1
    }
  }

  // avoid nonsensical tiny factors
  if (!isFinite(scaleFactor) || isNaN(scaleFactor) || scaleFactor <= 0) scaleFactor = 1

  const ingredientsScaled: ScaledIngredient[] = inputs.map((ing) => {
    const original = ing.grams
    const exact = original * scaleFactor
    const rounded = roundGrams(exact)
    let note = ''
    if (Math.abs(exact - rounded) > 1e-6) {
      note = `Rounded from ${Number(exact.toFixed(3))} g to ${rounded} g for display`
    }
    return { ...ing, originalGrams: original, grams: rounded, scaledGramsExact: exact, scaledGramsRounded: rounded, roundingNote: note }
  })

  // compute nutrients for scaled ingredients (total and per-serving based on new servings)
  const effectiveServings = typeof newServingsCount === 'number' && newServingsCount > 0 ? newServingsCount : Math.max(1, Math.round(safeCurrentServings * scaleFactor))

  const nutrition = await aggregateRecipeNutrition(ingredientsScaled, effectiveServings)

  return {
    ingredientsScaled,
    totalNutrients: nutrition.totalNutrients,
    perServingNutrients: nutrition.perServingNutrients,
    scaleFactor
  }
}

export default { scaleRecipe }
