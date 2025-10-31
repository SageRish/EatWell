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
  onLocalize?: () => void
  privacyEnabled?: boolean
  onTogglePrivacy?: (v: boolean) => void
  className?: string
  calorieGoal?: number
}

export const Sidebar: React.FC<RecipeSidebarProps> = ({
  state = 'loading',
  title = 'Recipe Title',
  summary = [],
  ingredients = [],
  instructions = [],
  
  alerts = [],
  
  privacyEnabled = false,
  onTogglePrivacy,
  className = ''
  , calorieGoal
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
  const [calculatingNutrition, setCalculatingNutrition] = useState(false)
  const [nutritionResult, setNutritionResult] = useState<any | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatPrompt, setChatPrompt] = useState('')
  const [chatReplies, setChatReplies] = useState<Array<{role: 'user'|'assistant'; text: string}>>([])
  const [sendingChat, setSendingChat] = useState(false)
  const [selectedModel, setSelectedModel] = useState<'Prompt API'|'Gemini Nano'|'Gemini 2.5 Flash'>('Prompt API')

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

  function extractCookingMethods(instrs: string[]) {
    const methods = ['bake', 'roast', 'grill', 'fry', 'deep fry', 'deep-fry', 'saute', 'sauté', 'simmer', 'boil', 'steam', 'air fry', 'air-fry', 'braise']
    const found = new Set<string>()
    for (const s of instrs || []) {
      const low = (s || '').toLowerCase()
      for (const m of methods) if (low.includes(m)) found.add(m)
    }
    return Array.from(found)
  }

  function buildNutritionPrompt(ingredientsList: Array<{quantity?: string; unit?: string; name: string}>, instructions: string[]) {
    const ingredientsText = ingredientsList.map(i => `${i.quantity ?? ''} ${i.unit ?? ''} ${i.name}`).join('\n')
    const methods = extractCookingMethods(instructions)
    const prompt = `You are a nutrition analysis assistant. Given the ingredient list (with quantities & units) and the cooking methods for a recipe, return a single JSON object exactly matching this schema:\n{\n  "servings": number,\n  "totalCalories": number,\n  "totals": { "calories": number, "fat_g": number, "carbs_g": number, "protein_g": number, "fiber_g": number, "sugar_g": number, "sodium_mg": number },\n  "micronutrients": { "calcium_mg": number, "iron_mg": number, "potassium_mg": number, "vitamin_c_mg": number }\n}\nOnly return JSON and nothing else. Use best-effort nutritional estimates based on common food composition tables. If quantity or unit is missing, make a reasonable default assumption. Include the cooking methods in your reasoning but return only the JSON.\n\nIngredients:\n${ingredientsText}\n\nCooking methods:\n${methods.join(', ')}`
    return prompt
  }

  async function getNutritionAnalysis() {
    if (!ingredients || ingredients.length === 0) return
    setCalculatingNutrition(true)
    try {
  const p = await prefs.getPrefs()
      const apiKey = (p as any).geminiApiKey || (p as any).usdaApiKey
      if (!apiKey) {
        window.alert('No Gemini API key found in Options. Please add your API key in Options before requesting nutrition.');
        return
      }

      // build ingredient list objects
      const ingredientsList = ingredients.map((ing, idx) => {
        const ci = cleanedIngredients[idx]
        if (ci && ci.ingredientName) return { quantity: ci.quantity || '', unit: ci.unit || '', name: ci.ingredientName }
        const parsed = parseIngredient(ing || '')
        return { quantity: parsed.quantity != null ? String(parsed.quantity) : '', unit: parsed.unit || '', name: parsed.ingredientName || ing }
      })

      const prompt = buildNutritionPrompt(ingredientsList, instructions)

      const body = {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json'
        }
      }

      const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(body)
      })

      const data = await resp.json()
      // try to extract text
      let text = ''
      try {
        text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text
      } catch {
        text = ''
      }
      if (!text) {
        // fallback: attempt other shapes
        try { text = JSON.stringify(data) } catch { text = '' }
      }

      let parsed: any = null
      try { parsed = JSON.parse(text) } catch {
        // try to find JSON substring
        const m = text.match(/\{[\s\S]*\}/)
        if (m) try { parsed = JSON.parse(m[0]) } catch { parsed = null }
      }

      if (!parsed) {
        window.alert('Nutrition API returned unexpected response. See console for details.')
        console.log('Nutrition raw response', data)
        return
      }

      setNutritionResult(parsed)
    } catch (e) {
      console.error('getNutritionAnalysis failed', e)
      window.alert('Failed to calculate nutrition — see console for details')
    } finally {
      setCalculatingNutrition(false)
    }
  }

  function assembleChatContext() {
    // Ingredients (use cleanedIngredients when available)
    const ingList = ingredients.map((ing, idx) => {
      const ci = cleanedIngredients[idx]
      if (ci && ci.ingredientName) return `${ci.quantity ?? ''} ${ci.unit ?? ''} ${ci.ingredientName}`.trim()
      const parsed = parseIngredient(ing || '')
      return `${parsed.quantity != null ? String(parsed.quantity) : ''} ${parsed.unit ?? ''} ${parsed.ingredientName ?? ing}`.trim()
    })

    const recipeText = [`Title: ${title ?? ''}`, '', 'Instructions:', ...(instructions || [])].join('\n')

    // Allergens: combine alerts + modelAlerts
    const combinedAlerts = [...(alerts || []), ...modelAlerts]
    const unique = [] as AlertItem[]
    const seen = new Set<string>()
    for (const a of combinedAlerts) {
      const key = `${a.ingredient}::${a.allergen}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(a)
    }

    const allergenText = unique.map(a => `${a.allergen} in ${a.ingredient} (${a.confidence ?? '—'}%)${a.reason ? ' — ' + a.reason : ''}`).join('\n')

    // Build final context
    const ctxParts = [] as string[]
    ctxParts.push('Ingredients:')
    ctxParts.push(...ingList)
    ctxParts.push('')
    ctxParts.push(recipeText)
    if (allergenText) {
      ctxParts.push('')
      ctxParts.push('Allergen alerts:')
      ctxParts.push(allergenText)
    }
    // attach calorieGoal from props if present
    if (typeof calorieGoal !== 'undefined' && calorieGoal !== null) {
      ctxParts.push('')
      ctxParts.push(`Calorie goal: ${calorieGoal}`)
    }

    return ctxParts.join('\n')
  }

  async function sendPromptToModel() {
    if (!chatPrompt || chatPrompt.trim() === '') return
    setSendingChat(true)
    // add user message to chat
    setChatReplies((r) => [...r, { role: 'user', text: chatPrompt }])
    const context = assembleChatContext()
    const fullPrompt = `User prompt:\n${chatPrompt}\n\nContext:\n${context}`
    try {
      if (selectedModel === 'Prompt API') {
        const LM = (window as any).LanguageModel
        if (!LM) {
          window.alert('Prompt API (LanguageModel) is not available in this browser.')
          return
        }
        const avail = await LM.availability()
        if (avail === 'unavailable') {
          window.alert('Prompt API model unavailable on this device/browser.')
          return
        }
        const session = await LM.create()
        try {
          const res = await session.prompt(fullPrompt)
          setChatReplies((r) => [...r, { role: 'assistant', text: String(res) }])
        } finally {
          try { if (session && typeof session.destroy === 'function') session.destroy() } catch { /* ignore */ }
        }
      } else {
        // Gemini REST
        const p = await prefs.getPrefs()
        const apiKey = (p as any).geminiApiKey || (p as any).usdaApiKey
        if (!apiKey) {
          window.alert('No Gemini API key found in Options. Please add your API key in Options before using Gemini models.')
          return
        }
        const modelName = selectedModel === 'Gemini Nano' ? 'gemini-nano' : 'gemini-2.5-flash'
        const body = {
          contents: [ { parts: [ { text: fullPrompt } ] } ],
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
        }
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body)
        })
        const data = await resp.json()
        let text = ''
        try { text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '' } catch { text = '' }
        if (!text) text = JSON.stringify(data)
        setChatReplies((r) => [...r, { role: 'assistant', text }])
      }
    } catch (e) {
      console.error('sendPromptToModel failed', e)
      window.alert('Failed to send prompt — see console for details')
    } finally {
      setSendingChat(false)
      setChatPrompt('')
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
          <header className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100" tabIndex={0}>
                {title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Quick summary</p>
            </div>
            <div>
              <button
                aria-label="Open chat"
                title="Open chat"
                onClick={() => setChatOpen((s) => !s)}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                  <span className="text-xl" aria-hidden>💬</span>
              </button>
            </div>
          </header>

          {chatOpen && (
            <div role="dialog" aria-label="Recipe chat" className="mt-3 p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value as any)} className="ml-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm">
                  <option>Prompt API</option>
                  <option>Gemini Nano</option>
                  <option>Gemini 2.5 Flash</option>
                </select>
                <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">Context: ingredients · recipe · allergens · calorie goal</div>
              </div>

              <textarea
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                placeholder="Ask the model about substitutions, nutrition, or explain a step..."
                className="w-full h-20 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500"
              />

              <div className="flex items-center gap-2 mt-2">
                <button onClick={sendPromptToModel} disabled={sendingChat} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">{sendingChat ? 'Sending…' : 'Send'}</button>
                <button onClick={() => { setChatOpen(false); setChatReplies([]); }} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">Close</button>
              </div>

              <div className="mt-3 max-h-48 overflow-auto pr-2 space-y-3">
                {chatReplies.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`${m.role === 'user' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'bg-indigo-600 dark:bg-indigo-700 text-white'} rounded-lg px-3 py-2 max-w-[85%] shadow-sm`}>
                      <div className="text-xs font-semibold mb-1">{m.role === 'user' ? 'You' : 'Assistant'}</div>
                      <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                    </div>
                  </div>
                ))}
                {!chatReplies.length && (<div className="text-sm text-gray-500">Conversation will appear here.</div>)}
              </div>
            </div>
          )}

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
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800 dark:text-gray-200">Nutrition</h3>
              <div>
                <button
                  onClick={getNutritionAnalysis}
                  disabled={calculatingNutrition}
                  className="px-2 py-1 text-xs bg-orange-600 text-white rounded"
                >
                  {calculatingNutrition ? 'Calculating…' : 'Get Nutrition'}
                </button>
              </div>
            </div>

            {nutritionResult ? (
              <div className="mt-2 text-gray-700 dark:text-gray-300">
                <div>Servings: {nutritionResult.servings ?? '—'}</div>
                <div>Total calories: {nutritionResult.totalCalories ?? nutritionResult.totals?.calories ?? '—'}</div>
                <div className="mt-2 font-medium">Totals</div>
                <div className="ml-2">Calories: {nutritionResult.totals?.calories ?? '—'}</div>
                <div className="ml-2">Fat (g): {nutritionResult.totals?.fat_g ?? '—'}</div>
                <div className="ml-2">Carbs (g): {nutritionResult.totals?.carbs_g ?? '—'}</div>
                <div className="ml-2">Protein (g): {nutritionResult.totals?.protein_g ?? '—'}</div>
                <div className="ml-2">Fiber (g): {nutritionResult.totals?.fiber_g ?? '—'}</div>
                <div className="ml-2">Sugar (g): {nutritionResult.totals?.sugar_g ?? '—'}</div>
                <div className="ml-2">Sodium (mg): {nutritionResult.totals?.sodium_mg ?? '—'}</div>

                <div className="mt-2 font-medium">Micronutrients</div>
                <div className="ml-2">Calcium (mg): {nutritionResult.micronutrients?.calcium_mg ?? '—'}</div>
                <div className="ml-2">Iron (mg): {nutritionResult.micronutrients?.iron_mg ?? '—'}</div>
                <div className="ml-2">Potassium (mg): {nutritionResult.micronutrients?.potassium_mg ?? '—'}</div>
                <div className="ml-2">Vitamin C (mg): {nutritionResult.micronutrients?.vitamin_c_mg ?? '—'}</div>
              </div>
            ) : (
              <div className="mt-2 text-gray-500">No nutrition data. Click &quot;Get Nutrition&quot; to estimate nutrition using the Gemini API.</div>
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
            </div>
          </section>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
