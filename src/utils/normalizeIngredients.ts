/**
 * Normalize raw ingredient lines into clean single-line strings.
 * - strips HTML tags
 * - collapses whitespace
 * - removes irrelevant parenthetical notes (eg. "for garnish", "optional", "to taste")
 * - preserves quantity/unit tokens and useful parentheticals containing numbers (eg. "(14 ounce)")
 */

const IRRELEVANT_PHRASES = [
  'for garnish',
  'for serving',
  'for garnish and serving',
  'to taste',
  'optional',
  'divided',
  'as needed',
  'if desired',
  'or more',
  'or less'
]

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

function removeIrrelevantParentheticals(s: string): string {
  // remove parentheses that contain irrelevant phrases
  return s.replace(/\(([^)]+)\)/g, (_match, inner) => {
    const lower = inner.toLowerCase()
    // if the parenthetical contains a numeric measure, keep it
    if (/\d/.test(inner)) return `(${inner})`
    for (const phrase of IRRELEVANT_PHRASES) {
      if (lower.includes(phrase)) return ''
    }
    // otherwise drop short single-word notes like (sifted) ??? keep? we will drop common irrelevant words only
    // preserve general parentheticals that are descriptive (e.g., (peeled)) — to be conservative, keep if length<50
    if (inner.length > 0 && inner.length < 50) {
      // heuristics: if inner is a single short word like 'sifted' we treat as irrelevant and drop
      if (!/\s/.test(inner) && inner.length < 12) {
        // treat short words as removable (sifted, peeled) unless they look like measurements
        return ''
      }
    }
    return `(${inner})`
  })
}

function removeTrailingIrrelevantNotes(s: string): string {
  // remove phrases like ", to taste" or ", for garnish"
  for (const phrase of IRRELEVANT_PHRASES) {
    const re = new RegExp(',?\s*' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
    if (re.test(s)) return s.replace(re, '')
  }
  return s
}

export function normalizeIngredients(ingredientsRaw: string[]): string[] {
  if (!Array.isArray(ingredientsRaw)) return []
  return ingredientsRaw.map((raw) => {
    if (!raw) return ''
    let s = String(raw)
  // remove leading bullets or list markers (don't remove hyphens inside words)
  s = s.replace(/^[\s\u2022\*\-\u2023\u00B7]+/, '')
  // remove common unicode bullet characters anywhere in the string (middle dot, bullets, hyphen-like bullets)
  // but avoid stripping hyphens that are part of words like 'all-purpose'
  s = s.replace(/[\u2022\u2023\u00B7\u2024\u2027\u2219\u00B7·]+/g, '')
    s = stripHtml(s)
    s = s.replace(/\s+([,])\s+/g, '$1 ') // normalize comma spacing
    s = s.replace(/\s+/g, ' ')
    s = s.trim()

    s = removeIrrelevantParentheticals(s)
  s = removeTrailingIrrelevantNotes(s)
  // if a trailing comma was left after removing notes, strip it
  s = s.replace(/,\s*$/, '')

    // remove leftover double spaces and trim
    s = s.replace(/\s+/g, ' ').trim()
    // remove leading commas or hyphens
    s = s.replace(/^[,\-\s]+/, '')
    return s
  }).map(s => s.trim()).filter(Boolean)
}

export default normalizeIngredients
