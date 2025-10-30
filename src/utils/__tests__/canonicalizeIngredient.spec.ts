import { describe, it, expect } from 'vitest'
import { canonicalizeIngredient } from '../canonicalizeIngredient'

describe('canonicalizeIngredient', () => {
  const cases: Array<[string, string]> = [
    ['2 cups Amul butter, softened', 'butter (dairy)'],
    ['1 (400g) Heinz diced tomatoes', 'diced tomatoes'],
    ['3 cloves garlic, minced', 'garlic'],
    ['Kraft cheddar cheese slice', 'cheddar cheese (dairy)'],
    ['organic brown rice', 'brown rice'],
    ['Salt and freshly ground black pepper, to taste', 'salt and freshly ground black pepper']
  ]

  for (const [input, expected] of cases) {
    it(`canonicalizes "${input}" => "${expected}"`, () => {
      const res = canonicalizeIngredient(input)
      expect(res.canonicalName).toBe(expected)
      // prompt should include one of the examples and the raw input
      expect(res.rewriterPrompt).toContain('Amul butter')
      expect(res.rewriterPrompt).toContain(input.replace(/"/g, ''))
    })
  }
})
