/*
  Content script: extract recipe data from the current page.

  Strategy:
  1) Try structured data (JSON-LD scripts with @type: Recipe)
  2) Try microdata (itemscope/itemtype with schema.org/Recipe)
  3) Fallback heuristics: look for common selectors and patterns

  Output: attach result to window.__EATWELL_RECIPE and log it.

  Sample pages to test (not exhaustive):
  - https://www.allrecipes.com/recipe/...
  - https://www.foodnetwork.com/recipes/...
  - https://www.epicurious.com/recipes/food/views/...
  - https://www.bbcgoodfood.com/recipes/...
  - https://www.seriouseats.com/recipes/...
  - https://cooking.nytimes.com/recipes/...
  - https://www.tasteofhome.com/recipes/...
  - https://www.delish.com/recipes/...
  - https://www.simplyrecipes.com/recipes/...
  - https://www.cookingchanneltv.com/recipes/...

  The extractor is defensive and will never throw — missing fields will be null or empty arrays.
*/

type Extracted = {
  title: string | null
  ingredientsRaw: string[]
  instructionsRaw: string[]
  servings?: string | number | null
  canonicalUrl: string | null
}

function safeText(el: Element | null): string | null {
  if (!el) return null
  const t = el.textContent || ''
  const s = t.replace(/\u00A0/g, ' ').trim()
  return s || null
}

function getCanonicalUrl(): string | null {
  try {
    const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (link && link.href) return link.href
    // sometimes meta property og:url
    const og = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null
    if (og && og.content) return og.content
    return location.href
  } catch (e) {
    return null
  }
}

