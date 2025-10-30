import { describe, it, expect } from 'vitest'
import { parseIngredient } from '../parseIngredient'

describe('parseIngredient', () => {
  it('1 1/2 cups all-purpose flour', () => {
    expect(parseIngredient('1 1/2 cups all-purpose flour')).toEqual({
      quantity: 1.5,
      unit: 'cup',
      ingredientName: 'all-purpose flour',
    })
  })

  it('½ cup sugar', () => {
    expect(parseIngredient('½ cup sugar')).toEqual({
      quantity: 0.5,
      unit: 'cup',
      ingredientName: 'sugar',
    })
  })

  it('1/4 tsp salt', () => {
    expect(parseIngredient('1/4 tsp salt')).toEqual({
      quantity: 0.25,
      unit: 'tsp',
      ingredientName: 'salt',
    })
  })

  it('2 tbsp olive oil', () => {
    expect(parseIngredient('2 tbsp olive oil')).toEqual({
      quantity: 2,
      unit: 'tbsp',
      ingredientName: 'olive oil',
    })
  })

  it('1 can (400g) diced tomatoes', () => {
    expect(parseIngredient('1 can (400g) diced tomatoes')).toEqual({
      quantity: 1,
      unit: 'piece',
      ingredientName: '(400g) diced tomatoes',
    })
  })

  it('a pinch of salt', () => {
    expect(parseIngredient('a pinch of salt')).toEqual({
      quantity: 1,
      unit: 'pinch',
      ingredientName: 'salt',
    })
  })

  it('Salt and freshly ground black pepper, to taste', () => {
    expect(parseIngredient('Salt and freshly ground black pepper, to taste')).toEqual({
      quantity: null,
      unit: null,
      ingredientName: 'Salt and freshly ground black pepper',
    })
  })

  it('3 cloves garlic, minced', () => {
    expect(parseIngredient('3 cloves garlic, minced')).toEqual({
      quantity: 3,
      unit: 'piece',
      ingredientName: 'garlic, minced',
    })
  })

  it('200 g butter', () => {
    expect(parseIngredient('200 g butter')).toEqual({
      quantity: 200,
      unit: 'g',
      ingredientName: 'butter',
    })
  })

  it('0.5 L milk', () => {
    expect(parseIngredient('0.5 L milk')).toEqual({
      quantity: 0.5,
      unit: 'l',
      ingredientName: 'milk',
    })
  })

  it('2-3 cups chopped nuts (range)', () => {
    expect(parseIngredient('2-3 cups chopped nuts')).toEqual({
      quantity: '2-3',
      unit: 'cup',
      ingredientName: 'chopped nuts',
    })
  })

  it('One large egg', () => {
    expect(parseIngredient('One large egg')).toEqual({
      quantity: 1,
      unit: null,
      ingredientName: 'large egg',
    })
  })

  it('250ml water', () => {
    expect(parseIngredient('250ml water')).toEqual({
      quantity: 250,
      unit: 'ml',
      ingredientName: 'water',
    })
  })

  it('3 oz cheddar cheese -> converted to g', () => {
    const parsed = parseIngredient('3 oz cheddar cheese')
    expect(parsed.unit).toBe('g')
    // approx 3 * 28.3495 = 85.0485 rounded to nearest g
    expect(parsed.quantity).toBe(85)
    expect(parsed.ingredientName).toBe('cheddar cheese')
  })

  it('1 tbsp chopped parsley (for garnish)', () => {
    expect(parseIngredient('1 tbsp chopped parsley (for garnish)')).toEqual({
      quantity: 1,
      unit: 'tbsp',
      ingredientName: 'chopped parsley (for garnish)',
    })
  })

  it('2 slices bread', () => {
    expect(parseIngredient('2 slices bread')).toEqual({
      quantity: 2,
      unit: 'slice',
      ingredientName: 'bread',
    })
  })

  it('¼ cup cocoa powder', () => {
    expect(parseIngredient('¼ cup cocoa powder')).toEqual({
      quantity: 0.25,
      unit: 'cup',
      ingredientName: 'cocoa powder',
    })
  })

  it('2 packages ramen noodles', () => {
    expect(parseIngredient('2 packages ramen noodles')).toEqual({
      quantity: 2,
      unit: 'piece',
      ingredientName: 'ramen noodles',
    })
  })

  it('500-600 g chicken', () => {
    expect(parseIngredient('500-600 g chicken')).toEqual({
      quantity: '500-600',
      unit: 'g',
      ingredientName: 'chicken',
    })
  })

  it('3¼ cups milk (unicode mixed fraction)', () => {
    expect(parseIngredient('3¼ cups milk')).toEqual({
      quantity: 3.25,
      unit: 'cup',
      ingredientName: 'milk',
    })
  })
})
