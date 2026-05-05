export interface Reminder {
  id: string
  blockId: string
  blockTitle: string
  body: string
  fireAt: number
}

export interface ReminderBlock {
  id: string
  title: string
  start_time: string       // ISO timestamp
  reminder_minutes: number[]
}

export function buildReminders(blocks: ReminderBlock[], now: number): Reminder[] {
  const reminders: Reminder[] = []
  for (const block of blocks) {
    for (const mins of block.reminder_minutes) {
      const fireAt = new Date(block.start_time).getTime() - mins * 60 * 1000
      if (fireAt > now) {
        reminders.push({
          id: `${block.id}-${mins}`,
          blockId: block.id,
          blockTitle: block.title,
          body: 'Starting soon',
          fireAt,
        })
      }
    }
    const startFireAt = new Date(block.start_time).getTime()
    if (startFireAt > now) {
      reminders.push({
        id: `${block.id}-start`,
        blockId: block.id,
        blockTitle: block.title,
        body: 'Starting now',
        fireAt: startFireAt,
      })
    }
  }
  return reminders
}
