export type NutritionConfig = {
  provider: 'mock' | 'usda'
  usdaApiKey?: string
}

const config: NutritionConfig = {
  provider: (process.env.NUTRITION_PROVIDER as any) || (process.env.NODE_ENV === 'test' ? 'mock' : 'mock'),
  usdaApiKey: process.env.USDA_API_KEY || process.env.NUTRITION_USDA_API_KEY || 'cCdOGaQqDr7uaulChfHiCQJU027cfQVy4sRgWezf'
}

export default config
