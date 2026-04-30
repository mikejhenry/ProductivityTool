// src/components/daily/DailyItemModal.tsx
import { useState, useEffect } from 'react'
import { Task } from '../../types'
import { useTasks } from '../../hooks/useTasks'
import { useTimeBlocks } from '../../hooks/useTimeBlocks'
import { addDays } from '../../lib/dateUtils'

interface Props {
  initial?: Task
  weekStart: Date
  onClose: () => void
}

export function DailyItemModal({ initial, weekStart, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [scheduled, setScheduled] = useState(!!initial?.preferred_time)
  const [time, setTime] = useState(initial?.preferred_time?.slice(0, 5) ?? '')

  const { createTask, updateTask, deleteTask } = useTasks()
  const { blocks, createBlock, deleteBlock } = useTimeBlocks(weekStart)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function getTaskBlocks(taskId: string) {
    return blocks.filter(b => b.task_id === taskId)
  }

  async function createWeekBlocks(taskId: string, taskTitle: string, timeStr: string) {
    const [h, m] = timeStr.split(':').map(Number)
    await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i)
        const start = new Date(day)
        start.setHours(h, m, 0, 0)
        const end = new Date(start.getTime() + 60 * 60 * 1000)
        return createBlock({
          task_id: taskId,
          title: taskTitle,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          type: 'soft',
          status: 'planned',
          reminder_minutes: [],
          color: null,
        })
      })
    )
  }

  async function handleSave() {
    if (!title.trim()) return
    const preferredTime = scheduled && time ? `${time}:00` : null

    try {
      if (initial) {
        // Edit path
        await updateTask({ id: initial.id, title: title.trim(), preferred_time: preferredTime })
        const normalizedOriginal = initial.preferred_time?.slice(0, 5) ?? null
        const normalizedNew = scheduled && time ? time : null
        const timeChanged = normalizedNew !== normalizedOriginal
        if (timeChanged) {
          const existing = getTaskBlocks(initial.id)
          await Promise.all(existing.map(b => deleteBlock(b.id)))
          if (preferredTime && time) {
            await createWeekBlocks(initial.id, title.trim(), time)
          }
        }
      } else {
        // Create path
        const newTask = await createTask({
          title: title.trim(),
          type: 'daily',
          repeat_days: [0, 1, 2, 3, 4, 5, 6],
          preferred_time: preferredTime,
        })
        if (preferredTime && time) {
          await createWeekBlocks(newTask.id, title.trim(), time)
        }
      }
      onClose()
    } catch (e) {
      console.error('Failed to save daily item', e)
    }
  }

  async function handleDelete() {
    if (!initial) return
    try {
      const existing = getTaskBlocks(initial.id)
      await Promise.all(existing.map(b => deleteBlock(b.id)))
      await deleteTask(initial.id)
      onClose()
    } catch (e) {
      console.error('Failed to delete daily item', e)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <h2
          id="daily-modal-title"
          className="mb-4 text-lg font-bold text-gray-900 dark:text-white"
        >
          {initial ? 'Edit routine' : 'New daily routine'}
        </h2>
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={scheduled}
              onChange={e => setScheduled(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            Scheduled
          </label>
          {scheduled && (
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                Time
              </label>
              <input
                className="input"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-between">
          {initial && (
            <button
              type="button"
              className="text-sm text-red-500 hover:underline"
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn-primary disabled:opacity-50"
              disabled={!title.trim()}
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
