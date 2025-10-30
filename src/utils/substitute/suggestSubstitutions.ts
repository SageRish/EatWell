import { getAllergenForIngredient } from '../allergenOntology'

export type ImpactEstimate = {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export type Suggestion = {
  suggestion: string
  substitutionRatio: number // suggested amount relative to original (e.g., 1.0 means 1:1)
  impactEstimate: ImpactEstimate
  reason: string
}

export type SuggestParams = {
  ingredient: string
  goal: 'remove allergen' | 'reduce calories' | 'make vegan' | 'preserve flavor'
  userAllergens?: string[]
  cuisineContext?: string
}

export type PromptOptions = {
  promptFn?: (prompt: string, opts?: any) => Promise<string>
}

export function buildSubstitutionPrompt(params: SuggestParams): string {
  const { ingredient, goal, userAllergens = [], cuisineContext } = params

  const schema = {
    type: 'array',
    minItems: 3,
    maxItems: 3,
    items: {
      type: 'object',
      properties: {
        suggestion: { type: 'string' },
        substitutionRatio: { type: 'number' },
        impactEstimate: {
          type: 'object',
          properties: {
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fat: { type: 'number' }
          }
        },
        reason: { type: 'string' }
      },
      required: ['suggestion', 'substitutionRatio', 'impactEstimate', 'reason']
    }
  }

  const avoid = userAllergens.length ? `Do NOT suggest ingredients that contain or are derived from these allergens: ${JSON.stringify(userAllergens)}.` : ''

  const examples = `Examples:\n1) Ingredient: 'regular milk', goal: 'make vegan' -> Suggestion: 'unsweetened soy milk', substitutionRatio: 1.0, impactEstimate: {calories: 33, protein: 3.3, carbs: 0.4, fat: 1.6}, reason: 'soy milk matches protein and mouthfeel'`

  const prompt = `You are an expert culinary assistant. Provide exactly 3 alternative ingredient suggestions to satisfy the user's goal. Return a JSON array (3 items) that matches this JSON Schema:\n${JSON.stringify(schema)}\n\n${avoid}\n\nContext: ingredient=${JSON.stringify(ingredient)}, goal=${JSON.stringify(goal)}${cuisineContext ? `, cuisine=${JSON.stringify(cuisineContext)}` : ''}.\n\n${examples}\n\nReturn JSON only.`

  return prompt
}

export async function suggestSubstitutions(params: SuggestParams, opts: PromptOptions = {}): Promise<Suggestion[]> {
  const prompt = buildSubstitutionPrompt(params)
  const promptFn = opts.promptFn
  if (!promptFn) throw new Error('promptFn is required in options for suggestSubstitutions')

  // Also compute allergen-safe checks using ontology to pre-filter suggestions in downstream logic or prompts
  const ingredientAllergens = getAllergenForIngredient(params.ingredient)

  const raw = await promptFn(prompt, { responseConstraint: { type: 'array' } })
  // model may return JSON string; parse
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    // If the model returns text with code fences, try to extract JSON
    const m = raw.match(/```(?:json)?([\s\S]*)```/i)
    if (m) parsed = JSON.parse(m[1].trim())
    else throw err
  }

  // Basic validation and post-filter to ensure none of the suggestions use user's allergens
  const userAllergens = params.userAllergens || []
  const results: Suggestion[] = []
  for (const item of parsed as any[]) {
    const suggestion = item.suggestion
    const suggestionAllergens = getAllergenForIngredient(suggestion)
    const conflicts = suggestionAllergens.filter(a => userAllergens.includes(a))
    if (conflicts.length) {
      // skip suggestions that conflict
      continue
    }
    results.push({
      suggestion: item.suggestion,
      substitutionRatio: item.substitutionRatio,
      impactEstimate: item.impactEstimate,
      reason: item.reason
    })
  }

  // If filtering removed some, and we have fewer than 3, return whatever we have (caller can re-run with different params)
  return results.slice(0, 3)
}

export default { buildSubstitutionPrompt, suggestSubstitutions }
