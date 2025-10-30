import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/tailwind.css'
import OnboardingModal from './OnboardingModal'
// prefs intentionally not required in compact popup

function Popup() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recipe, setRecipe] = useState<any | null>(null)
  const [activeTabId, setActiveTabId] = useState<number | null>(null)
  // compact popup doesn't use nutrition/alerts directly

  useEffect(() => {
    // request the extracted recipe from the active tab's content script
    (async () => {
      try {
        const tabs = await new Promise<any[]>((res) => (window as any).chrome.tabs.query({ active: true, currentWindow: true }, res))
        if (!tabs || !tabs[0] || typeof tabs[0].id === 'undefined') {
          setLoading(false)
          return
        }
        const tabId = tabs[0].id
        setActiveTabId(tabId)
        ;(window as any).chrome.tabs.sendMessage(tabId, { action: 'get_extracted_recipe' }, (resp: any) => {
          if (resp && resp.ok && resp.recipe) {
            setRecipe(resp.recipe)
            // basic summary: first 3 instructions or fallback
            // basic summary computed inline below when rendering
            setLoading(false)
          } else {
            setLoading(false)
          }
        })
      } catch {
        setLoading(false)
      }
    })()
  }, [])

  // compact popup: show only title + actions
  const openOptions = () => {
    try {
      const c: any = (window as any).chrome
      if (c && c.runtime && c.runtime.openOptionsPage) {
        c.runtime.openOptionsPage()
        return
      }
      if (c && c.runtime && c.runtime.getURL) {
        const url = c.runtime.getURL('options/index.html')
        window.open(url, '_blank')
        return
      }
    } catch {}
    window.open('options/index.html', '_blank')
  }

  const openFullSidebar = () => {
    try {
      const c: any = (window as any).chrome
      if (c && c.runtime && c.runtime.getURL) {
        const url = c.runtime.getURL(`sidebar/index.html?sourceTabId=${activeTabId ?? ''}${recipe ? '&state=ready' : ''}`)
        // open in a new popup window for a focused sidebar-like experience
        if (c.windows && c.windows.create) {
          c.windows.create({ url, type: 'popup', width: 420, height: 760 })
          return
        }
        // fallback to a new tab
        c.tabs.create({ url })
        return
      }
    } catch {
      // fallback
      window.open(`sidebar/index.html?sourceTabId=${activeTabId ?? ''}${recipe ? '&state=ready' : ''}`, '_blank')
    }
  }

  return (
  <div className="min-w-[280px] max-w-[420px] min-h-[160px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded">
      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          <header>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">{recipe?.title || 'No recipe detected'}</h2>
            <p className="text-xs text-gray-500 truncate">{recipe?.canonicalUrl || ''}</p>
          </header>

          <section className="text-sm text-gray-700 dark:text-gray-300">
            {recipe && Array.isArray(recipe.ingredientsRaw) && recipe.ingredientsRaw.length ? (
              <ul className="list-disc list-inside">
                {recipe.ingredientsRaw.slice(0, 4).map((ing: string, i: number) => (
                  <li key={i} className="truncate text-sm text-gray-700 dark:text-gray-300">{ing}</li>
                ))}
                {recipe.ingredientsRaw.length > 4 && <li className="text-xs text-gray-500">+ {recipe.ingredientsRaw.length - 4} more</li>}
              </ul>
            ) : (
              <div className="text-xs text-gray-500">No ingredients detected.</div>
            )}
          </section>

          <div className="flex gap-2">
            <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm" onClick={openOptions}>Settings</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm" onClick={openFullSidebar}>Open full sidebar</button>
          </div>
        </div>
      )}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
    </div>
  )
}

const root = document.getElementById('root')!
createRoot(root).render(<Popup />)
