import fs from 'fs'
import path from 'path'

type Ontology = {
  version?: string
  description?: string
  categories: Record<string, { id: string; labels: string[] }>
  ingredientMap: Record<string, string>
}

type RegionSynonyms = {
  region: string
  synonyms: Record<string, string[]>
}

function readJson<T>(p: string): T | null {
  try {
    const raw = fs.readFileSync(p, 'utf8')
    return JSON.parse(raw) as T
  } catch (err) {
    return null
  }
}

const DATA_DIR = path.join(__dirname, '..', 'data')
const ONTO_PATH = path.join(DATA_DIR, 'allergenOntology.json')
const ONTO_US_PATH = path.join(DATA_DIR, 'allergenOntology_us.json')

const ontology: Ontology | null = readJson<Ontology>(ONTO_PATH)
const regionUS: RegionSynonyms | null = readJson<RegionSynonyms>(ONTO_US_PATH)

function normalizeInput(s: string): string {
  return s.trim().toLowerCase().replace(/[\u2013\u2014–—]/g, '-')
}

export function getAllergenForIngredient(ingredientRaw: string, region?: string): string[] {
  const ing = normalizeInput(ingredientRaw)
  const matches = new Set<string>()
  if (!ontology) return []

  // direct ingredient map lookup
  if (ontology.ingredientMap[ing]) {
    matches.add(ontology.ingredientMap[ing])
  }

  // try splitting tokens and matching labels
  const tokens = ing.split(/[^a-z0-9]+/).filter(Boolean)
  for (const token of tokens) {
    // exact ingredientMap token
    if (ontology.ingredientMap[token]) matches.add(ontology.ingredientMap[token])
    // category label match
    for (const [cat, info] of Object.entries(ontology.categories)) {
      if (info.labels.includes(token)) matches.add(cat)
    }
  }

  // region-specific synonyms
  if (region && region.toLowerCase() === 'us' && regionUS) {
    for (const [canon, syns] of Object.entries(regionUS.synonyms)) {
      for (const s of syns) {
        if (normalizeInput(s) === ing) {
          // find mapping from canonical to category if available
          if (ontology.ingredientMap[canon]) matches.add(ontology.ingredientMap[canon])
        }
      }
    }
  }

  return Array.from(matches)
}

export function getPrimaryAllergen(ingredientRaw: string, region?: string): string | null {
  const all = getAllergenForIngredient(ingredientRaw, region)
  return all.length ? all[0] : null
}

export function isAllergenIn(ingredientRaw: string, allergenCategory: string, region?: string): boolean {
  const all = getAllergenForIngredient(ingredientRaw, region)
  return all.includes(allergenCategory)
}

export default {
  getAllergenForIngredient,
  getPrimaryAllergen,
  isAllergenIn
}
