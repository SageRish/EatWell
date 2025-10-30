import prefs, { DEFAULT_PREFS } from '../prefs/storage'
import cache from '../cache'

let _enabled = false
const listeners: Array<(v: boolean) => void> = []

async function init() {
  try {
    const p = await prefs.getPrefs()
    _enabled = !!(p as any).privacyMode
    cache.setPrivacyMode(_enabled)
  } catch (e) {
    _enabled = false
  }
}

// initialize (fire-and-forget)
init()

export function isPrivacyMode() {
  return _enabled
}

export async function setPrivacyMode(enabled: boolean) {
  _enabled = !!enabled
  try {
    // persist in prefs but ensure stored locally (privacy)
    await prefs.setPrefs({ ...(DEFAULT_PREFS as any), privacyMode: _enabled })
  } catch (e) {
    // ignore
  }
  try {
    cache.setPrivacyMode(_enabled)
  } catch (e) {}
  for (const l of listeners) {
    try { l(_enabled) } catch (e) {}
  }
}

export function onChange(cb: (v: boolean) => void) {
  listeners.push(cb)
  return () => {
    const i = listeners.indexOf(cb)
    if (i >= 0) listeners.splice(i, 1)
  }
}

export default { isPrivacyMode, setPrivacyMode, onChange }
