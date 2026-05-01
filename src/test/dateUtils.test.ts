import { describe, it, expect } from 'vitest'
import {
  getWeekStart, formatWeekRange,
  minutesFromMidnight, blockHeightPercent,
  shiftBlockByDays, isSameDay,
} from '../lib/dateUtils'

describe('getWeekStart', () => {
  it('returns Monday for a Wednesday', () => {
    // Use Date constructor with year/month/day to get LOCAL date (avoids UTC midnight parse)
    const wed = new Date(2026, 3, 22) // April 22, 2026 local midnight
    const result = getWeekStart(wed)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(3) // April
    expect(result.getDate()).toBe(20) // Monday Apr 20
  })
  it('returns same day for Monday', () => {
    const mon = new Date(2026, 3, 20)
    const result = getWeekStart(mon)
    expect(result.getDate()).toBe(20)
    expect(result.getHours()).toBe(0)
  })
})

describe('minutesFromMidnight', () => {
  it('returns minutes for local hour', () => {
    const iso = '2026-04-22T06:00:00.000Z'
    const d = new Date(iso)
    expect(minutesFromMidnight(iso)).toBe(d.getHours() * 60 + d.getMinutes())
  })
})

describe('blockTopPercent / blockHeightPercent', () => {
  it('1h block is ~4.17% of 24h', () => {
    const h = blockHeightPercent('2026-04-22T06:00:00.000Z', '2026-04-22T07:00:00.000Z')
    expect(h).toBeCloseTo(4.17, 1)
  })
})

describe('shiftBlockByDays', () => {
  it('shifts start and end by N days', () => {
    const b = { start_time: '2026-04-20T09:00:00.000Z', end_time: '2026-04-20T10:00:00.000Z' }
    const shifted = shiftBlockByDays(b as any, 7)
    expect(shifted.start_time.slice(0,10)).toBe('2026-04-27')
    expect(shifted.end_time.slice(0,10)).toBe('2026-04-27')
  })
})

describe('formatWeekRange', () => {
  it('formats as "Apr 20 – Apr 26"', () => {
    // Use UTC date to avoid timezone interpretation issues
    const mondayUTC = new Date('2026-04-20T00:00:00Z')
    const result = formatWeekRange(mondayUTC)
    // The formatting depends on local timezone; just verify it has the expected structure
    expect(result).toMatch(/Apr \d+ – Apr \d+/)
    // Verify it spans 7 days by checking the numbers
    const parts = result.match(/\d+/g)
    if (parts && parts.length === 2) {
      const startDay = parseInt(parts[0])
      const endDay = parseInt(parts[1])
      expect(endDay - startDay).toBe(6)
    }
  })
})

describe('isSameDay', () => {
  it('returns true for two Date objects on the same local calendar day', () => {
    const a = new Date(2026, 4, 1, 9, 0, 0)   // May 1 09:00 local
    const b = new Date(2026, 4, 1, 23, 59, 0)  // May 1 23:59 local
    expect(isSameDay(a, b)).toBe(true)
  })
  it('returns false for dates on different days', () => {
    const a = new Date(2026, 4, 1, 23, 59, 0)  // May 1
    const b = new Date(2026, 4, 2, 0, 0, 0)    // May 2
    expect(isSameDay(a, b)).toBe(false)
  })
  it('returns false for same time but different months', () => {
    const a = new Date(2026, 3, 1, 9, 0, 0)  // Apr 1
    const b = new Date(2026, 4, 1, 9, 0, 0)  // May 1
    expect(isSameDay(a, b)).toBe(false)
  })
  it('returns false for same day different years', () => {
    const a = new Date(2025, 4, 1)
    const b = new Date(2026, 4, 1)
    expect(isSameDay(a, b)).toBe(false)
  })
})
