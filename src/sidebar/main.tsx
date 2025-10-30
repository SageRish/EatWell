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
createRoot(rootEl).render(
  <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-4">
    <Sidebar
      state={getStateFromSearch()}
      title={"Grandma's Pancakes"}
      summary={[
        'Fluffy pancakes made with a hint of vanilla',
        'Takes 20 minutes',
        'Family-friendly and easily doubled'
      ]}
      nutrition={{ calories: 420, fat: '12g', carbs: '58g', protein: '8g' }}
      alerts={demoAlerts}
      onRescale={() => alert('Rescale clicked')}
      onLocalize={() => alert('Localize clicked')}
      onSuggestAlternatives={() => alert('Suggest Alternatives clicked')}
    />
  </div>
)
