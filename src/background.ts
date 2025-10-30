// Background service worker (MV3)
import { getNutrition } from './utils/nutrition'
import cache from './utils/cache'
import summarizeInstructions from './utils/summarizeInstructions'
import privacy from './utils/privacy'

console.log('EatWell background worker loaded')

// Warm cache or init as needed (synchronous to avoid async top-level issues)
try {
  if (cache && typeof (cache as any).setPrivacyMode === 'function') {
    const isPrivacy = !!privacy && typeof (privacy as any).isPrivacyMode === 'function' && (privacy as any).isPrivacyMode()
    ;(cache as any).setPrivacyMode(isPrivacy)
  }
} catch (e) {
  // ignore
}

(globalThis as any).chrome?.runtime?.onInstalled?.addListener(() => {
  console.log('EatWell installed')
})

function sendToTab(tabId: number | undefined, message: any) {
  const ch = (globalThis as any).chrome
  if (typeof tabId === 'number' && ch && ch.tabs && ch.tabs.sendMessage) {
    try { ch.tabs.sendMessage(tabId, message) } catch (e) { /* ignore */ }
  } else if (ch && ch.runtime && ch.runtime.sendMessage) {
    try { ch.runtime.sendMessage(message) } catch (e) { /* ignore */ }
  }
}

// Simple helper to perform nutrition lookup with cache and progress
async function performNutritionLookup(payload: any, sender: any) {
  const { canonicalName, quantity, requestId } = payload
  const tabId = sender && sender.tab && sender.tab.id
  const key = `nutrition:${canonicalName}:${quantity || 100}`

  // notify started
  sendToTab(tabId, { type: 'eatwell:nutrition:progress', requestId, status: 'started' })

  const fetcher = async () => {
    // call core lookup
    const res = await getNutrition(canonicalName, quantity)
    return res
  }

  try {
    const result = await cache.getOrFetch(key, fetcher, { ttlMs: 1000 * 60 * 60, persistent: true })
    sendToTab(tabId, { type: 'eatwell:nutrition:progress', requestId, status: 'done', result })
    return { ok: true, result }
  } catch (err) {
    sendToTab(tabId, { type: 'eatwell:nutrition:progress', requestId, status: 'error', error: String(err) })
    return { ok: false, error: String(err) }
  }
}

// Summarization handler — uses summarizeInstructions utility. honors privacy via injected mock.
async function performSummarization(payload: any, sender: any) {
  const { instructions, requestId } = payload
  const tabId = sender && sender.tab && sender.tab.id

  sendToTab(tabId, { type: 'eatwell:summary:progress', requestId, status: 'started' })

  // choose summarizer based on privacy
  let summarizer = undefined
  if (privacy && (privacy as any).isPrivacyMode && (privacy as any).isPrivacyMode()) {
    // local mock summarizer
    summarizer = {
      summarize: async (text: string) => {
        // naive mock: return first 3 lines as 3-step and repeated for 6
        const parts = text.split('\n').slice(0, 6)
        return parts.join('\n')
      }
    }
  }

  try {
    const summaries = await summarizeInstructions(instructions, { summarizer })
    sendToTab(tabId, { type: 'eatwell:summary:progress', requestId, status: 'done', summaries })
    return { ok: true, summaries }
  } catch (err) {
    sendToTab(tabId, { type: 'eatwell:summary:progress', requestId, status: 'error', error: String(err) })
    return { ok: false, error: String(err) }
  }
}

// Main message handler
(globalThis as any).chrome?.runtime?.onMessage?.addListener((msg: any, sender: any, sendResponse: any) => {
  if (!msg || !msg.action) return
  if (msg.action === 'fetch_nutrition') {
    performNutritionLookup(msg.payload, sender).then((res) => sendResponse && sendResponse(res)).catch((e) => sendResponse && sendResponse({ ok: false, error: String(e) }))
    return true
  }
  if (msg.action === 'summarize') {
    performSummarization(msg.payload, sender).then((res) => sendResponse && sendResponse(res)).catch((e) => sendResponse && sendResponse({ ok: false, error: String(e) }))
    return true
  }
  // unknown action
  sendResponse && sendResponse({ ok: false, error: 'unknown_action' })
  return false
})
