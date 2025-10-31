import React, { useState } from 'react'
import prefs from '../utils/prefs/storage'
import { parseIngredient } from '../utils/parseIngredient'

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
  onLocalize,
  onSuggestAlternatives,
  privacyEnabled = false,
  onTogglePrivacy,
  className = ''
}) => {
  const [cleaning, setCleaning] = useState(false)
  const [cleaned, setCleaned] = useState<Record<number, string>>({})

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
    } catch (e) {
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
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('cleanStepText error', err)
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
              <details className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded p-2">
                <summary className="cursor-pointer font-medium text-gray-800 dark:text-gray-100">Show full ingredient list ({ingredients.length})</summary>
                {ingredients.length ? (
                  <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300 space-y-2">
                    {ingredients.map((ing, idx) => {
                      const parsed = parseIngredient(ing || '')
                      return (
                        <li key={idx} className="flex items-start gap-3">
                          <input
                            aria-label={`Toggle ingredient ${idx}`}
                            type="checkbox"
                            className="mt-1 w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm text-gray-900 dark:text-gray-100">{parsed.ingredientName || ing}</div>
                          </div>
                          <div className="ml-2">
                            <div className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded border border-gray-200">{parsed.quantity != null ? String(parsed.quantity) + (parsed.unit ? ` ${parsed.unit}` : '') : ''}</div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
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
            <h3 className="font-medium text-gray-800 dark:text-gray-200">Allergen alerts</h3>
            {alerts.length ? (
              <ul className="mt-2 space-y-2">
                {alerts.map((a, idx) => (
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
                      <div className="text-sm text-red-700 dark:text-red-300">{a.confidence}%</div>
                    </div>
                    {a.reason && <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{a.reason}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-sm text-green-700 dark:text-green-300">No allergens detected.</div>
            )}
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
                onClick={onLocalize}
                className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label="Localize ingredients"
              >
                Localize
              </button>
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
