// @vitest-environment happy-dom
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

// Integration test: simulate a page with JSON-LD, run contentScript extractor, run allergen detection with a mocked promptFn
// and render the Sidebar with the detection results.

describe('integration: extract recipe and render sidebar', () => {
  it('extracts recipe from JSON-LD, detects allergens and renders sidebar alerts', async () => {
    // prepare a minimal DOM with JSON-LD recipe
    const recipe = {
      '@context': 'http://schema.org',
      '@type': 'Recipe',
      'name': 'Almond Milk Pancakes',
      'recipeIngredient': ['1 cup almond milk', '2 cups flour', '1 tbsp butter'],
      'recipeInstructions': ['Mix ingredients', 'Cook on griddle']
    }

    document.body.innerHTML = `<script type="application/ld+json">${JSON.stringify(recipe)}</script>`

    // import the content script after DOM is ready — it will run extraction and attach to window.__EATWELL_RECIPE
    await import('../../contentScript')

    const extracted = (window as any).__EATWELL_RECIPE
    expect(extracted).toBeTruthy()
    expect(extracted.title).toBe('Almond Milk Pancakes')
    expect(extracted.ingredientsRaw.length).toBeGreaterThan(0)

    // canonicalize ingredients
    const { canonicalizeIngredient } = await import('../../utils/canonicalizeIngredient')
    const canonical = extracted.ingredientsRaw.map((line: string) => canonicalizeIngredient(line).canonicalName)

    // mock detectAllergens to avoid network/model calls
    const { detectAllergens } = await import('../../utils/detectAllergens')
    const promptFn = async (prompt: string) => {
      // return a deterministic JSON response indicating almond milk -> nuts
      return JSON.stringify({ matches: [ { ingredient: 'almond milk', allergen: 'nuts', confidence: 98, reason: 'almond is a tree nut' } ], safe: false })
    }

    const det = await detectAllergens(canonical, [], { promptFn })
    expect(det.result).toBeTruthy()
    expect(det.result?.matches.length).toBeGreaterThan(0)

    // render Sidebar with alerts
    const Sidebar = (await import('../../sidebar/Sidebar')).default
    const alerts = det.result!.matches.map(m => ({ ingredient: m.ingredient, allergen: m.allergen, confidence: m.confidence, reason: m.reason }))

    const { container } = render(<Sidebar state="ready" title={extracted.title} alerts={alerts as any} />)

    // ensure UI displays the allergen alert
    await waitFor(() => {
      expect(screen.getByText('nuts')).toBeTruthy()
      // look specifically for the alert list item by aria-label to avoid matching the title
      expect(screen.getByLabelText('Alert: nuts in almond milk')).toBeTruthy()
    })

    // snapshot for regression
    expect(container).toMatchSnapshot()
  })
})
