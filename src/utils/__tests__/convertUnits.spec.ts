import { describe, it, expect } from 'vitest'
import convertUnits from '../convertUnits'

describe('convertUnits', () => {
  it('1 cup water -> 240 g', () => {
    const parsed = { quantity: 1, unit: 'cup', ingredientName: 'water' }
    const res = convertUnits(parsed)
    expect(res.grams).toBe(240)
    expect(res.uncertain).toBeFalsy()
  })

  it('1 cup flour -> ~127 g', () => {
    const parsed = { quantity: 1, unit: 'cup', ingredientName: 'all-purpose flour' }
    const res = convertUnits(parsed)
    expect(res.grams).toBe(127)
  })

  it('1 cup sugar -> ~204 g', () => {
    const parsed = { quantity: 1, unit: 'cup', ingredientName: 'granulated sugar' }
    const res = convertUnits(parsed)
    expect(res.grams).toBe(204)
  })

  it('2 tbsp butter -> ~28 g', () => {
    const parsed = { quantity: 2, unit: 'tbsp', ingredientName: 'butter' }
    const res = convertUnits(parsed)
    expect(res.grams).toBe(28)
  })

  it('1 cup uncooked rice -> ~185 g', () => {
    const parsed = { quantity: 1, unit: 'cup', ingredientName: 'rice' }
    const res = convertUnits(parsed)
    expect(res.grams).toBe(185)
  })

  it('1 cup cooked rice -> ~158 g', () => {
    const parsed = { quantity: 1, unit: 'cup', ingredientName: 'cooked rice' }
    const res = convertUnits(parsed)
    expect(res.grams).toBe(158)
  })

  it('unknown ingredient fallback returns ml and uncertain', () => {
    const parsed = { quantity: 1, unit: 'cup', ingredientName: 'mystery' }
    const res = convertUnits(parsed)
    expect(res.milliliters).toBe(240)
    expect(res.uncertain).toBeTruthy()
    expect(res.note).toMatch(/density unknown/i)
  })
})
