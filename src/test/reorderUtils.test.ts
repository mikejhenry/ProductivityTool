import { describe, it, expect } from 'vitest'
import { reorderByIds } from '../lib/reorderUtils'

describe('reorderByIds', () => {
  it('reorders items to match orderedIds', () => {
    const items = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]
    const result = reorderByIds(items, ['c', 'a', 'b'])
    expect(result.map(i => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('preserves the full item object (not just id)', () => {
    const items = [{ id: 'x', value: 42 }, { id: 'y', value: 99 }]
    const result = reorderByIds(items, ['y', 'x'])
    expect(result[0]).toEqual({ id: 'y', value: 99 })
    expect(result[1]).toEqual({ id: 'x', value: 42 })
  })

  it('filters out ids not present in items', () => {
    const items = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    const result = reorderByIds(items, ['b', 'unknown', 'a'])
    expect(result.map(i => i.id)).toEqual(['b', 'a'])
  })

  it('returns empty array when items is empty', () => {
    const result = reorderByIds([], ['a', 'b'])
    expect(result).toEqual([])
  })

  it('returns empty array when orderedIds is empty', () => {
    const items = [{ id: 'a', name: 'A' }]
    const result = reorderByIds(items, [])
    expect(result).toEqual([])
  })
})
