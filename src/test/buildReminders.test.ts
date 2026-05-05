import { buildReminders } from '../lib/buildReminders'

// Fixed point in time so tests are deterministic
const NOW = 1_000_000_000_000

const futureBlock = {
  id: 'b1',
  title: 'Morning standup',
  start_time: new Date(NOW + 60 * 60 * 1000).toISOString(), // 1 hour from NOW
  reminder_minutes: [5, 15],
}

describe('buildReminders', () => {
  it('creates pre-event reminders with body "Starting soon"', () => {
    const reminders = buildReminders([futureBlock], NOW)
    const pre = reminders.filter(r => r.id !== 'b1-start')
    expect(pre).toHaveLength(2)
    expect(pre.every(r => r.body === 'Starting soon')).toBe(true)
  })

  it('creates a start-time reminder with body "Starting now"', () => {
    const reminders = buildReminders([futureBlock], NOW)
    const start = reminders.find(r => r.id === 'b1-start')
    expect(start).toBeDefined()
    expect(start!.body).toBe('Starting now')
  })

  it('start-time reminder fireAt equals block start_time in ms', () => {
    const reminders = buildReminders([futureBlock], NOW)
    const start = reminders.find(r => r.id === 'b1-start')
    expect(start!.fireAt).toBe(new Date(futureBlock.start_time).getTime())
  })

  it('start-time reminder has correct blockId and blockTitle', () => {
    const reminders = buildReminders([futureBlock], NOW)
    const start = reminders.find(r => r.id === 'b1-start')
    expect(start!.blockId).toBe('b1')
    expect(start!.blockTitle).toBe('Morning standup')
  })

  it('skips start-time reminder when block start_time is in the past', () => {
    const pastBlock = {
      id: 'b2',
      title: 'Past event',
      start_time: new Date(NOW - 1000).toISOString(), // 1 second ago
      reminder_minutes: [],
    }
    const reminders = buildReminders([pastBlock], NOW)
    expect(reminders.find(r => r.id === 'b2-start')).toBeUndefined()
  })

  it('creates start-time reminder even when reminder_minutes is empty', () => {
    const noPreBlock = {
      id: 'b3',
      title: 'No reminders',
      start_time: new Date(NOW + 30 * 60 * 1000).toISOString(),
      reminder_minutes: [],
    }
    const reminders = buildReminders([noPreBlock], NOW)
    expect(reminders).toHaveLength(1)
    expect(reminders[0].id).toBe('b3-start')
    expect(reminders[0].body).toBe('Starting now')
  })

  it('skips pre-event reminders whose fireAt is in the past', () => {
    const lateBlock = {
      id: 'b4',
      title: 'Almost started',
      // starts in 3 minutes — the 5-min reminder would be 2 minutes ago
      start_time: new Date(NOW + 3 * 60 * 1000).toISOString(),
      reminder_minutes: [5, 2],
    }
    const reminders = buildReminders([lateBlock], NOW)
    // 5-min reminder is in the past (NOW - 2 min), 2-min is future, start is future
    const ids = reminders.map(r => r.id)
    expect(ids).not.toContain('b4-5')
    expect(ids).toContain('b4-2')
    expect(ids).toContain('b4-start')
  })

  it('handles multiple blocks independently', () => {
    const block2 = {
      id: 'b5',
      title: 'Lunch',
      start_time: new Date(NOW + 2 * 60 * 60 * 1000).toISOString(),
      reminder_minutes: [10],
    }
    const reminders = buildReminders([futureBlock, block2], NOW)
    const startIds = reminders.filter(r => r.id.endsWith('-start')).map(r => r.blockId)
    expect(startIds).toContain('b1')
    expect(startIds).toContain('b5')
  })

  it('returns empty array for empty blocks input', () => {
    expect(buildReminders([], NOW)).toEqual([])
  })
})
