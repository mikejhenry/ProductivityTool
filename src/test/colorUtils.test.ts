import { describe, it, expect } from 'vitest'
import { hexToRgba } from '../lib/colorUtils'

describe('hexToRgba', () => {
  it('converts a 6-digit hex with # to rgba', () => {
    expect(hexToRgba('#6366f1', 0.25)).toBe('rgba(99,102,241,0.25)')
  })
  it('converts a 6-digit hex without # to rgba', () => {
    expect(hexToRgba('6366f1', 0.5)).toBe('rgba(99,102,241,0.5)')
  })
  it('returns the original string if the input is not valid hex', () => {
    expect(hexToRgba('not-a-color', 0.5)).toBe('not-a-color')
  })
  it('handles alpha = 1', () => {
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255,255,255,1)')
  })
})
