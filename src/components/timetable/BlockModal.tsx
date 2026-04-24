import { useState } from 'react'
import { TimeBlock, Task } from '../../types'

interface Props {
  initial?: Partial<TimeBlock>
  tasks: Task[]
  onSave: (block: Omit<TimeBlock, 'id' | 'user_id' | 'created_at'>) => void
  onDelete?: () => void
  onClose: () => void
}

function toTimeInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function applyTime(iso: string, timeStr: string): string {
  const d = new Date(iso)
  const [h, m] = timeStr.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export function BlockModal({ initial, tasks, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<'soft' | 'hard'>(initial?.type ?? 'soft')
  const [color, setColor] = useState(initial?.color ?? '#6366f1')
  const [taskId, setTaskId] = useState<string>(initial?.task_id ?? '')
  const [reminders, setReminders] = useState<number[]>(initial?.reminder_minutes ?? [])
  const [reminderInput, setReminderInput] = useState('')
  const [startTime, setStartTime] = useState(toTimeInput(initial?.start_time))
  const [endTime, setEndTime] = useState(toTimeInput(initial?.end_time))

  function addReminder() {
    const val = parseInt(reminderInput)
    if (!isNaN(val) && val > 0 && !reminders.includes(val)) {
      setReminders(r => [...r, val].sort((a, b) => b - a))
    }
    setReminderInput('')
  }

  function handleSave() {
    if (!title.trim() || !initial?.start_time || !initial?.end_time || !startTime || !endTime) return
    onSave({
      title: title.trim(),
      type,
      color,
      task_id: taskId || null,
      start_time: applyTime(initial.start_time, startTime),
      end_time: applyTime(initial.end_time, endTime),
      status: initial?.status ?? 'planned',
      reminder_minutes: reminders,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
          {initial?.id ? 'Edit block' : 'New block'}
        </h2>
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Start</label>
              <input
                type="time"
                className="input"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">End</label>
              <input
                type="time"
                className="input"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select className="input flex-1" value={type} onChange={e => setType(e.target.value as 'soft' | 'hard')}>
              <option value="soft">Soft</option>
              <option value="hard">Hard</option>
            </select>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border border-gray-300"
            />
          </div>
          <select className="input" value={taskId} onChange={e => setTaskId(e.target.value)}>
            <option value="">No linked task</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              Reminders (minutes before)
            </p>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="number"
                placeholder="e.g. 15"
                value={reminderInput}
                onChange={e => setReminderInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addReminder()}
              />
              <button className="btn-primary" onClick={addReminder}>Add</button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {reminders.map(r => (
                <span
                  key={r}
                  className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200"
                >
                  {r}m
                  <button onClick={() => setReminders(rs => rs.filter(x => x !== r))}>×</button>
                </span>
              ))}
            </div>
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
