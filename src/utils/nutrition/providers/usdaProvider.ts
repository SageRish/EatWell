import { NutritionResult, Per100g } from '../types'
import config from '../../../config/nutritionConfig'

async function fetchFoodByName(name: string): Promise<any | null> {
  // USDA FoodData Central search endpoint
  const apiKey = config.usdaApiKey
  if (!apiKey) return null
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(name)}&pageSize=1`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  // pick first result
  if (json.foods && json.foods.length) return json.foods[0]
  return null
}

function extractPer100gFromFdc(food: any): Per100g {
  // USDA provides nutrients with nutrientNumber and amount per 100g or per serving depending on data type.
  const defaultVal = { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 }
  if (!food || !food.foodNutrients) return defaultVal
  const map: Record<string, number> = {}
  for (const n of food.foodNutrients) {
    const name = (n.nutrient && (n.nutrient.name || n.nutrient)) || n.name || n.nutrientName
    const amt = n.amount || n.value || 0
    if (!name) continue
    map[name.toLowerCase()] = amt
  }

  // heuristics to pick values
  const calories = map['energy'] || map['energy (kcal)'] || map['calories'] || 0
  const protein = map['protein'] || 0
  const fat = map['total lipid (fat)'] || map['fat'] || 0
  const carbs = map['carbohydrate, by difference'] || map['carbohydrate'] || map['carbs'] || 0
  const sugar = map['sugars, total'] || map['sugar'] || 0
  const fiber = map['fiber, total dietary'] || map['dietary fiber'] || map['fiber'] || 0
  const sodium = map['sodium'] || 0

  return { calories, protein, carbs, fat, sugar, fiber, sodium }
}

export async function lookupUsda(canonicalName: string): Promise<NutritionResult | null> {
  const food = await fetchFoodByName(canonicalName)
  if (!food) return null
  const per100g = extractPer100gFromFdc(food)
  return { per100g, forQuantity: per100g }
}

export default { lookupUsda }
