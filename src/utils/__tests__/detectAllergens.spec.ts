import { describe, it, expect } from 'vitest'
import { buildAllergenPrompt, detectAllergens } from '../detectAllergens'

describe('detectAllergens', () => {
  it('builds a prompt containing examples and input', () => {
    const prompt = buildAllergenPrompt(['butter (dairy)'], ['dairy'])
    expect(prompt).toContain('Examples:')
    expect(prompt).toContain('butter (dairy)')
    expect(prompt).toContain('dairy')
    expect(prompt).toContain('Return a single JSON object')
  })

  it('parses a mock JSON response into structured matches', async () => {
    const mockResponse = JSON.stringify({
      matches: [
        { ingredient: 'butter (dairy)', allergen: 'dairy', confidence: 95, reason: 'contains milk solids' }
      ],
      safe: false
    })

    const { prompt, result } = await detectAllergens(['butter (dairy)'], ['dairy'], {
      promptFn: async (p: string) => {
        // ensure prompt included our ingredient
        expect(p).toContain('butter (dairy)')
        return mockResponse
      }
    })

    expect(prompt).toContain('butter (dairy)')
    expect(result).toBeDefined()
    expect(result!.safe).toBe(false)
    expect(result!.matches.length).toBe(1)
    expect(result!.matches[0].ingredient).toBe('butter (dairy)')
    expect(result!.matches[0].allergen).toBe('dairy')
    expect(result!.matches[0].confidence).toBe(95)
  })
})
