import { getNutrition } from './index'
import { Per100g } from './types'

export type IngredientInput = {
  canonicalName: string
  grams: number
  estimated?: boolean
}

export type AggregatedNutrients = {
  calories: number
  protein: number
  carbs: number
  fat: number
  sugar: number
  fiber: number
  sodium: number
}

export type RecipeNutritionResult = {
  totalNutrients: AggregatedNutrients
  perServingNutrients: AggregatedNutrients
  uncertain: boolean
  perIngredient?: Array<{ input: IngredientInput; nutrients: AggregatedNutrients | null }>
}

function zero(): AggregatedNutrients {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 }
}

function add(a: AggregatedNutrients, b: AggregatedNutrients) {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    sugar: a.sugar + b.sugar,
    fiber: a.fiber + b.fiber,
    sodium: a.sodium + b.sodium
  }
}

function scalePer100(per100: Per100g, grams: number): AggregatedNutrients {
  const factor = grams / 100
  // keep full precision here; rounding happens at final output
  return {
    calories: per100.calories * factor,
    protein: per100.protein * factor,
    carbs: per100.carbs * factor,
    fat: per100.fat * factor,
    sugar: per100.sugar * factor,
    fiber: per100.fiber * factor,
    sodium: per100.sodium * factor
  }
}

export async function aggregateRecipeNutrition(inputs: IngredientInput[], servings = 1): Promise<RecipeNutritionResult> {
  const total = zero()
  const perIngredientResults: Array<{ input: IngredientInput; nutrients: AggregatedNutrients | null }> = []
  let uncertain = false

  for (const ing of inputs) {
    const data = await getNutrition(ing.canonicalName)
    if (!data || !data.per100g) {
      // missing provider data — treat as zero but mark uncertain
      perIngredientResults.push({ input: ing, nutrients: null })
      uncertain = true
      continue
    }

    const nutrients = scalePer100(data.per100g, ing.grams)
    perIngredientResults.push({ input: ing, nutrients })
    // if grams are estimated, mark uncertain
    if (ing.estimated) uncertain = true
    // add to total
    const newTotal = add(total, nutrients)
    Object.assign(total, newTotal)
  }

  // round totals to 2 decimals for presentation
  const roundedTotal = {
    calories: Math.round(total.calories * 100) / 100,
    protein: Math.round(total.protein * 100) / 100,
    carbs: Math.round(total.carbs * 100) / 100,
    fat: Math.round(total.fat * 100) / 100,
    sugar: Math.round(total.sugar * 100) / 100,
    fiber: Math.round(total.fiber * 100) / 100,
    sodium: Math.round(total.sodium * 100) / 100
  }

  const perServing = servings > 0 ? {
    calories: Math.round((total.calories * 100) / servings) / 100,
    protein: Math.round((total.protein * 100) / servings) / 100,
    carbs: Math.round((total.carbs * 100) / servings) / 100,
    fat: Math.round((total.fat * 100) / servings) / 100,
    sugar: Math.round((total.sugar * 100) / servings) / 100,
    fiber: Math.round((total.fiber * 100) / servings) / 100,
    sodium: Math.round((total.sodium * 100) / servings) / 100
  } : zero()

  return { totalNutrients: roundedTotal, perServingNutrients: perServing, uncertain, perIngredient: perIngredientResults }
}

export default { aggregateRecipeNutrition }
