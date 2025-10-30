import { expect, test } from 'vitest'
import { suggestSubstitutions, buildSubstitutionPrompt } from '../substitute/suggestSubstitutions'

// Mock promptFn that returns a valid JSON array of 3 suggestions
const mockPromptFn = async (prompt: string, opts?: any) => {
  // Basic assertion: prompt contains schema and 'Return JSON only.'
  if (!prompt.includes('Return JSON only')) throw new Error('prompt missing')

  const out = [
    {
      suggestion: 'unsweetened almond milk',
      substitutionRatio: 1.0,
      impactEstimate: { calories: 15, protein: 0.5, carbs: 0.3, fat: 1.2 },
      reason: 'lower calories and similar mouthfeel for many applications'
    },
    {
      suggestion: 'oat milk',
      substitutionRatio: 1.0,
      impactEstimate: { calories: 40, protein: 1.0, carbs: 6.0, fat: 1.5 },
      reason: 'neutral flavor and good body for baking'
    },
    {
      suggestion: 'coconut cream (diluted)',
      substitutionRatio: 0.5,
      impactEstimate: { calories: 200, protein: 1.0, carbs: 2.0, fat: 21 },
      reason: 'richness when preserved but use lower ratio'
    }
  ]

  return JSON.stringify(out)
}

test('builds a prompt and mock returns three suggestions in expected JSON format', async () => {
  const prompt = buildSubstitutionPrompt({ ingredient: 'milk', goal: 'make vegan', userAllergens: ['peanut'] })
  expect(prompt).toContain('make vegan')
  expect(prompt).toContain('Return JSON only')

  const res = await suggestSubstitutions({ ingredient: 'milk', goal: 'make vegan', userAllergens: ['peanut'] }, { promptFn: mockPromptFn })
  expect(res.length).toBe(3)
  for (const s of res) {
    expect(typeof s.suggestion).toBe('string')
    expect(typeof s.substitutionRatio).toBe('number')
    expect(typeof s.impactEstimate.calories).toBe('number')
    expect(typeof s.reason).toBe('string')
  }
})
