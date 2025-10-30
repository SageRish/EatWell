// @vitest-environment happy-dom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Sidebar from '../../sidebar/Sidebar'

describe('Sidebar component', () => {
  it('renders ready state with props and matches snapshot', () => {
    const onToggle = vi.fn()
    const alerts = [
      { ingredient: 'almond milk', allergen: 'nuts', confidence: 98, source: 'ontology' as const, reason: 'contains almond' }
    ]

    const { container } = render(
      <Sidebar
        state="ready"
        title="Test Recipe"
        summary={["Step 1", "Step 2"]}
        nutrition={{ calories: 420, fat: '10g', carbs: '50g', protein: '12g' }}
        alerts={alerts}
        privacyEnabled={true}
        onTogglePrivacy={onToggle}
      />
    )

    expect(screen.getByRole('complementary')).toBeTruthy()
    expect(screen.getByText('Test Recipe')).toBeTruthy()
    expect(screen.getByText('almond milk')).toBeTruthy()
    expect(screen.getByText('nuts')).toBeTruthy()
    // snapshot for UI stability
    expect(container).toMatchSnapshot()
  })
})
