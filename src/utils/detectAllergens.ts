export type AllergenMatch = {
  ingredient: string
  allergen: string
  confidence: number // 0-100
  reason: string
}

export type AllergenResult = {
  matches: AllergenMatch[]
  safe: boolean
}

export type PromptResponseLike = {
  prompt?: string
  // a function that emulates session.prompt(text, opts)
  promptFn?: (prompt: string, opts?: any) => Promise<string>
}

/**
 * Build a Prompt API-ready prompt asking the model to detect allergens.
 * Includes examples and an explicit JSON output schema.
 */
export function buildAllergenPrompt(canonicalIngredients: string[], userAllergens: string[]): string {
  const examples = [
    {
      ingredients: ['butter (dairy)', 'wheat flour', 'almond milk'],
      allergies: ['nuts', 'dairy'],
      output: {
        matches: [
          { ingredient: 'butter (dairy)', allergen: 'dairy', confidence: 95, reason: 'explicit dairy product' },
          { ingredient: 'almond milk', allergen: 'nuts', confidence: 98, reason: 'almond is a tree nut' }
        ],
        safe: false
      }
    },
    {
      ingredients: ['brown rice', 'olive oil', 'salt'],
      allergies: ['gluten'],
      output: { matches: [], safe: true }
    },
    // additional exhaustive examples for common allergens
    {
      ingredients: ['peanut butter', 'soy sauce', 'sesame oil', 'egg yolk', 'mustard seeds', 'lupin flour', 'shrimp'],
      allergies: ['peanut', 'soy', 'sesame', 'egg', 'mustard', 'lupin', 'shellfish'],
      output: {
        matches: [
          { ingredient: 'peanut butter', allergen: 'peanut', confidence: 99, reason: 'contains peanuts' },
          { ingredient: 'soy sauce', allergen: 'soy', confidence: 95, reason: 'soy-based condiment' },
          { ingredient: 'sesame oil', allergen: 'sesame', confidence: 95, reason: 'derived from sesame seeds' },
          { ingredient: 'egg yolk', allergen: 'egg', confidence: 98, reason: 'egg product' },
          { ingredient: 'mustard seeds', allergen: 'mustard', confidence: 99, reason: 'mustard seed' },
          { ingredient: 'lupin flour', allergen: 'lupin', confidence: 99, reason: 'lupin bean product' },
          { ingredient: 'shrimp', allergen: 'shellfish', confidence: 99, reason: 'crustacean' }
        ],
        safe: false
      }
    }
  ]

  const schemaObj = {
    type: 'object',
    properties: {
      matches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ingredient: { type: 'string' },
            allergen: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
            reason: { type: 'string' }
          },
          required: ['ingredient', 'allergen', 'confidence', 'reason']
        }
      },
      safe: { type: 'boolean' }
    },
    required: ['matches', 'safe']
  }

  const schema = JSON.stringify(schemaObj)

  const prompt = `You are an allergen detection assistant. Given a list of canonical ingredient names and a user's allergy profile (list of allergen categories and specific allergens), identify which ingredients are likely to match the user's allergies. Use conservative, evidence-based reasoning and include a numeric confidence (0-100) and a short reason for each match.\n\nReturn a single JSON object with the described schema.\n\nInclude these example mappings (ingredient -> allergen): peanut -> peanut, almond/almond milk -> tree nut, wheat/flour -> gluten, milk/butter/cheese -> dairy, soy/soy sauce -> soy, shrimp/crab/lobster -> shellfish, egg/egg yolk -> egg, sesame/sesame oil -> sesame, mustard/mustard seeds -> mustard, lupin/lupin flour -> lupin.\n\nProvide the output as JSON that matches this schema:\n${schema}\n\nExamples:\n${examples.map(e => `Ingredients: ${JSON.stringify(e.ingredients)}\nAllergies: ${JSON.stringify(e.allergies)}\nOutput: ${JSON.stringify(e.output)}`).join('\n---\n')}\n---\nNow analyze the following input:\nIngredients: ${JSON.stringify(canonicalIngredients)}\nAllergies: ${JSON.stringify(userAllergens)}\nProvide the JSON output only.`

  return prompt
}

/**
 * detectAllergens: constructs prompt and calls injected promptFn (or returns prompt for inspection).
 * If promptFn provided, it will call and parse the JSON result into AllergenResult.
 */
export async function detectAllergens(
  canonicalIngredients: string[],
  userAllergens: string[],
  opts?: PromptResponseLike
): Promise<{ prompt: string; result?: AllergenResult }>
{
  const prompt = buildAllergenPrompt(canonicalIngredients, userAllergens)
  if (!opts || !opts.promptFn) return { prompt }

  // use responseConstraint JSON Schema when calling the Prompt API / mock
  const responseConstraint = {
    type: 'object',
    properties: {
      matches: {
        type: 'array'
      },
      safe: { type: 'boolean' }
    }
  }

  const raw = await opts.promptFn(prompt, { responseConstraint }).catch(err => { throw err })

  // try to parse JSON from raw response
  let parsed: any = null
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    // try to extract first JSON object in text
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) {
      try { parsed = JSON.parse(m[0]) } catch (_) { parsed = null }
    }
  }

  if (!parsed) throw new Error('Unable to parse JSON from model response')

  // basic validation and normalization
  const matches: AllergenMatch[] = Array.isArray(parsed.matches) ? parsed.matches.map((m: any) => ({
    ingredient: String(m.ingredient),
    allergen: String(m.allergen),
    confidence: typeof m.confidence === 'number' ? m.confidence : Number(m.confidence) || 0,
    reason: String(m.reason || '')
  })) : []

  const safe = !!parsed.safe

  return { prompt, result: { matches, safe } }
}

export default detectAllergens
