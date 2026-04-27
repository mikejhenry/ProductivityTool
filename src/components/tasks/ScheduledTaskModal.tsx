import { useState } from 'react'
import { Task } from '../../types'
import { DAYS_OF_WEEK } from '../../lib/constants'

/**
 * Raw date/time strings. The parent is responsible for assembling ISO timestamps
 * from `date` + `startTime`/`endTime` before writing to the time_blocks table.
 * Format: date = 'YYYY-MM-DD', startTime/endTime = 'HH:MM' (24h, may be empty string)
 */
interface BlockPayload {
  date: string       // 'YYYY-MM-DD'
  startTime: string  // 'HH:MM'
  endTime: string    // 'HH:MM'
}

interface Props {
  onSave: (
    task: Omit<Task, 'id' | 'user_id' | 'created_at'>,
    block: BlockPayload
  ) => void | Promise<void>
  onClose: () => void
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ScheduledTaskModal({ onSave, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayString())
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [repeats, setRepeats] = useState(false)
  const [repeatDays, setRepeatDays] = useState<number[]>([])

  function toggleDay(d: number) {
    setRepeatDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function handleSave() {
    if (!title.trim()) return
    if (startTime && endTime && endTime <= startTime) return
    const task: Omit<Task, 'id' | 'user_id' | 'created_at'> = {
      title: title.trim(),
      type: repeats ? 'daily' : 'flexible',
      preferred_time: startTime ? `${startTime}:00` : null,
      repeat_days: repeats ? repeatDays : [],
    }
    onSave(task, { date, startTime, endTime })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Scheduled task</h2>
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Date</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Start time</label>
              <input
                className="input"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">End time</label>
              <input
                className="input"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={repeats}
              onChange={e => setRepeats(e.target.checked)}
              className="h-4 w-4 accent-indigo-600 focus:ring-2 focus:ring-indigo-500"
            />
            Repeats
          </label>
          {repeats && (
            <div className="flex gap-1" role="group" aria-label="Repeat days">
              {DAYS_OF_WEEK.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`flex-1 rounded py-1 text-xs font-medium ${
                    repeatDays.includes(i)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
