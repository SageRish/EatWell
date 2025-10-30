import { parseIngredient } from './parseIngredient'

type CanonicalizeResult = {
  canonicalName: string
  rewriterPrompt: string
}

const BRAND_PATTERNS = [
  /amul\b/i,
  /kraft\b/i,
  /hellmann'?s\b/i,
  /heinz\b/i,
  /bestfoods\b/i,
  /mccain\b/i,
]

const REMOVE_WORDS = [
  'organic', 'chopped', 'minced', /* 'diced' kept because it can be meaningful */ 'grated', 'large', 'small', 'medium',
  'to taste', 'for garnish', 'optional', 'peeled', 'seeded', 'softened', 'room temperature', 'drained', 'slice', 'slices'
]

function stripBrandAndModifiers(name: string): string {
  let s = name.toLowerCase()
  // remove brand words
  for (const re of BRAND_PATTERNS) s = s.replace(re, '')
  // remove words like '(brand)' or parentheticals that are non-essential
  s = s.replace(/\([^)]*\)/g, '')
  // remove modifier words
  for (const w of REMOVE_WORDS) {
    const re = new RegExp('\\b' + w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'gi')
    s = s.replace(re, '')
  }
  // collapse spaces and punctuation
  s = s.replace(/[^a-z0-9\s\-]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function titleCase(s: string) {
  return s.split(' ').map(w => w ? w[0].toLowerCase() === w[0] ? w : w : w).join(' ')
}

export function canonicalizeIngredient(line: string): CanonicalizeResult {
  // use parser to remove quantity and unit
  const parsed = parseIngredient(line || '')
  const rawName = parsed.ingredientName || line || ''
  const stripped = stripBrandAndModifiers(rawName)

  // heuristics for classification tags
  let tag = ''
  if (/butter|margarine|ghee/.test(stripped)) tag = ' (dairy)'
  else if (/cheese|cheddar|parmesan|mozzarella|brie/.test(stripped)) tag = ' (dairy)'
  else if (/ketchup|mustard|mayonnaise|relish|sauce|salsa/.test(stripped)) tag = ' (condiment)'
  else if (/rice/.test(stripped)) tag = ''

  const canonicalName = (stripped + tag).trim()

  // Build prompt for rewriter API with examples
  const examples = [
    ['Amul butter', 'butter (dairy)'],
    ['Kraft cheddar cheese', 'cheddar cheese (dairy)'],
    ['Heinz tomato ketchup', 'ketchup (condiment)'],
    ['organic brown rice', 'brown rice'],
    ['unsalted butter', 'butter (dairy)'],
    ['chopped fresh parsley', 'parsley']
  ]

  const rewriterPrompt = `You are a canonicalization assistant. Given an ingredient phrase, return a short canonical ingredient name suitable for normalization and grouping. Remove brand names, marketing words (organic), size/format hints (large, sliced), and preserve the food name. Use tags for broad categories when helpful (example: "butter (dairy)"). Examples:\n${examples.map(e => `- "${e[0]}" => "${e[1]}"`).join('\n')}\n\nNow canonicalize the original line: "${line}" (original) and the parsed name: "${rawName}" =>`;

  return { canonicalName, rewriterPrompt }
}

export default canonicalizeIngredient
