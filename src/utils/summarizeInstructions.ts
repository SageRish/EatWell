/**
 * summarizeInstructions
 * Uses Chrome's Summarizer API (if available) to summarize an array of instruction strings
 * into a 3-step and a 6-step summary. Supports injecting a mock summarizer for tests.
 */

export type SummarizerLike = {
  availability?: () => Promise<'available'|'downloadable'|'unavailable'> | Promise<string>
  create?: (options?: any) => Promise<any>
  // allow providing a ready summarizer directly
  summarize?: (text: string, opts?: any) => Promise<string>
}

export type Summaries = { summary3: string; summary6: string }

async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

async function callWithRetries<T>(fn: () => Promise<T>, maxAttempts = 4, baseDelay = 500): Promise<T> {
  let attempt = 0
  let lastErr: any
  while (attempt < maxAttempts) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      attempt++
      // if it's a 429 or transient network error, backoff; otherwise throw
  const code = (err && (err as any).status) || (err && (err as any).statusCode)
  const is429 = code === 429 || /rate limit|too many requests/i.test(String(err))
      if (!is429 && attempt >= maxAttempts) break
      const backoff = baseDelay * Math.pow(2, attempt - 1)
      await delay(backoff)
    }
  }
  throw lastErr
}

export async function summarizeInstructions(
  instructionsRaw: string[],
  opts?: { summarizer?: SummarizerLike }
): Promise<Summaries> {
  const text = instructionsRaw.join('\n')

  // choose summarizer source: injected or global
  const injected = opts?.summarizer
  let summarizerClient: any = null

  if (injected) {
    // if injected has summarize directly, use it as client
    summarizerClient = injected
  } else if (typeof (globalThis as any).Summarizer !== 'undefined') {
    // browser API path (note: in tests we'll inject a mock)
    const SummarizerAPI = (globalThis as any).Summarizer
    const availability = await (SummarizerAPI.availability?.() ?? Promise.resolve('unavailable'))
    if (availability === 'unavailable') throw new Error('Summarizer API unavailable')
    // create with default options; we will call summarize with context to control steps
    const summarizer = await SummarizerAPI.create?.({})
    summarizerClient = summarizer
  } else {
    throw new Error('No summarizer available (provide opts.summarizer for testing)')
  }

  // helper to call summarize with retries
  const doSummarize = async (nSteps: number) => {
    const context = `Please produce exactly ${nSteps} numbered steps that summarize the following recipe instructions.`
    const call = async () => {
      if (typeof summarizerClient.summarize === 'function') {
        return await summarizerClient.summarize(text, { context })
      }
      // some mocks might expose a direct function
      if (typeof summarizerClient === 'function') {
        return await summarizerClient(text, { context })
      }
      throw new Error('summarizer client does not implement summarize')
    }
    const raw = await callWithRetries(call)
    return String(raw).trim()
  }

  const [summary3, summary6] = await Promise.all([doSummarize(3), doSummarize(6)])
  return { summary3, summary6 }
}

export default summarizeInstructions
