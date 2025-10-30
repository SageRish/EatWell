// parseIngredient.ts
// Parse a normalized ingredient line into { quantity, unit, ingredientName }
// - quantity: number | string | null (number for parseable numeric values, string for ranges like '2-3')
// - unit: canonical unit from [g, kg, ml, l, tsp, tbsp, cup, piece, slice, pinch] or null
// - ingredientName: remaining text

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

const UNIT_SYNONYMS: Array<[RegExp, string]> = [
  [/^(grams?|g)\b/i, 'g'],
  [/^(kilograms?|kg)\b/i, 'kg'],
  [/^(milliliters?|ml)\b/i, 'ml'],
  [/^(liters?|litres?|l)\b/i, 'l'],
  [/^(teaspoons?|tsp)\b/i, 'tsp'],
  [/^(tablespoons?|tbsp|T)\b/i, 'tbsp'],
  [/^(cups?)\b/i, 'cup'],
  [/^(pinch|pinches)\b/i, 'pinch'],
  [/^(slice|slices)\b/i, 'slice'],
  [/^(can|cans|package|packages|pkg|pkgs|jar|jars|tin|tins)\b/i, 'piece'],
  [/^(clove|cloves)\b/i, 'piece'],
  [/^(piece|pieces)\b/i, 'piece'],
  [/^(oz|ounce|ounces)\b/i, 'g'], // will convert to grams
  [/^(lb|pound|pounds)\b/i, 'g'], // convert to grams
]

// conversion helpers
const OZ_TO_G = 28.349523125
const LB_TO_G = 453.59237

function parseUnicodeFractionToken(token: string): number | null {
  // tokens like '½' or appended like '3¼'
  // if token contains digit + unicode fraction (e.g., '3¼'), split
  const m = token.match(/^(\d+)([\u00BC-\u00BE\u2150-\u215E\u00BD\u2153-\u215E])$/u)
  if (m) {
    const whole = parseInt(m[1], 10)
    const fracChar = m[2]
    const frac = UNICODE_FRACTIONS[fracChar]
    if (typeof frac === 'number') return whole + frac
  }
  // whole token is single unicode fraction
  if (token.length === 1 && UNICODE_FRACTIONS[token]) return UNICODE_FRACTIONS[token]
  return null
}

function parseSimpleFraction(str: string): number | null {
  // str could be '1/2' or '1 1/2' or '1-2' (we won't parse ranges here)
  str = str.trim()
  // mixed: '1 1/2'
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) {
    const whole = parseInt(mixed[1], 10)
    const num = parseInt(mixed[2], 10)
    const den = parseInt(mixed[3], 10)
    if (den !== 0) return whole + num / den
    return null
  }
  // fraction '1/2'
  const frac = str.match(/^(\d+)\/(\d+)$/)
  if (frac) {
    const num = parseInt(frac[1], 10)
    const den = parseInt(frac[2], 10)
    if (den !== 0) return num / den
    return null
  }
  // decimal or integer
  if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str)
  return null
}

function parseQuantityToken(token: string): number | string | null {
  if (!token) return null
  token = token.trim()
  // ranges like '2-3' or '500-600'
  if (/^\d+\s*-\s*\d+$/.test(token)) return token.replace(/\s+/g, '')
  // word number
  const word = token.toLowerCase()
  if (WORD_NUMBERS[word]) return WORD_NUMBERS[word]
  if (word === 'a' || word === 'an') return 1
  // unicode fraction '½' or mixed '3¼'
  const u = parseUnicodeFractionToken(token)
  if (u !== null) return u
  // mixed e.g., '1 1/2' handled by parseSimpleFraction when token includes space
  const s = parseSimpleFraction(token)
  if (s !== null) return s
  // try to extract leading numeric part if token like '3¼cups' (unlikely)
  const lead = token.match(/^(\d+(?:\.\d+)?)/)
  if (lead) return parseFloat(lead[1])
  return null
}

export type ParsedIngredient = {
  quantity: number | string | null
  unit: string | null
  ingredientName: string
}

