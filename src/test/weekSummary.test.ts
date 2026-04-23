import { describe, it, expect } from 'vitest'
import { computeWeekSummary } from '../lib/summaryUtils'
import { TimeBlock } from '../types'

const block = (status: TimeBlock['status'], mins: number): TimeBlock => ({
  id: crypto.randomUUID(),
  user_id: 'u',
  task_id: null,
  title: 'x',
  start_time: '2026-04-20T09:00:00Z',
  end_time: new Date(new Date('2026-04-20T09:00:00Z').getTime() + mins * 60000).toISOString(),
  type: 'soft',
  status,
  reminder_minutes: [],
  color: null,
  created_at: '',
})

describe('computeWeekSummary', () => {
  it('calculates total minutes', () => {
    const s = computeWeekSummary([block('planned', 60), block('completed', 30)])
    expect(s.totalMinutes).toBe(90)
  })
  it('counts statuses', () => {
    const s = computeWeekSummary([block('completed', 60), block('moved', 30), block('skipped', 30)])
    expect(s.completed).toBe(1)
    expect(s.moved).toBe(1)
    expect(s.skipped).toBe(1)
  })
  it('calculates completion rate', () => {
    const s = computeWeekSummary([block('completed', 60), block('moved', 60), block('skipped', 60)])
    expect(s.completionRate).toBeCloseTo(33.3, 0)
  })
  it('returns 0 rate when no actionable blocks', () => {
    const s = computeWeekSummary([block('planned', 60)])
    expect(s.completionRate).toBe(0)
  })
})
