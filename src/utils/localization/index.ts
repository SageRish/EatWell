// Localization module: map canonical ingredient names to locale-specific common names.
// Returns { localName, confidence, source }

import enUS from './en-us.json'
import enUK from './en-uk.json'
import enIN from './en-in.json'

export type LocalizationResult = {
  localName: string
  confidence: number
  source: 'dictionary' | 'translator'
}

export type TranslatorFn = (text: string, targetLocale: string) => Promise<string>

const maps: Record<string, Record<string, string>> = {
  'en-us': enUS as Record<string, string>,
  'en-uk': enUK as Record<string, string>,
  'en-gb': enUK as Record<string, string>,
  'en-in': enIN as Record<string, string>
}

function normalizeKey(s: string) {
  return s.trim().toLowerCase()
}

/**
 * Localize an ingredient name to a locale. Prefers dictionary lookup. If absent, uses
 * translatorFn if provided (mockable). Returns localName, confidence, and source.
 */
export async function localizeIngredient(
  canonicalName: string,
  locale: string,
  opts?: { translatorFn?: TranslatorFn }
): Promise<LocalizationResult> {
  const key = normalizeKey(canonicalName)
  const localeKey = (locale || 'en-us').toLowerCase()

  // choose best map match (exact locale or fallback to language-country)
  let dict: Record<string, string> | undefined
  if (maps[localeKey]) dict = maps[localeKey]
  else if (maps[localeKey.split('-')[0]]) dict = maps[localeKey.split('-')[0]]
  else dict = maps['en-us']

  if (dict && dict[normalizeKey(key)]) {
    return {
      localName: dict[normalizeKey(key)],
      confidence: 0.99,
      source: 'dictionary'
    }
  }

  // Not found in dictionary — use translatorFn if available
  const translator = opts?.translatorFn

  if (translator) {
    const translated = await translator(canonicalName, locale)
    return {
      localName: typeof translated === 'string' ? translated : String(translated),
      confidence: 0.65,
      source: 'translator'
    }
  }

  // Last resort: return original name with low confidence and mark translator as source
  return {
    localName: canonicalName,
    confidence: 0.35,
    source: 'translator'
  }
}

export { enUS as enUSMap, enUK as enUKMap, enIN as enINMap }