export function parseIngredient(line: string): ParsedIngredient {
  if (!line) return { quantity: null, unit: null, ingredientName: '' }
  let s = line.trim()
  // collapse multiple whitespace and newlines
  s = s.replace(/\s+/g, ' ')

  // remove leading 'of' if present after qty/unit
  // extract first token (quantity candidate)
  const parts = s.split(' ')
  let quantity: number | string | null = null
  let unit: string | null = null
  let idx = 0

  // check first token for quantity patterns including '1', '1/2', '½', '1-2', 'a', 'one', '3¼'
  const first = parts[0]
  const q1 = parseQuantityToken(first)
  if (q1 !== null) {
    quantity = q1
    idx = 1
    // if first token is an integer and the second token is a fraction, combine into mixed fraction
    if (typeof q1 === 'number' && parts.length > 1) {
      const sec = parts[1]
      const frac = parseSimpleFraction(sec) ?? parseUnicodeFractionToken(sec)
      if (typeof frac === 'number') {
        quantity = q1 + frac
        idx = 2
      }
    }
    // handle tokens like '250ml' where number and unit are attached
    const attached = first.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/)
    if (attached) {
      // we already set quantity from the leading number; try to map attached unit
      const unitToken = attached[2]
      for (const [re, canonical] of UNIT_SYNONYMS) {
        if (re.test(unitToken)) {
          unit = canonical
          // if the unit was oz or lb and we have a numeric quantity, convert
          if (/^(oz|ounce|ounces)$/i.test(unitToken) && typeof quantity === 'number') {
            quantity = Math.round(quantity * OZ_TO_G)
            unit = 'g'
          }
          if (/^(lb|pound|pounds)$/i.test(unitToken) && typeof quantity === 'number') {
            quantity = Math.round(quantity * LB_TO_G)
            unit = 'g'
          }
          break
        }
      }
    }
  } else {
    // if first token is like '1/2' combined with second token (rare)
    const maybeMixed = parts.slice(0, 2).join(' ')
    const q2 = parseQuantityToken(maybeMixed)
    if (q2 !== null) {
      quantity = q2
      idx = 2
    }
  }

  // next, try to detect a unit at current idx
  if (idx < parts.length) {
    const remaining = parts.slice(idx).join(' ')
    // try matching unit synonyms at start
    for (const [re, canonical] of UNIT_SYNONYMS) {
      const m = remaining.match(re)
      if (m) {
        unit = canonical
        // consume the matched token(s)
        const matched = m[0]
        // special conversions for oz/lb -> convert to grams
        if (/^(oz|ounce|ounces)$/i.test(matched) && quantity != null && typeof quantity === 'number') {
          quantity = Math.round(quantity * OZ_TO_G)
          unit = 'g'
        }
        if (/^(lb|pound|pounds)$/i.test(matched) && quantity != null && typeof quantity === 'number') {
          quantity = Math.round(quantity * LB_TO_G)
          unit = 'g'
        }
        // remove matched unit token from remaining
        const after = remaining.slice(matched.length).trim()
        // remove leading 'of' if present
        const cleanAfter = after.replace(/^of\s+/i, '')
        return { quantity, unit, ingredientName: cleanAfter }
      }
    }
  }

  // if no explicit unit recognized but quantity was found and the next token is a unit-like word (e.g., 'cups') we handled it above
  // fallback: if quantity is null and the line contains 'to taste' -> treat as no quantity and no unit
  if (/to taste/i.test(s)) {
    return { quantity: null, unit: null, ingredientName: s.replace(/,?\s*to taste/i, '').trim() }
  }

  // if no unit detected but quantity present and next word looks like ingredient, attempt to detect some implicit units
  // e.g., '3 cloves garlic' -> 'cloves' wasn't matched? it would match above. fallback to treat next token as part of ingredient
  const ingredientName = parts.slice(idx).join(' ').trim()

  // handle 'a pinch' or 'pinch' anywhere
  if (/\bpinch(es)?\b/i.test(s)) {
    // if quantity not provided, set to 1
    if (quantity === null) quantity = 1
    unit = 'pinch'
    const name = s.replace(/\bpinch(es)?\b/i, '').replace(/\bof\b/i, '').trim()
    return { quantity, unit, ingredientName: name }
  }

  // handle 'slice' and other implicit units inside string if not matched earlier
  for (const [re, canonical] of UNIT_SYNONYMS) {
    if (re.test(ingredientName)) {
      const after = ingredientName.replace(re, '').trim().replace(/^of\s+/i, '')
      return { quantity, unit: canonical === 'g' ? 'g' : canonical, ingredientName: after }
    }
  }

  // handle oz with no explicit unit detection (e.g., '3 oz cheddar') above should catch; fallback: if quantity is number and following token ends with 'g' or 'ml' etc
  const trailingUnitMatch = ingredientName.match(/^(\(?\d+\)?)(g|kg|ml|l)\b\s*(.*)/i)
  if (trailingUnitMatch) {
    // e.g., '1 (400g) diced tomatoes' -> we want to keep parenthetical and name; don't treat trailing g as unit for the overall quantity
    return { quantity, unit, ingredientName }
  }

  return { quantity, unit, ingredientName }
}

export default parseIngredient
