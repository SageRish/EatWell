import { describe, it, expect } from 'vitest'
import { normalizeIngredients } from '../src/utils/normalizeIngredients'

describe('normalizeIngredients', () => {
  it('removes HTML tags and parenthetical garnish notes', () => {
    const input = ['2 cups <b>all-purpose</b> flour (sifted)']
    const out = normalizeIngredients(input)
    expect(out).toEqual(['2 cups all-purpose flour'])
  })

  it('preserves parenthetical quantities', () => {
    const input = ['1 (14 ounce) can diced tomatoes, drained']
    const out = normalizeIngredients(input)
    expect(out).toEqual(['1 (14 ounce) can diced tomatoes, drained'])
  })

  it('removes trailing to taste notes', () => {
    const input = ['Salt and freshly ground black pepper, to taste']
    const out = normalizeIngredients(input)
    expect(out).toEqual(['Salt and freshly ground black pepper'])
  })

  it('removes parenthetical for garnish', () => {
    const input = ['1/2 cup chopped parsley (for garnish)']
    const out = normalizeIngredients(input)
    expect(out).toEqual(['1/2 cup chopped parsley'])
  })

  it('removes bullets and trims', () => {
    const input = ['• 4 cloves garlic, minced']
    const out = normalizeIngredients(input)
    expect(out).toEqual(['4 cloves garlic, minced'])
  })
})
