import { describe, it, expect } from 'vitest'
import summarizeInstructions from '../summarizeInstructions'

describe('summarizeInstructions', () => {
  it('formats requests and returns mocked summaries (3 and 6 steps)', async () => {
    const calls: Array<{ text: string; opts?: any }> = []
    const mockSummarizer = {
      async summarize(text: string, opts?: any) {
        calls.push({ text, opts })
        const context: string = opts?.context || ''
        if (/exactly 3/.test(context)) {
          return '1. Do A\n2. Do B\n3. Do C'
        }
        if (/exactly 6/.test(context)) {
          return '1. A\n2. B\n3. C\n4. D\n5. E\n6. F'
        }
        return 'OK'
      }
    }

    const instructions = [
      'Preheat oven to 180C.',
      'Mix flour and sugar.',
      'Bake for 30 minutes.'
    ]

    const res = await summarizeInstructions(instructions, { summarizer: mockSummarizer })
    expect(res.summary3).toContain('1. Do A')
    expect(res.summary6).toContain('6. F')
    // assert calls were made with joined text and appropriate contexts
    expect(calls.length).toBe(2)
    expect(calls[0].text).toBe(instructions.join('\n'))
    expect(calls[0].opts.context).toMatch(/exactly 3/)
    expect(calls[1].opts.context).toMatch(/exactly 6/)
  })

  it('retries on rate limit errors and succeeds', async () => {
    let attempts = 0
    const mockSummarizer = {
      async summarize(text: string, opts?: any) {
        attempts++
        if (attempts < 3) {
          const err: any = new Error('Too many requests')
          err.status = 429
          throw err
        }
        return '1. OK\n2. OK\n3. OK'
      }
    }
    const res = await summarizeInstructions(['step1', 'step2'], { summarizer: mockSummarizer })
    expect(res.summary3).toContain('1. OK')
    expect(attempts).toBeGreaterThanOrEqual(3)
  })
})
