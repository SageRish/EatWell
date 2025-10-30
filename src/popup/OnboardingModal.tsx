import React, { useState, useEffect } from 'react'
import { getPrefs, setPrefs } from '../utils/prefs/storage'

type Props = { onClose?: () => void }

export default function OnboardingModal({ onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [allergens, setAllergens] = useState<string>('')
  const [locale, setLocale] = useState('en-us')
  const [dailyCalories, setDailyCalories] = useState<string>('')
  const [telemetry, setTelemetry] = useState(false)

  useEffect(() => {
    let mounted = true
    getPrefs().then((p) => {
      if (!mounted) return
      setAllergens((p.allergens || []).join(', '))
      setLocale(p.locale || 'en-us')
      setDailyCalories(p.dietaryGoals?.dailyCalories?.toString() || '')
      setTelemetry(!!p.telemetryOptIn)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  async function save() {
    const allergenList = allergens
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const dg = { dailyCalories: dailyCalories ? Number(dailyCalories) : undefined }
    await setPrefs({ allergens: allergenList, locale, dietaryGoals: dg as any, telemetryOptIn: telemetry, hasSeenOnboarding: true })
    onClose && onClose()
  }

  if (loading) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-md p-6 w-[420px]">
        <h2 className="text-xl font-semibold">Welcome to EatWell</h2>
        <p className="text-sm text-gray-600 mt-2">A few quick questions to personalize recommendations.</p>

        <label className="block mt-4 text-sm">Allergens (comma-separated)</label>
        <input className="w-full border p-2 rounded mt-1" value={allergens} onChange={(e) => setAllergens(e.target.value)} />

        <label className="block mt-3 text-sm">Locale</label>
        <input className="w-full border p-2 rounded mt-1" value={locale} onChange={(e) => setLocale(e.target.value)} />

        <label className="block mt-3 text-sm">Daily Calories goal (optional)</label>
        <input className="w-full border p-2 rounded mt-1" value={dailyCalories} onChange={(e) => setDailyCalories(e.target.value)} />

        <label className="flex items-center gap-2 mt-3">
          <input type="checkbox" checked={telemetry} onChange={(e) => setTelemetry(e.target.checked)} />
          <span className="text-sm">Help improve EatWell (anonymous telemetry)</span>
        </label>

        <div className="flex justify-end gap-2 mt-4">
          <button className="px-3 py-1 border rounded" onClick={() => { setPrefs({ hasSeenOnboarding: true }); onClose && onClose() }}>Skip</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
