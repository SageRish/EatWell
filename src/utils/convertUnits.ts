export type ParsedIngredient = {
  quantity: number | string | null
  unit: string | null
  ingredientName: string
}

export type ConversionResult = {
  grams?: number
  milliliters?: number
  note?: string
  uncertain?: boolean
}

const ML_PER_TSP = 4.92892
const ML_PER_TBSP = 14.7868
const ML_PER_CUP = 240

const OZ_TO_G = 28.349523125
const LB_TO_G = 453.59237

// sensible default densities (g per ml)
const DEFAULT_DENSITIES: Record<string, number> = {
  water: 1.0,
  sugar: 0.85, // granulated
  flour: 0.53, // all-purpose, scooped
  butter: 0.95,
  'rice-uncooked': 0.77,
  'rice-cooked': 0.66,
}

function findDensity(ingredientName: string, densityMap?: Record<string, number>): number | undefined {
  const name = ingredientName.toLowerCase()
  // user provided map has precedence
  if (densityMap) {
    // exact key match
    for (const k of Object.keys(densityMap)) {
      if (k.toLowerCase() === name) return densityMap[k]
    }
    // contains match
    for (const k of Object.keys(densityMap)) {
      if (name.includes(k.toLowerCase())) return densityMap[k]
    }
  }

  // default heuristics
  if (name.includes('water')) return DEFAULT_DENSITIES.water
  if (name.includes('sugar')) return DEFAULT_DENSITIES.sugar
  if (name.includes('flour')) return DEFAULT_DENSITIES.flour
  if (name.includes('butter')) return DEFAULT_DENSITIES.butter
  if (name.includes('rice')) {
    if (name.includes('cook') || name.includes('cooked')) return DEFAULT_DENSITIES['rice-cooked']
    return DEFAULT_DENSITIES['rice-uncooked']
  }
  return undefined
}

export function convertUnits(input: ParsedIngredient, densityMap?: Record<string, number>): ConversionResult {
  const qtyRaw = input.quantity
  let qtyNum: number | null = null
  const noteParts: string[] = []

  if (typeof qtyRaw === 'number') qtyNum = qtyRaw
  else if (typeof qtyRaw === 'string') {
    // range like '2-3'
    const m = qtyRaw.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
    if (m) {
      const a = parseFloat(m[1])
      const b = parseFloat(m[2])
      qtyNum = (a + b) / 2
      noteParts.push('used average for range')
    } else {
      // can't parse
      qtyNum = null
    }
  }

  const unit = input.unit
  const name = input.ingredientName || ''

  const result: ConversionResult = {}

  // direct weight units
  if (unit === 'g' && qtyNum != null) {
    result.grams = Math.round(qtyNum)
    return result
  }
  if (unit === 'kg' && qtyNum != null) {
    result.grams = Math.round(qtyNum * 1000)
    return result
  }
  if ((unit === 'oz' || unit === 'g') && qtyNum != null) {
    // we generally normalize oz elsewhere, but handle defensively
    result.grams = Math.round(qtyNum * OZ_TO_G)
    return result
  }
  if ((unit === 'l' || unit === 'ml') && qtyNum != null) {
    const ml = unit === 'l' ? qtyNum * 1000 : qtyNum
    result.milliliters = Math.round(ml * 1000) / 1000
    // try convert to grams via density
    const dens = findDensity(name, densityMap)
    if (dens != null) {
      result.grams = Math.round(ml * dens)
      return result
    }
    result.uncertain = true
    result.note = 'density unknown; returned milliliters only'
    return result
  }

  // volume units to ml
  let ml: number | null = null
  if (unit === 'tsp' && qtyNum != null) ml = qtyNum * ML_PER_TSP
  if (unit === 'tbsp' && qtyNum != null) ml = qtyNum * ML_PER_TBSP
  if (unit === 'cup' && qtyNum != null) ml = qtyNum * ML_PER_CUP

  if (ml != null) {
    result.milliliters = Math.round(ml * 1000) / 1000
    const dens = findDensity(name, densityMap)
    if (dens != null) {
      result.grams = Math.round(ml * dens)
      return result
    }
    result.uncertain = true
    result.note = 'density unknown; returned milliliters only'
    return result
  }

  // piece/slice/pinch: attempt heuristics
  if ((unit === 'piece' || unit === 'slice' || unit === 'pinch') && qtyNum != null) {
    // check densityMap for per-piece weight keyed by 'perPiece:ingredient' or similar
    const dens = findDensity(name, densityMap)
    if (dens != null) {
      // can't convert piece->grams without volume; but if user provided density as g per piece (detect by key)
      // if densityMap provided an absolute grams-per-unit value via key like 'egg' -> grams per piece
      // we detect if densityMap has exact match for full name
      if (densityMap) {
        const exact = densityMap[name.toLowerCase()]
        if (typeof exact === 'number') {
          result.grams = Math.round(qtyNum * exact)
          return result
        }
      }
    }
    // fallback: unknown per-piece mass
    result.uncertain = true
    result.note = 'per-piece weight unknown; cannot convert to grams'
    return result
  }

  // fallback: if unit is null and quantity present, try to interpret ingredient as volume by keywords
  if (!unit && qtyNum != null) {
    // treat as 'pieces' for eggs or countable items
    if (/egg|eggs|clove|cloves|can|cans|package|packages|slice|slices/i.test(name)) {
      result.uncertain = true
      result.note = 'countable item; per-piece weight unknown'
      return result
    }
  }

  // fallback: unknown
  result.uncertain = true
  result.note = 'unable to convert; missing unit or density'
  return result
}

export default convertUnits
