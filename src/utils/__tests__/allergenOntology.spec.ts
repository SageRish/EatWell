import { expect, test } from 'vitest'
import { getAllergenForIngredient, getPrimaryAllergen, isAllergenIn } from '../allergenOntology'

test('lookup peanut butter -> peanut', () => {
  const cats = getAllergenForIngredient('Peanut Butter')
  expect(cats).toContain('peanut')
  expect(getPrimaryAllergen('peanut butter')).toBe('peanut')
  expect(isAllergenIn('peanut butter', 'peanut')).toBe(true)
})

test('lookup wheat flour -> gluten', () => {
  const cats = getAllergenForIngredient('wheat flour')
  expect(cats).toContain('gluten')
  expect(getPrimaryAllergen('wheat flour')).toBe('gluten')
  expect(isAllergenIn('wheat flour', 'gluten')).toBe(true)
})

test('lookup soy sauce -> soy (region synonyms)', () => {
  const cats = getAllergenForIngredient('soy sauce', 'us')
  expect(cats).toContain('soy')
  expect(getPrimaryAllergen('soy sauce', 'us')).toBe('soy')
  expect(isAllergenIn('soy sauce', 'soy', 'us')).toBe(true)
})
