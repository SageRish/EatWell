import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/tailwind.css'

function Sidebar() {
  return (
    <div className="p-4">
      <h2 className="text-lg font-medium">EatWell Sidebar</h2>
      <p className="text-sm text-gray-600 mt-2">This is a sample sidebar for EatWell.</p>
    </div>
  )
}

const root = document.getElementById('root')!
createRoot(root).render(<Sidebar />)
