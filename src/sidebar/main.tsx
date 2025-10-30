import React from 'react'
import { createRoot } from 'react-dom/client'
import Sidebar, { type AlertItem } from './Sidebar'
import '../styles/tailwind.css'

function getStateFromSearch(): 'loading' | 'error' | 'ready' {
  const p = new URLSearchParams(window.location.search)
  const s = p.get('state')
  if (s === 'loading' || s === 'error' || s === 'ready') return s
  return 'ready'
}

const demoAlerts: AlertItem[] = [
  { ingredient: 'peanut butter', allergen: 'peanut', confidence: 99, source: 'ontology', reason: 'contains peanuts' },
  { ingredient: 'almond milk', allergen: 'tree-nut', confidence: 92, source: 'both', reason: 'almond detected' }
]

const rootEl = document.getElementById('root')!

function SidebarApp() {
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading')
  const [recipe, setRecipe] = React.useState<any | null>(null)
  const [privacy, setPrivacy] = React.useState(false)

  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const sourceTabId = p.get('sourceTabId') ? Number(p.get('sourceTabId')) : null

    const fetchFromTab = async (tabId?: number | null) => {
      try {
        const c: any = (window as any).chrome
        let resp: any = null
        if (tabId && c && c.tabs && c.tabs.sendMessage) {
          resp = await new Promise((res) => c.tabs.sendMessage(tabId, { action: 'get_extracted_recipe' }, (r: any) => res(r)))
        } else if (c && c.tabs && c.tabs.query) {
          const tabs = await new Promise<any[]>((res) => c.tabs.query({ active: true, currentWindow: true }, res))
          const tid = tabs && tabs[0] && tabs[0].id
          if (tid) resp = await new Promise((res) => c.tabs.sendMessage(tid, { action: 'get_extracted_recipe' }, (r: any) => res(r)))
        }

        if (resp && resp.ok && resp.recipe) {
          setRecipe(resp.recipe)
          setState('ready')
        } else {
          setState('error')
        }
      } catch (e) {
        setState('error')
      }
    }

    fetchFromTab(sourceTabId)
  }, [])

  const summary = React.useMemo(() => {
    if (!recipe) return []
    const parts: string[] = []
    if (recipe.servings) parts.push(String(recipe.servings))
    if (Array.isArray(recipe.instructionsRaw) && recipe.instructionsRaw.length) {
      parts.push(...recipe.instructionsRaw.slice(0, 3))
    } else if (Array.isArray(recipe.ingredientsRaw) && recipe.ingredientsRaw.length) {
      parts.push(`${recipe.ingredientsRaw.length} ingredients`)
    }
    return parts
  }, [recipe])

  const alerts = React.useMemo(() => {
    // placeholder: no model call here — we could call detectAllergens
    // or other utils. For now return empty array.
    return [] as any[]
  }, [recipe])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-4">
      <Sidebar
        state={state}
        title={recipe?.title || 'Recipe'}
        summary={summary}
        ingredients={recipe?.ingredientsRaw || []}
        instructions={recipe?.instructionsRaw || []}
        nutrition={undefined}
        alerts={alerts}
        onRescale={() => alert('Rescale clicked')}
        onLocalize={() => alert('Localize clicked')}
        onSuggestAlternatives={() => alert('Suggest Alternatives clicked')}
        privacyEnabled={privacy}
        onTogglePrivacy={(v) => { setPrivacy(v); /* optional: persist */ }}
      />
    </div>
  )
}

createRoot(rootEl).render(<SidebarApp />)
