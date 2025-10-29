import React from 'react'
import { createRoot } from 'react-dom/client'

// A minimal content script — inject a small badge to the page
const rootEl = document.createElement('div')
rootEl.id = 'eatwell-badge-root'
rootEl.style.position = 'fixed'
rootEl.style.bottom = '12px'
rootEl.style.right = '12px'
rootEl.style.zIndex = '999999'
document.body.appendChild(rootEl)

function Badge() {
  return (
    <div style={{ padding: '8px 12px', background: '#10B981', color: 'white', borderRadius: 8 }}>
      EatWell
    </div>
  )
}

try {
  createRoot(rootEl).render(<Badge />)
} catch (e) {
  // if page blocks module execution, degrade gracefully
  rootEl.textContent = 'EatWell'
}
