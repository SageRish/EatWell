import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/tailwind.css'
import OnboardingModal from './OnboardingModal'
import prefs from '../utils/prefs/storage'

function Popup() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recipe, setRecipe] = useState<any | null>(null)
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
        const url = c.runtime.getURL(`sidebar/index.html${recipe ? '?state=ready' : ''}`)
        // open in new tab
        c.tabs.create({ url })
        return
      }
    } catch {
      // fallback
      window.open(`sidebar/index.html${recipe ? '?state=ready' : ''}`, '_blank')
    }
  }

  return (
    <div className="p-3 min-w-[180px] max-w-[320px]">
      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-base font-medium">{recipe?.title || 'No recipe detected'}</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded text-sm" onClick={openOptions}>Settings</button>
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