function parseJsonLd(): Partial<Extracted> | null {
  try {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    for (const s of scripts) {
      try {
        const raw = s.textContent || ''
        if (!raw.trim()) continue
        const data = JSON.parse(raw)
        const items = Array.isArray(data) ? data : [data]
        for (const it of items) {
          // Some pages nest @graph
          const candidates = it['@graph'] && Array.isArray(it['@graph']) ? it['@graph'] : [it]
          for (const cand of candidates) {
            const type = (cand['@type'] || cand['type'] || '')
            const isRecipe = Array.isArray(type) ? type.includes('Recipe') : String(type).toLowerCase().includes('recipe')
            if (isRecipe) {
              const title = cand['name'] || cand['headline'] || null
              const ingredients = cand['recipeIngredient'] || cand['ingredients'] || []
              let instructions: string[] = []
              const ri = cand['recipeInstructions']
              if (Array.isArray(ri)) {
                // can be array of strings or objects
                for (const step of ri) {
                  if (typeof step === 'string') instructions.push(step.trim())
                  else if (step && typeof step === 'object') {
                    if (step['text']) instructions.push(String(step['text']).trim())
                    else if (step['itemListElement'] && Array.isArray(step['itemListElement'])) {
                      for (const sub of step['itemListElement']) {
                        if (typeof sub === 'string') instructions.push(sub.trim())
                        else if (sub && typeof sub === 'object' && sub['text']) instructions.push(String(sub['text']).trim())
                      }
                    }
                  }
                }
              } else if (typeof ri === 'string') {
                instructions = ri.split(/\n+/).map((r: string) => r.trim()).filter(Boolean)
              }

              const servings = cand['recipeYield'] || cand['yield'] || null
              const canonical = cand['url'] || getCanonicalUrl()

              return {
                title: title || null,
                ingredientsRaw: Array.isArray(ingredients) ? ingredients.map((i: any) => String(i).trim()) : [],
                instructionsRaw: instructions,
                servings: servings || null,
                canonicalUrl: canonical || null
              }
            }
          }
        }
      } catch (err) {
        // ignore JSON parse errors for this script block
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

function parseMicrodata(): Partial<Extracted> | null {
  try {
    // Look for itemscope elements with itemtype containing Recipe
    const candidates = Array.from(document.querySelectorAll('[itemscope][itemtype]'))
    for (const el of candidates) {
      const itemtype = String(el.getAttribute('itemtype') || '').toLowerCase()
      if (itemtype.includes('schema.org/recipe') || itemtype.includes('/recipe')) {
        const title = safeText(el.querySelector('[itemprop="name"]')) || safeText(el.querySelector('h1'))
        const ingEls = Array.from(el.querySelectorAll('[itemprop="recipeIngredient"], [itemprop="ingredients"]'))
        const ingredients = ingEls.length ? ingEls.map(i => (i.textContent || '').trim()).filter(Boolean) : []
        // instructions can be itemprop=recipeInstructions with nested steps
        const instrEls = Array.from(el.querySelectorAll('[itemprop="recipeInstructions"]'))
        const instructions: string[] = []
        if (instrEls.length) {
          for (const ie of instrEls) {
            if (ie.querySelectorAll('li').length) {
              instructions.push(...Array.from(ie.querySelectorAll('li')).map(li => (li.textContent || '').trim()).filter(Boolean))
            } else {
              const txt = (ie.textContent || '').trim()
              if (txt) instructions.push(txt)
            }
          }
        }
        const servings = safeText(el.querySelector('[itemprop="recipeYield"]'))
        const canonical = getCanonicalUrl()
        return {
          title: title || null,
          ingredientsRaw: ingredients,
          instructionsRaw: instructions,
          servings: servings || null,
          canonicalUrl: canonical || null
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

function heuristics(): Extracted {
  // Title
  const title = safeText(document.querySelector('h1')) || safeText(document.querySelector('title')) || document.title || null

  // Find ingredient containers by class/id keywords
  const ingSelectors = [
    '[class*="ingredient"]',
    '[id*="ingredient"]',
    '[class*="ingredients"]',
    '[id*="ingredients"]'
  ]
  const ingredients: string[] = []
  for (const sel of ingSelectors) {
    const nodes = Array.from(document.querySelectorAll(sel))
    for (const node of nodes) {
      // prefer list items
      const lis = Array.from(node.querySelectorAll('li'))
      if (lis.length) {
        ingredients.push(...lis.map(li => (li.textContent || '').trim()).filter(Boolean))
      } else {
        const txt = (node.textContent || '').trim()
        if (txt) {
          const parts = txt.split(/\n+/).map(p => p.trim()).filter(Boolean)
          if (parts.length > 1) ingredients.push(...parts)
        }
      }
    }
    if (ingredients.length) break
  }

  // Instructions heuristics
  const instrSelectors = [
    '[class*="instruction"]',
    '[id*="instruction"]',
    '[class*="directions"]',
    '[id*="directions"]',
    '[class*="method"]',
    '[id*="method"]',
    'ol[class*="step"], ol[class*="instruction"], ol[class*="directions"], ol'
  ]
  const instructions: string[] = []
  for (const sel of instrSelectors) {
    const nodes = Array.from(document.querySelectorAll(sel))
    for (const node of nodes) {
      const lis = Array.from(node.querySelectorAll('li'))
      if (lis.length) {
        instructions.push(...lis.map(li => (li.textContent || '').trim()).filter(Boolean))
      } else {
        const ps = Array.from(node.querySelectorAll('p'))
        if (ps.length) instructions.push(...ps.map(p => (p.textContent || '').trim()).filter(Boolean))
        else {
          const txt = (node.textContent || '').trim()
          if (txt) {
            const parts = txt.split(/\n+/).map(p => p.trim()).filter(Boolean)
            if (parts.length > 1) instructions.push(...parts)
          }
        }
      }
    }
    if (instructions.length) break
  }

  // Fallback: look for main content lists
  if (!ingredients.length) {
    const listLike = Array.from(document.querySelectorAll('ul, ol')).slice(0, 10)
    for (const l of listLike) {
      const txt = (l.textContent || '').toLowerCase()
      if (txt.includes('ingredient')) {
        ingredients.push(...Array.from(l.querySelectorAll('li')).map(li => (li.textContent || '').trim()).filter(Boolean))
        if (ingredients.length) break
      }
    }
  }

  if (!instructions.length) {
    const listLike = Array.from(document.querySelectorAll('ol, ul')).slice(0, 20)
    for (const l of listLike) {
      const txt = (l.textContent || '').toLowerCase()
      if (txt.includes('step') || txt.includes('direction') || txt.includes('instruction')) {
        instructions.push(...Array.from(l.querySelectorAll('li')).map(li => (li.textContent || '').trim()).filter(Boolean))
        if (instructions.length) break
      }
    }
  }

  // Servings heuristics
  let servings: string | number | null = null
  const servEl = document.querySelector('[class*="servings"], [id*="servings"], [itemprop="recipeYield"]')
  if (servEl) servings = (servEl.textContent || '').trim() || null

  const canonical = getCanonicalUrl()

  return {
    title: title || null,
    ingredientsRaw: ingredients,
    instructionsRaw: instructions,
    servings: servings,
    canonicalUrl: canonical
  }
}

function extractRecipe(): Extracted {
  try {
    // 1. JSON-LD
    const fromJsonLd = parseJsonLd()
    if (fromJsonLd) {
      return {
        title: fromJsonLd.title || null,
        ingredientsRaw: fromJsonLd.ingredientsRaw || [],
        instructionsRaw: fromJsonLd.instructionsRaw || [],
        servings: fromJsonLd.servings || null,
        canonicalUrl: fromJsonLd.canonicalUrl || getCanonicalUrl()
      }
    }

    // 2. Microdata
    const fromMicro = parseMicrodata()
    if (fromMicro) {
      return {
        title: fromMicro.title || null,
        ingredientsRaw: fromMicro.ingredientsRaw || [],
        instructionsRaw: fromMicro.instructionsRaw || [],
        servings: fromMicro.servings || null,
        canonicalUrl: fromMicro.canonicalUrl || getCanonicalUrl()
      }
    }

    // 3. heuristics
    return heuristics()
  } catch (e) {
    // Fallback empty
    return {
      title: null,
      ingredientsRaw: [],
      instructionsRaw: [],
      servings: null,
      canonicalUrl: getCanonicalUrl()
    }
  }
}

try {
  const result = extractRecipe()
  // expose to page for debugging/testing
  ;(window as any).__EATWELL_RECIPE = result

  const isEmpty = (
    !result.title &&
    (!result.ingredientsRaw || result.ingredientsRaw.length === 0) &&
    (!result.instructionsRaw || result.instructionsRaw.length === 0)
  )

  if (isEmpty) {
    // Post a failure message so listeners know extraction returned nothing useful
    const failure = { source: 'eatwell-content-script', status: 'failure', reason: 'no_data', recipe: result }
    window.postMessage(failure, '*')
    console.warn('EatWell extraction returned no data:', result)
  } else {
    // also post a message so devtools or the extension can listen
    window.postMessage({ source: 'eatwell-content-script', status: 'success', recipe: result }, '*')
    console.log('EatWell extracted recipe:', result)
  }
} catch (err) {
  // never throw
  console.error('EatWell extraction error', err)
  const fallback = { title: null, ingredientsRaw: [], instructionsRaw: [], servings: null, canonicalUrl: getCanonicalUrl() }
  ;(window as any).__EATWELL_RECIPE = fallback
  const failure = { source: 'eatwell-content-script', status: 'error', reason: String((err as any && (err as any).message) ? (err as any).message : err), recipe: fallback }
  window.postMessage(failure, '*')
}

// Wire up runtime message listener for highlighting from extension (sidebar)
try {
  // dynamic import to avoid type issues and keep the module lazy
  ;(async () => {
    const highlighter = await import('./content/highlighter')
    const ext = (window as any).chrome
    if (ext && ext.runtime && ext.runtime.onMessage) {
      ext.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: any) => {
        try {
          if (!msg || !msg.action) return
          if (msg.action === 'eatwell_highlight') {
            const entries = msg.entries || []
            const res = highlighter.highlightDetections(entries)
            sendResponse && sendResponse({ ok: true, result: res })
          } else if (msg.action === 'eatwell_clear_highlights') {
            highlighter.clearHighlights()
            sendResponse && sendResponse({ ok: true })
          }
        } catch (e) {
          sendResponse && sendResponse({ ok: false, error: String(e) })
        }
        // indicate we'll call sendResponse asynchronously if needed

      // Respond to requests from the popup or other extension pages asking for the
      // currently extracted recipe. This allows the popup to display the same data
      // the content script extracted.
      try {
        const respondWithRecipe = (sendResponse: any) => {
          try {
            const existing = (window as any).__EATWELL_RECIPE
            if (existing) {
              sendResponse({ ok: true, recipe: existing })
              return true
            }
            // if no existing extraction, run a fresh extraction
            const fresh = extractRecipe()
            ;(window as any).__EATWELL_RECIPE = fresh
            sendResponse({ ok: true, recipe: fresh })
            return true
          } catch (err) {
            sendResponse({ ok: false, error: String(err) })
            return true
          }
        }

        const ext = (window as any).chrome
        if (ext && ext.runtime && ext.runtime.onMessage) {
          ext.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: any) => {
            try {
              if (!msg || !msg.action) return
              if (msg.action === 'get_extracted_recipe') {
                return respondWithRecipe(sendResponse)
              }
            } catch (e) {
              // ignore
            }
            return false
          })
        }
      } catch (e) {
        // ignore
      }
        return true
      })
    }
  })()
} catch (e) {
  // non-fatal: if highlighter import fails, ignore
}
