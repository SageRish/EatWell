import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/tailwind.css'

function Popup() {
  return (
    <div className="p-4 min-w-[200px] min-h-[100px]">
      <h1 className="text-2xl font-semibold">EatWell</h1>
      <p className="text-sm text-gray-600 mt-2">Healthy choices, small steps.</p>
    </div>
  )
}

const root = document.getElementById('root')!
createRoot(root).render(<Popup />)
