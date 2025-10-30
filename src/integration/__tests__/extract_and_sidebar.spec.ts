// Legacy placeholder to avoid duplicate test module during incremental edits.
// The real integration test lives in the TSX variant.
import { describe, it, expect } from 'vitest'

describe('placeholder integration shim', () => {
	it('noop', () => {
		expect(true).toBe(true)
	})
})
