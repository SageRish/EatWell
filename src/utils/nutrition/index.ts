import config from '../../../src/config/nutritionConfig'
import { NutritionResult, Per100g } from './types'
import * as mock from './providers/mockProvider'
import * as usda from './providers/usdaProvider'
import privacy from '../privacy'

async function providerLookup(name: string): Promise<NutritionResult | null> {
  // If privacy mode is enabled, always prefer local mock provider
  if (privacy && privacy.isPrivacyMode && privacy.isPrivacyMode()) {
    return await mock.lookupMock(name)
  }
  if (config.provider === 'usda') {
    return await usda.lookupUsda(name)
  }
  return await mock.lookupMock(name)
}

function scalePer100g(per100g: Per100g, quantityInGrams?: number): Per100g {
  if (!quantityInGrams || quantityInGrams === 100) return per100g
  const factor = (quantityInGrams || 100) / 100
  return {
    calories: Math.round(per100g.calories * factor * 100) / 100,
    protein: Math.round(per100g.protein * factor * 100) / 100,
    carbs: Math.round(per100g.carbs * factor * 100) / 100,
    fat: Math.round(per100g.fat * factor * 100) / 100,
    sugar: Math.round(per100g.sugar * factor * 100) / 100,
    fiber: Math.round(per100g.fiber * factor * 100) / 100,
    sodium: Math.round(per100g.sodium * factor * 100) / 100
  }
}

export async function getNutrition(canonicalName: string, quantityInGrams?: number) {
  const data = await providerLookup(canonicalName)
  if (!data) return null
  const per100g = data.per100g
  const forQuantity = scalePer100g(per100g, quantityInGrams)
  return { per100g, forQuantity }
}

export default { getNutrition }
