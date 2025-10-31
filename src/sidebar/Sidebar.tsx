import React, { useState } from 'react'
import prefs from '../utils/prefs/storage'
import { parseIngredient } from '../utils/parseIngredient'
import detectAllergens from '../utils/detectAllergens'
import { canonicalizeIngredient } from '../utils/canonicalizeIngredient'

export type AlertItem = {
  ingredient: string
  allergen: string
  confidence: number
  source?: 'ontology' | 'model' | 'both'
  reason?: string
}

export type NutritionSummary = {
  calories?: number
  fat?: string
  carbs?: string
  protein?: string
}

export type SidebarState = 'loading' | 'error' | 'ready'

export type RecipeSidebarProps = {
  state?: SidebarState
  title?: string
  summary?: string[]
  ingredients?: string[]
  instructions?: string[]
  nutrition?: NutritionSummary
  alerts?: AlertItem[]
  onRescale?: () => void
  onLocalize?: () => void
  onSuggestAlternatives?: () => void
  privacyEnabled?: boolean
  onTogglePrivacy?: (v: boolean) => void
  className?: string
}

export const Sidebar: React.FC<RecipeSidebarProps> = ({
  state = 'loading',
  title = 'Recipe Title',
  summary = [],
  ingredients = [],
  instructions = [],
  nutrition,
  alerts = [],
  onRescale,
  onSuggestAlternatives,
  privacyEnabled = false,
  onTogglePrivacy,
  className = ''
}) => {
  const [cleaning, setCleaning] = useState(false)
  const [cleaned, setCleaned] = useState<Record<number, string>>({})
  const [cleaningIngredients, setCleaningIngredients] = useState<Record<number, boolean>>({})
  const [cleanedIngredients, setCleanedIngredients] = useState<Record<number, { quantity?: string; unit?: string; ingredientName?: string }>>({})
  const [showLocalization, setShowLocalization] = useState(false)
  const [localizing, setLocalizing] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [modelAlerts, setModelAlerts] = useState<AlertItem[]>([])
  const [detectingAllergens, setDetectingAllergens] = useState(false)

  async function injectOriginTrial(token?: string) {
    if (!token) return null
    try {
      // Inject origin-trial meta tag at runtime so token is not stored in the manifest
      const existing = document.querySelector("meta[http-equiv='origin-trial']")
      if (existing) return existing as HTMLMetaElement
      const meta = document.createElement('meta')
      meta.setAttribute('http-equiv', 'origin-trial')
      meta.setAttribute('content', token)
      document.head.appendChild(meta)
      return meta
    } catch {
      return null
    }
  }

  async function cleanStepText(idx: number, stepText: string) {
    try {
      setCleaning(true)
      const p = await prefs.getPrefs()
      const token = p.rewriterToken
      const injectedMeta = await injectOriginTrial(token)

      // detect Rewriter API
      if (!(window as any).Rewriter) {
        window.alert('Rewriter API is not available in this browser/profile. Ensure the origin trial token is set and your browser supports Rewriter.')
        return
      }

      const avail = await (window as any).Rewriter.availability()
      if (avail === 'unavailable') {
        window.alert('Rewriter model is not available on this device/browser.')
        return
      }

      const promptContext = `You are a helpful assistant that rewrites and cleans up cooking instructions. For the provided instruction, fix grammar, remove extraneous words, make it concise and easy to follow, preserve the original meaning, and present it as a short clear imperative step. Keep measurements and ingredient references intact.`

      const rewriter = await (window as any).Rewriter.create({ sharedContext: 'Clean cooking instruction' })
      const cleanedText = await rewriter.rewrite(stepText, { context: promptContext, format: 'plain-text', tone: 'as-is', length: 'as-is' })

      setCleaned((c) => ({ ...c, [idx]: cleanedText }))
      // best-effort cleanup of injected meta tag
  try {
        if (injectedMeta && injectedMeta.parentElement) injectedMeta.parentElement.removeChild(injectedMeta)
      } catch {
        // ignore
      }
    } catch {
      console.error('cleanStepText error')
      window.alert('Failed to clean step — see console for details')
    } finally {
      setCleaning(false)
    }
  }

  async function cleanAll() {
    if (!instructions || instructions.length === 0) return
    setCleaning(true)
    try {
      for (let i = 0; i < instructions.length; i++) {
        // await serially to avoid concurrent model downloads
        // eslint-disable-next-line no-await-in-loop
        // skip if already cleaned
        if (cleaned[i]) continue
        // eslint-disable-next-line no-await-in-loop
        // use the same logic as cleanStepText but inline a bit to avoid double state churn
        const step = instructions[i]
        await cleanStepText(i, step)
      }
    } finally {
      setCleaning(false)
    }
  }

  async function parseIngredientPrompt(idx: number, line: string) {
    setCleaningIngredients((s) => ({ ...s, [idx]: true }))
    try {
      const LM = (window as any).LanguageModel
      if (!LM) {
        // fallback to local parser
        const p = parseIngredient(line || '')
        setCleanedIngredients((c) => ({ ...c, [idx]: { quantity: p.quantity != null ? String(p.quantity) : '', unit: p.unit || '', ingredientName: p.ingredientName || line } }))
        return
      }

      const avail = await LM.availability()
      if (avail === 'unavailable') {
        const p = parseIngredient(line || '')
        setCleanedIngredients((c) => ({ ...c, [idx]: { quantity: p.quantity != null ? String(p.quantity) : '', unit: p.unit || '', ingredientName: p.ingredientName || line } }))
        return
      }

      const session = await LM.create()
      try {
        const schema = {
          type: 'object',
          properties: {
            quantity: { type: ['string', 'number', 'null'] },
            unit: { type: 'string' },
            ingredientName: { type: 'string' }
          },
          required: ['ingredientName']
        }

        const prompt = `Parse this normalized ingredient into JSON with keys {quantity, unit, ingredientName}. If quantity is unknown, return null or empty string for quantity. Keep units short (e.g. cup, tsp, g).\n\nIngredient:\n${line}`
        const result = await session.prompt(prompt, { responseConstraint: schema })
        let parsed: any = null
        try {
          parsed = JSON.parse(result)
        } catch {
          // fall through to fallback parser below
        }

        if (!parsed || typeof parsed.ingredientName !== 'string') {
          const p = parseIngredient(line || '')
          setCleanedIngredients((c) => ({ ...c, [idx]: { quantity: p.quantity != null ? String(p.quantity) : '', unit: p.unit || '', ingredientName: p.ingredientName || line } }))
        } else {
          setCleanedIngredients((c) => ({ ...c, [idx]: { quantity: parsed.quantity != null ? String(parsed.quantity) : '', unit: parsed.unit || '', ingredientName: parsed.ingredientName || line } }))
        }
        } finally {
        try {
          if (session && typeof session.destroy === 'function') session.destroy()
        } catch {
          // ignore
        }
      }
    } catch {
      const p = parseIngredient(line || '')
      setCleanedIngredients((c) => ({ ...c, [idx]: { quantity: p.quantity != null ? String(p.quantity) : '', unit: p.unit || '', ingredientName: p.ingredientName || line } }))
    } finally {
      setCleaningIngredients((s) => {
        const copy = { ...s }
        delete copy[idx]
        return copy
      })
    }
  }

  async function parseAllIngredients() {
    if (!ingredients || ingredients.length === 0) return
    for (let i = 0; i < ingredients.length; i++) {
      // skip if already parsed
      if (cleanedIngredients[i]) continue
      // serial to avoid concurrent model downloads
      // eslint-disable-next-line no-await-in-loop
      // call parser
      await parseIngredientPrompt(i, ingredients[i])
    }
  }

  // Simple fallback mapping for common names when the Prompt API is unavailable.
  const fallbackLocalizationMap: Record<string, Record<string, string>> = {
    India: {
      'cashew nuts': 'kaju',
      'cashew': 'kaju',
      'coriander': 'dhania',
      'cilantro': 'dhania'
    },
    Mexico: {
      'cilantro': 'cilantro',
      'coriander': 'cilantro'
    },
    Japan: {
      'soy sauce': 'shoyu',
      'nori': 'nori'
    }
  }

  async function localizeIngredientsForCountry(country: string) {
    if (!ingredients || ingredients.length === 0) return
    setLocalizing(true)
    try {
      const LM = (window as any).LanguageModel
      // Build a list of ingredient NAMES only (prefer cleaned ingredientName if present)
      const names = ingredients.map((ing, idx) => {
        const cleaned = cleanedIngredients[idx]
        // extract name only: if cleaned exists, use its ingredientName, else use parseIngredient to get name
        if (cleaned && cleaned.ingredientName) return String(cleaned.ingredientName)
        const p = parseIngredient(ing || '')
        return p.ingredientName || ing
      })

      let mapping: Array<{ original: string; localized: string }> | null = null

      if (LM) {
        const avail = await LM.availability()
        if (avail !== 'unavailable') {
          const session = await LM.create()
          try {
            const schema = {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  original: { type: 'string' },
                  localized: { type: 'string' }
                },
                required: ['original', 'localized']
              }
            }

            const prompt = `You are a helpful culinary assistant. Given the following ingredient NAMES (one per line), provide the most commonly used local name (in English script) for people from ${country}. Only change the ingredient NAME (do not modify quantities or units). Return a JSON array of objects with keys {original, localized}. If there is no distinct local name, return the original as the localized value.\n\nIngredients:\n${names.join('\n')}`

            try {
              const result = await session.prompt(prompt, { responseConstraint: schema })
              mapping = JSON.parse(result)
            } catch {
              // fall through to fallback mapping
            }
          } finally {
            try {
              if (session && typeof session.destroy === 'function') session.destroy()
            } catch {
              // ignore
            }
          }
        }
      }

      // If mapping is still null, apply fallback heuristics
      if (!mapping) {
        mapping = names.map((n) => {
          const key = (n || '').toLowerCase().trim()
          const localized = (fallbackLocalizationMap[country] && fallbackLocalizationMap[country][key]) || n
          return { original: n, localized }
        })
      }

      // Apply localized names to cleanedIngredients (only change name field)
      const updates: Record<number, { quantity?: string; unit?: string; ingredientName?: string }> = {}
      for (let i = 0; i < names.length; i++) {
        const mapItem = mapping[i]
        if (!mapItem) continue
        const current = cleanedIngredients[i] || {}
        updates[i] = { ...(current || {}), ingredientName: mapItem.localized }
      }
      setCleanedIngredients((c) => ({ ...c, ...updates }))
    } finally {
      setLocalizing(false)
      setShowLocalization(false)
    }
  }

  async function detectAllergensForRecipe() {
    if (!ingredients || ingredients.length === 0) return
    setDetectingAllergens(true)
    try {
      // canonicalize ingredient names
      const canonicalIngredients = ingredients.map((ing) => canonicalizeIngredient(ing || '').canonicalName)

      const p = await prefs.getPrefs()
      const userAllergens = (p.allergens && p.allergens.length) ? p.allergens : ['nuts', 'dairy', 'gluten', 'soy', 'egg', 'sesame', 'mustard', 'shellfish', 'lupin', 'peanut']

      // prepare promptFn wrapper for detectAllergens
      const LM = (window as any).LanguageModel
      const promptFn = async (promptText: string, opts?: any) => {
        if (!LM) throw new Error('LanguageModel not available')
        const avail = await LM.availability()
        if (avail === 'unavailable') throw new Error('LanguageModel unavailable')
        const session = await LM.create()
        try {
          const res = await session.prompt(promptText, opts)
          return res
        } finally {
          try { if (session && typeof session.destroy === 'function') session.destroy() } catch { /* ignore */ }
        }
      }

      const { result } = await detectAllergens(canonicalIngredients, userAllergens, { promptFn })
      if (result && result.matches) {
        const mapped: AlertItem[] = result.matches.map((m) => ({ ingredient: m.ingredient, allergen: m.allergen, confidence: m.confidence, reason: m.reason, source: 'model' }))
        setModelAlerts(mapped)
      }
    } catch (e) {
      // fallback: try a simple ontology-based detection using allergenOntology if available
      console.warn('Allergen detection failed or unavailable, falling back to no-op', e)
      setModelAlerts([])
    } finally {
      setDetectingAllergens(false)
    }
  }
  return (
    <aside
      className={`max-w-md w-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-4 sm:p-6 ${className}`}
      role="complementary"
      aria-label="Recipe sidebar"
    >
      {state === 'loading' && (
        <div className="animate-pulse" aria-busy="true">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mt-6" />
        </div>
      )}

      {state === 'error' && (
        <div role="alert" className="text-red-700 dark:text-red-300">
          <h3 className="font-semibold">Unable to load recipe</h3>
          <p className="text-sm mt-2">There was a problem extracting the recipe. Try reloading the page.</p>
        </div>
      )}

      {state === 'ready' && (
        <div className="space-y-4">
          <header>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100" tabIndex={0}>
              {title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Quick summary</p>
          </header>

          <section aria-label="summary" className="text-sm text-gray-700 dark:text-gray-300">
            {summary.length ? (
              <ul className="list-disc list-inside space-y-1">
                {summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No summary available.</p>
            )}
          </section>

            <section aria-label="ingredients" className="mt-4">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Ingredients</h3>
              <div className="mt-1">
                <button
                  onClick={() => setShowLocalization((s) => !s)}
                  className="px-2 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 focus:outline-none"
                  aria-label="Localize ingredients"
                >
                  {localizing ? 'Localizing…' : 'Localize'}
                </button>
                {showLocalization && (
                  <div className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 w-48 z-20">
                    <label className="text-xs text-gray-700 dark:text-gray-200">Select country</label>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full mt-1 mb-2 px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-white text-sm"
                    >
                      <option value="">Choose...</option>
                      <option value="India">India</option>
                      <option value="Mexico">Mexico</option>
                      <option value="Japan">Japan</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="United States">United States</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (selectedCountry) localizeIngredientsForCountry(selectedCountry)
                        }}
                        disabled={!selectedCountry || localizing}
                        className="flex-1 px-2 py-1 bg-yellow-600 text-white rounded text-sm disabled:opacity-50"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => setShowLocalization(false)}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <details className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded p-2">
                <summary className="cursor-pointer font-medium text-gray-800 dark:text-gray-100">Show full ingredient list ({ingredients.length})</summary>
                {ingredients.length ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-600 dark:text-gray-400">{ingredients.length} ingredients</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={parseAllIngredients}
                          className="px-2 py-1 text-xs bg-indigo-600 text-white rounded"
                        >
                          Clean all ingredients
                        </button>
                      </div>
                    </div>
                    <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300 space-y-2">
                      {ingredients.map((ing, idx) => {
                        const parsed = parseIngredient(ing || '')
                        const cleanedItem = cleanedIngredients[idx]
                        const ingredientName = cleanedItem?.ingredientName ?? parsed.ingredientName ?? ing
                        const quantityVal = cleanedItem?.quantity ?? (parsed.quantity != null ? String(parsed.quantity) : '')
                        const unitVal = cleanedItem?.unit ?? parsed.unit ?? ''
                        return (
                          <li key={idx} className="flex items-center gap-3">
                            <input
                              aria-label={`Toggle ingredient ${idx}`}
                              type="checkbox"
                              className="mt-0.5 w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-normal break-words">{ingredientName}</div>
                            </div>
                            <div className="ml-2 flex items-center gap-2">
                              <input
                                aria-label={`Quantity for ingredient ${idx}`}
                                value={quantityVal}
                                onChange={(e) => setCleanedIngredients((c) => ({ ...c, [idx]: { ...(c[idx] || {}), quantity: e.target.value } }))}
                                className="w-14 h-8 text-sm px-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded border border-gray-200 focus:outline-none"
                              />
                              <input
                                aria-label={`Unit for ingredient ${idx}`}
                                value={unitVal}
                                onChange={(e) => setCleanedIngredients((c) => ({ ...c, [idx]: { ...(c[idx] || {}), unit: e.target.value } }))}
                                className="w-12 h-8 text-sm px-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded border border-gray-200 focus:outline-none"
                              />
                              <button
                                onClick={() => parseIngredientPrompt(idx, ing)}
                                disabled={!!cleaningIngredients[idx]}
                                className="px-2 h-8 text-sm bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 flex items-center justify-center"
                              >
                                {cleaningIngredients[idx] ? 'Working…' : cleanedItem ? 'Cleaned' : 'Clean'}
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 mt-2">No ingredients detected.</div>
                )}
              </details>
            </section>

            <section aria-label="full-recipe" className="mt-4">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Full recipe</h3>
              <details className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded p-2">
                <summary className="cursor-pointer font-medium text-gray-800 dark:text-gray-100">Show full recipe instructions ({instructions.length} steps)</summary>
                  {instructions.length ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400">{instructions.length} steps</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={cleanAll}
                            disabled={cleaning}
                            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded disabled:opacity-50"
                          >
                            {cleaning ? 'Cleaning…' : 'Clean all steps'}
                          </button>
                        </div>
                      </div>
                      <ol className="list-decimal list-inside mt-1 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        {instructions.map((st, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <input
                              aria-label={`Toggle step ${idx}`}
                              type="checkbox"
                              className="mt-1 w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                {cleaned[idx] ? cleaned[idx] : st}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <button
                                onClick={() => cleanStepText(idx, st)}
                                disabled={cleaning || !!cleaned[idx]}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
                              >
                                {cleaned[idx] ? 'Cleaned' : cleaning ? 'Working…' : 'Clean'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 mt-2">No instructions detected.</div>
                  )}
              </details>
            </section>

          <section aria-label="nutrition" className="text-sm">
            <h3 className="font-medium text-gray-800 dark:text-gray-200">Nutrition</h3>
            {nutrition ? (
              <div className="mt-2 text-gray-700 dark:text-gray-300">
                <div>Calories: {nutrition.calories ?? '—'}</div>
                <div>Fat: {nutrition.fat ?? '—'}</div>
                <div>Carbs: {nutrition.carbs ?? '—'}</div>
                <div>Protein: {nutrition.protein ?? '—'}</div>
              </div>
            ) : (
              <div className="mt-2 text-gray-500">No nutrition data.</div>
            )}
          </section>

          <section aria-label="allergen alerts">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800 dark:text-gray-200">Allergen alerts</h3>
              <div>
                <button
                  onClick={detectAllergensForRecipe}
                  disabled={detectingAllergens}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                >
                  {detectingAllergens ? 'Detecting…' : 'Detect allergens'}
                </button>
              </div>
            </div>
            {(() => {
              // merge prop alerts with modelAlerts and dedupe by ingredient+allergen
              const combined = [...(alerts || []), ...modelAlerts]
              const unique: AlertItem[] = []
              const seen = new Set<string>()
              for (const a of combined) {
                const key = `${a.ingredient}::${a.allergen}`
                if (seen.has(key)) continue
                seen.add(key)
                unique.push(a)
              }

              return unique.length ? (
                <ul className="mt-2 space-y-2">
                  {unique.map((a, idx) => (
                    <li
                      key={idx}
                      className="p-2 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30"
                      tabIndex={0}
                      aria-label={`Alert: ${a.allergen} in ${a.ingredient}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-red-800 dark:text-red-200">{a.allergen}</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">{a.ingredient}</div>
                        </div>
                        <div className="text-sm text-red-700 dark:text-red-300">{a.confidence ?? '—'}%</div>
                      </div>
                      {a.reason && <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{a.reason}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-sm text-green-700 dark:text-green-300">No allergens detected.</div>
              )
            })()}
          </section>

          <section aria-label="actions" className="mt-4">
            <h3 className="font-medium text-gray-800 dark:text-gray-200">Actions</h3>
            <div className="mt-2 flex gap-2 flex-wrap">
              <button
                onClick={onRescale}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Rescale recipe servings"
              >
                Rescale
              </button>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded">
                <label className="text-sm">Privacy mode</label>
                <button
                  onClick={() => onTogglePrivacy && onTogglePrivacy(!privacyEnabled)}
                  className={`ml-2 w-12 h-6 rounded-full p-0 ${privacyEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                  aria-pressed={privacyEnabled}
                >
                  <span
                    className={`block w-5 h-5 bg-white rounded-full transform transition-transform ${privacyEnabled ? 'translate-x-6' : 'translate-x-0'}`}
                    aria-hidden
                  />
                </button>
              </div>
              
              <button
                onClick={onSuggestAlternatives}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                aria-label="Suggest alternative ingredients"
              >
                Suggest Alternatives
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
