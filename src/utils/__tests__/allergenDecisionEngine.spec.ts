import { expect, test } from 'vitest'
import { decideAllergens } from '../allergenDecisionEngine'

test('ontology-only detection produces ontology alert and unsafe overall', () => {
  const ingredients = ['peanut butter']
  const modelMatches: any[] = []
  const res = decideAllergens(ingredients, modelMatches, 'us')
  expect(res.alerts.length).toBeGreaterThan(0)
  const a = res.alerts[0]
  expect(a.source).toBe('ontology')
  expect(a.allergen).toBe('peanut')
  expect(a.confidence).toBeGreaterThanOrEqual(90)
  expect(res.overallSafety).toBe('unsafe')
})

test('model-only detection produces model alert and warning/unsafe based on confidence', () => {
  const ingredients = ['mystery sauce']
  const modelMatches = [
    { ingredient: 'mystery sauce', allergen: 'soy', confidence: 75, reason: 'model guessed soy from flavor profile' }
  ]
  const res = decideAllergens(ingredients, modelMatches)
  expect(res.alerts.length).toBe(1)
  const a = res.alerts[0]
  expect(a.source).toBe('model')
  expect(a.allergen).toBe('soy')
  expect(a.confidence).toBe(75)
  // confidence 75 should produce at least a warning
  expect(['warning', 'unsafe']).toContain(res.overallSafety)
})

test('combined ontology + model yields both source and elevated confidence', () => {
  const ingredients = ['almond milk']
  const modelMatches = [
    { ingredient: 'almond milk', allergen: 'tree-nut', confidence: 85, reason: 'model detected almond' }
  ]
  const res = decideAllergens(ingredients, modelMatches)
  expect(res.alerts.length).toBeGreaterThan(0)
  const a = res.alerts.find(x => x.allergen === 'tree-nut')!
  expect(a).toBeDefined()
  expect(a.source).toBe('both')
  // combined should be at least ontology confidence or model, capped at 100
  expect(a.confidence).toBeGreaterThanOrEqual(95)
  expect(res.overallSafety).toBe('unsafe')
})
