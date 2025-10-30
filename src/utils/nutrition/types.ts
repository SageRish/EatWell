export type Per100g = {
  calories: number
  protein: number
  carbs: number
  fat: number
  sugar: number
  fiber: number
  sodium: number
}

export type NutritionResult = {
  per100g: Per100g
  forQuantity: Per100g
}
