import { getAllergenForIngredient } from './allergenOntology'

export type ModelMatch = {
  ingredient: string
  allergen: string
  confidence: number // 0-100
  reason?: string
}

export type Alert = {
  ingredient: string
  allergen: string
  source: 'ontology' | 'model' | 'both'
  confidence: number
  reason?: string
}

export type DecisionResult = {
  alerts: Alert[]
  overallSafety: 'safe' | 'warning' | 'unsafe'
}

const ONTOLOGY_CONF = 95

function normalize(s: string): string {
  return (s || '').trim().toLowerCase()
}

/**
 * Combine ontology and model detections into deterministic alerts.
 * - Prefer ontology matches for high precision (assign high confidence)
 * - Use model matches for ambiguous cases
 */
export function decideAllergens(canonicalIngredients: string[], modelMatches: ModelMatch[] = [], region?: string): DecisionResult {
  const alerts: Alert[] = []

  const modelIndex = new Map<string, ModelMatch[]>()
  for (const m of modelMatches) {
    const key = normalize(m.ingredient)
    const arr = modelIndex.get(key) || []
    arr.push(m)
    modelIndex.set(key, arr)
  }

  for (const ingredient of canonicalIngredients) {
    const ingNorm = normalize(ingredient)
    const ontologyCats = getAllergenForIngredient(ingredient, region)
    const models = modelIndex.get(ingNorm) || []

    if (ontologyCats.length) {
      for (const cat of ontologyCats) {
        const matchingModel = models.find(m => normalize(m.allergen) === normalize(cat))
        if (matchingModel) {
          // both
          const conf = Math.min(100, Math.max(ONTOLOGY_CONF, Math.round((ONTOLOGY_CONF + matchingModel.confidence) / 2)))
          alerts.push({ ingredient, allergen: cat, source: 'both', confidence: conf, reason: matchingModel.reason })
        } else {
          alerts.push({ ingredient, allergen: cat, source: 'ontology', confidence: ONTOLOGY_CONF, reason: 'ontology match' })
        }
      }
    } else if (models.length) {
      for (const m of models) {
        // model-only
        const conf = Math.max(0, Math.min(100, Math.round(m.confidence)))
        alerts.push({ ingredient: m.ingredient, allergen: m.allergen, source: 'model', confidence: conf, reason: m.reason })
      }
    }
  }

  // determine overallSafety
  let overall: DecisionResult['overallSafety'] = 'safe'
  if (alerts.some(a => a.source === 'ontology')) {
    overall = 'unsafe'
  } else if (alerts.some(a => a.confidence >= 90)) {
    overall = 'unsafe'
  } else if (alerts.some(a => a.confidence >= 60)) {
    overall = 'warning'
  }

  return { alerts, overallSafety: overall }
}

export default { decideAllergens }
