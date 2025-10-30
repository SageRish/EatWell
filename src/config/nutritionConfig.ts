export type NutritionConfig = {
  provider: 'mock' | 'usda'
  usdaApiKey?: string
}

const config: NutritionConfig = {
  provider: (process.env.NUTRITION_PROVIDER as any) || (process.env.NODE_ENV === 'test' ? 'mock' : 'mock'),
  // Do NOT embed provider keys in source. The runtime should obtain the API key from user-supplied
  // preferences (chrome.storage) or from a secure server-side proxy. Keep fallback undefined.
  usdaApiKey: process.env.USDA_API_KEY || process.env.NUTRITION_USDA_API_KEY || undefined
}

export default config
