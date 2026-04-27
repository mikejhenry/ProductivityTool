import { useState } from 'react'
import { Task } from '../../types'

interface Props {
  initial?: Partial<Task>
  onSave: (t: Omit<Task, 'id' | 'user_id' | 'created_at'>) => void
  onDelete?: () => void
  onClose: () => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function TaskModal({ initial, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<'daily' | 'flexible'>(initial?.type ?? 'flexible')
  const [preferredTime, setPreferredTime] = useState(initial?.preferred_time?.slice(0, 5) ?? '')
  const [repeatDays, setRepeatDays] = useState<number[]>(initial?.repeat_days ?? [])

  function toggleDay(d: number) {
    setRepeatDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function handleSave() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      type,
      preferred_time: preferredTime ? `${preferredTime}:00` : null,
      repeat_days: type === 'daily' ? repeatDays : [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
          {initial?.id ? 'Edit task' : 'New task'}
        </h2>
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          {/* Task type radio buttons */}
          <div className="flex gap-4" role="group" aria-label="Task type">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="task-type"
                value="flexible"
                checked={type === 'flexible'}
                onChange={() => setType('flexible')}
                className="h-4 w-4 accent-indigo-600 focus:ring-2 focus:ring-indigo-500"
              />
              Normal task
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="task-type"
                value="daily"
                checked={type === 'daily'}
                onChange={() => setType('daily')}
                className="h-4 w-4 accent-indigo-600 focus:ring-2 focus:ring-indigo-500"
              />
              Scheduled task
            </label>
          </div>
          {type === 'daily' && (
            <div className="flex gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={d}
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
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
              Preferred time (optional)
            </label>
            <input
              className="input"
              type="time"
              value={preferredTime}
              onChange={e => setPreferredTime(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          {onDelete && (
            <button className="text-sm text-red-500 hover:underline" onClick={onDelete}>Delete</button>
          )}
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
