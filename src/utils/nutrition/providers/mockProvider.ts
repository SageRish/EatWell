import { NutritionResult } from '../types'

const MOCK_DB: Record<string, NutritionResult['per100g']> = {
  'peanut': { calories: 567, protein: 25.8, carbs: 16.1, fat: 49.2, sugar: 4.7, fiber: 8.5, sodium: 18 },
  'peanut butter': { calories: 588, protein: 25, carbs: 20, fat: 50, sugar: 10, fiber: 6, sodium: 400 },
  'wheat flour': { calories: 364, protein: 10.3, carbs: 76.3, fat: 1, sugar: 0.3, fiber: 2.7, sodium: 2 },
  'soy sauce': { calories: 53, protein: 8, carbs: 4.9, fat: 0.6, sugar: 0.4, fiber: 0, sodium: 5630 / 100 }
}

export async function lookupMock(canonicalName: string) : Promise<NutritionResult> {
  const key = canonicalName.trim().toLowerCase()
  const per100g = MOCK_DB[key]
  if (!per100g) return { per100g: null as any, forQuantity: null as any }

  return {
    per100g,
    forQuantity: per100g // caller will scale if needed; wrapper will adjust
  }
}

export default { lookupMock }
