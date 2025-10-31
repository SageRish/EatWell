/**
 * Lightweight wrapper for the Chrome Summarizer API.
 * Attempts to create a Summarizer and produce a short 3-line summary describing
 * serving size, expected time, and an appetizing taste description.
 * Falls back to a local heuristic if the API isn't available.
 */
export async function summarizeRecipe(recipe: any): Promise<string[]> {
  try {
    const Summarizer = (window as any).Summarizer
    if (!Summarizer) {
      return fallbackSummary(recipe)
    }

    const availability = await Summarizer.availability()
    if (availability === 'unavailable') return fallbackSummary(recipe)

    // create summarizer configured to return a few concise key points
    const options: any = {
      sharedContext: 'Produce three short key points for a recipe: serving size, expected total time, and expected taste in an appetizing manner.',
      type: 'key-points',
      format: 'plain-text',
      length: 'short'
    }

    const summarizer = await Summarizer.create(options)

    // Build the input text: include yield/servings, ingredient list and first few instructions
    const parts: string[] = []
    if (recipe.title) parts.push(recipe.title)
    if (recipe.servings || recipe.recipeYield) parts.push(`Yield: ${recipe.servings || recipe.recipeYield}`)
    if (Array.isArray(recipe.ingredientsRaw) && recipe.ingredientsRaw.length) {
      parts.push('Ingredients: ' + recipe.ingredientsRaw.slice(0, 15).join('; '))
    }
    if (Array.isArray(recipe.instructionsRaw) && recipe.instructionsRaw.length) {
      parts.push('Instructions: ' + recipe.instructionsRaw.slice(0, 6).join(' | '))
    }
    const text = parts.join('\n')

    const summary = await summarizer.summarize(text, {
      context: 'Return three concise lines: 1) serving size (how many servings), 2) expected total time to make, 3) expected taste in an appetizing manner.'
    })

    // summarizer.summarize may return a single string with line breaks or bullets.
    // Normalize to an array of short lines.
    if (!summary) return fallbackSummary(recipe)
    const lines = String(summary).split(/\r?\n|\u2022|\t|\u2023/).map((l) => l.trim()).filter(Boolean)
    // limit to 3
    return lines.slice(0, 3)
  } catch {
    // any error -> fallback
    return fallbackSummary(recipe)
  }
}

function fallbackSummary(recipe: any): string[] {
  const out: string[] = []
  // Serving
  const serving = recipe?.servings || recipe?.recipeYield || recipe?.yield
  if (serving) out.push(`Serves ${serving}`)
  else out.push('Serves 2-4 (estimate)')

  // Time
  const time = recipe?.totalTime || recipe?.cookTime || recipe?.prepTime
  if (time) out.push(`Takes about ${time}`)
  else out.push('Takes about 30–45 minutes')

  // Taste: simple heuristic by ingredient keywords
  const ingredients: string[] = Array.isArray(recipe?.ingredientsRaw) ? recipe.ingredientsRaw : []
  const text = ingredients.join(' ').toLowerCase()
  let taste = 'delicious and satisfying'
  if (/sugar|honey|maple|sweet|chocolate|brown sugar/.test(text)) taste = 'sweet and comforting'
  else if (/lemon|vinegar|lime|citrus/.test(text)) taste = 'bright and tangy'
  else if (/garlic|onion|pepper|chili|paprika|cumin/.test(text)) taste = 'savory and aromatic'
  else if (/cinnamon|nutmeg|clove|cardamom/.test(text)) taste = 'warm and spiced'

  out.push(`Flavour: ${taste}.`)
  return out
}

export default { summarizeRecipe }
