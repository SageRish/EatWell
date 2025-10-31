import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/tailwind.css'
import prefs, { DEFAULT_PREFS } from '../utils/prefs/storage'

function OptionsApp() {
  const [loading, setLoading] = useState(true)
  const [allergens, setAllergens] = useState('')
  const [locale, setLocale] = useState(DEFAULT_PREFS.locale)
  const [dailyCalories, setDailyCalories] = useState('')
  const [telemetry, setTelemetry] = useState(false)
  const [usdaKey, setUsdaKey] = useState('')
  const [rewriterToken, setRewriterToken] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [showUsdaKey, setShowUsdaKey] = useState(false)
  const [showRewriterToken, setShowRewriterToken] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)

  useEffect(() => {
    prefs.getPrefs().then((p) => {
      setAllergens((p.allergens || []).join(', '))
      setLocale(p.locale || DEFAULT_PREFS.locale)
      setDailyCalories(p.dietaryGoals?.dailyCalories ? String(p.dietaryGoals.dailyCalories) : '')
      setTelemetry(!!p.telemetryOptIn)
      setUsdaKey(p.usdaApiKey || '')
      setRewriterToken(p.rewriterToken || '')
      setGeminiKey((p as any).geminiApiKey || '')
      setLoading(false)
    })
  }, [])

  async function save() {
    const list = allergens.split(',').map((s) => s.trim()).filter(Boolean)
    const dg = { dailyCalories: dailyCalories ? Number(dailyCalories) : undefined }
    await prefs.setPrefs({ allergens: list, locale, dietaryGoals: dg as any, telemetryOptIn: telemetry, hasSeenOnboarding: true, usdaApiKey: usdaKey || undefined, geminiApiKey: geminiKey || undefined, rewriterToken: rewriterToken || undefined })
    alert('Settings saved')
  }

  if (loading) return <div className="p-4">Loading…</div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">EatWell Settings</h1>
      <div className="mt-4">
        <label className="block text-sm">Allergens (comma-separated)</label>
        <input className="w-full border p-2 rounded mt-1" value={allergens} onChange={(e) => setAllergens(e.target.value)} />
      </div>

      <div className="mt-4">
        <label className="block text-sm">Locale</label>
        <input className="w-full border p-2 rounded mt-1" value={locale} onChange={(e) => setLocale(e.target.value)} />
      </div>

      <div className="mt-4">
        <label className="block text-sm">Daily Calories goal</label>
        <input className="w-full border p-2 rounded mt-1" value={dailyCalories} onChange={(e) => setDailyCalories(e.target.value)} />
      </div>

      <div className="mt-4">
        <label className="block text-sm">USDA API Key</label>
        <div className="flex gap-2">
          <input
            className="w-full border p-2 rounded mt-1"
            type={showUsdaKey ? 'text' : 'password'}
            value={usdaKey}
            onChange={(e) => setUsdaKey(e.target.value)}
            placeholder="Enter your USDA API key (leave blank to disable)"
          />
          <button
            className="ml-2 px-2 py-2 bg-gray-200 rounded"
            onClick={() => setShowUsdaKey((s) => !s)}
            type="button"
          >
            {showUsdaKey ? 'Hide' : 'Show'}
          </button>
        </div>
  <div className="text-xs text-gray-500 mt-1">Do not paste provider keys into public repositories. This key is stored in your browser extension storage.</div>
      </div>

      <div className="mt-4">
        <label className="block text-sm">Rewriter origin-trial token</label>
        <div className="flex gap-2">
          <input
            className="w-full border p-2 rounded mt-1"
            type={showRewriterToken ? 'text' : 'password'}
            value={rewriterToken}
            onChange={(e) => setRewriterToken(e.target.value)}
            placeholder="Paste your Rewriter origin-trial token (keeps it out of the repo)"
          />
          <button
            className="ml-2 px-2 py-2 bg-gray-200 rounded"
            onClick={() => setShowRewriterToken((s) => !s)}
            type="button"
          >
            {showRewriterToken ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">This token enables the Chrome Rewriter API for your extension origin. It is stored only in your browser and not committed to source control.</div>
      </div>

      <div className="mt-4">
        <label className="block text-sm">Gemini API Key</label>
        <div className="flex gap-2">
          <input
            className="w-full border p-2 rounded mt-1"
            type={showGeminiKey ? 'text' : 'password'}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Enter your Gemini API key (leave blank to disable)"
          />
          <button
            className="ml-2 px-2 py-2 bg-gray-200 rounded"
            onClick={() => setShowGeminiKey((s) => !s)}
            type="button"
          >
            {showGeminiKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">This key will be used to call the Gemini REST API for nutrition analysis. It is stored only in your browser and not committed to source control.</div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input id="telemetry" type="checkbox" checked={telemetry} onChange={(e) => setTelemetry(e.target.checked)} />
        <label htmlFor="telemetry" className="text-sm">Enable anonymous telemetry</label>
      </div>

      <div className="mt-6">
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={save}>Save</button>
      </div>
    </div>
  )
}

const root = document.getElementById('root')!
createRoot(root).render(<OptionsApp />)
