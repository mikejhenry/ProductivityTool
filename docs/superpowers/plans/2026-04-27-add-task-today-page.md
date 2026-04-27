# Add Task Button on Today Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "+ New task" button to the Today page's TaskChecklist that opens the TaskModal — modified to use radio buttons instead of a dropdown — so users can create tasks directly from the Today view.

**Architecture:** Three file changes, no new files, no schema changes. `TaskModal` gets a radio-button UI swap (flexible → "Normal task", daily → "Scheduled task"). `TaskChecklist` gains an optional `onAddTask` prop and renders a header button when provided. `TodayPage` adds modal open/close state and wires everything together using the already-exported `createTask` from `useTasks`.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/components/tasks/TaskModal.tsx` | Replace `<select>` with radio buttons |
| Modify | `src/components/dashboard/TaskChecklist.tsx` | Add `onAddTask?` prop + "+ New task" button in header |
| Modify | `src/pages/TodayPage.tsx` | Add modal state, wire `createTask`, pass `onAddTask` |

---

## Task 1: Replace select with radio buttons in TaskModal

**Files:**
- Modify: `src/components/tasks/TaskModal.tsx`

- [ ] **Step 1: Replace the `<select>` element with radio buttons**

Open `src/components/tasks/TaskModal.tsx`. The current file is:

```tsx
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
    onClose()
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
          <select className="input" value={type} onChange={e => setType(e.target.value as 'daily' | 'flexible')}>
            <option value="flexible">Flexible</option>
            <option value="daily">Daily</option>
          </select>
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
```

Replace the entire file with:

```tsx
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
    onClose()
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
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="task-type"
                value="flexible"
                checked={type === 'flexible'}
                onChange={() => setType('flexible')}
                className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
```

The only change is the `<select>` block replaced by the radio-button `<div className="flex gap-4">` block. Everything else is identical.

- [ ] **Step 2: Verify the app builds without errors**

```bash
npm run build
```

Expected: no TypeScript or build errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/TaskModal.tsx
git commit -m "feat: replace task type select with radio buttons in TaskModal"
```

---

## Task 2: Add "+ New task" button to TaskChecklist

**Files:**
- Modify: `src/components/dashboard/TaskChecklist.tsx`

- [ ] **Step 1: Add `onAddTask` prop and button to the header**

Open `src/components/dashboard/TaskChecklist.tsx`. The current file is:

```tsx
import { Task, TimeBlock } from '../../types'

interface Props {
  tasks: Task[]
  todayBlocks: TimeBlock[]
  onToggle: (blockId: string, done: boolean) => void
}

export function TaskChecklist({ tasks, todayBlocks, onToggle }: Props) {
  const today = new Date().getDay()
  const dailyTasks = tasks.filter(t => t.type === 'daily' && t.repeat_days.includes(today))
  const linkedTaskIds = new Set(todayBlocks.map(b => b.task_id).filter((id): id is string => id !== null))
  const linkedFlexible = tasks.filter(t => t.type === 'flexible' && linkedTaskIds.has(t.id))

  const isTaskDone = (task: Task) =>
    todayBlocks.some(b => b.task_id === task.id && b.status === 'completed')

  const blockForTask = (task: Task) => todayBlocks.find(b => b.task_id === task.id)

  const allTasks = [...dailyTasks, ...linkedFlexible]

  return (
    <aside className="w-full overflow-y-auto border-t border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 md:w-64 md:border-l md:border-t-0 md:p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Today's Tasks</h2>
      {allTasks.length === 0 && <p className="text-xs text-gray-400">No tasks for today.</p>}
      <div className="space-y-2">
        {allTasks.map(task => {
          const done = isTaskDone(task)
          const block = blockForTask(task)
          return (
            <label key={task.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={done}
                disabled={!block}
                onChange={e => block && onToggle(block.id, e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-indigo-600 sm:h-4 sm:w-4"
              />
              <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                {task.title}
              </span>
            </label>
          )
        })}
      </div>
    </aside>
  )
}
```

Replace the entire file with:

```tsx
import { Task, TimeBlock } from '../../types'

interface Props {
  tasks: Task[]
  todayBlocks: TimeBlock[]
  onToggle: (blockId: string, done: boolean) => void
  onAddTask?: () => void
}

export function TaskChecklist({ tasks, todayBlocks, onToggle, onAddTask }: Props) {
  const today = new Date().getDay()
  const dailyTasks = tasks.filter(t => t.type === 'daily' && t.repeat_days.includes(today))
  const linkedTaskIds = new Set(todayBlocks.map(b => b.task_id).filter((id): id is string => id !== null))
  const linkedFlexible = tasks.filter(t => t.type === 'flexible' && linkedTaskIds.has(t.id))

  const isTaskDone = (task: Task) =>
    todayBlocks.some(b => b.task_id === task.id && b.status === 'completed')

  const blockForTask = (task: Task) => todayBlocks.find(b => b.task_id === task.id)

  const allTasks = [...dailyTasks, ...linkedFlexible]

  return (
    <aside className="w-full overflow-y-auto border-t border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 md:w-64 md:border-l md:border-t-0 md:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Today's Tasks</h2>
        {onAddTask && (
          <button
            onClick={onAddTask}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            + New task
          </button>
        )}
      </div>
      {allTasks.length === 0 && <p className="text-xs text-gray-400">No tasks for today.</p>}
      <div className="space-y-2">
        {allTasks.map(task => {
          const done = isTaskDone(task)
          const block = blockForTask(task)
          return (
            <label key={task.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={done}
                disabled={!block}
                onChange={e => block && onToggle(block.id, e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-indigo-600 sm:h-4 sm:w-4"
              />
              <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                {task.title}
              </span>
            </label>
          )
        })}
      </div>
    </aside>
  )
}
```

Changes: `Props` gains `onAddTask?: () => void`; the `<h2>` is now inside a flex row with the "+ New task" button; button only renders when `onAddTask` is provided.

- [ ] **Step 2: Verify the app builds without errors**

```bash
npm run build
```

Expected: no TypeScript or build errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/TaskChecklist.tsx
git commit -m "feat: add onAddTask prop and New task button to TaskChecklist"
```

---

## Task 3: Wire up modal state in TodayPage

**Files:**
- Modify: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Add modal state and wire createTask**

Open `src/pages/TodayPage.tsx`. The current file is:

```tsx
import { Navbar } from '../components/layout/Navbar'
import { NotificationBanner } from '../components/layout/NotificationBanner'
import { TodayTimeline } from '../components/dashboard/TodayTimeline'
import { TaskChecklist } from '../components/dashboard/TaskChecklist'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { TimeBlock } from '../types'

export default function TodayPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock } = useTimeBlocks(weekStart)
  const { tasks } = useTasks()

  const todayBlocks = blocks.filter(b =>
    new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleStatusChange(id: string, status: TimeBlock['status']) {
    updateBlock({ id, status })
  }

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <NotificationBanner blocks={blocks} />
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <TodayTimeline blocks={todayBlocks} onStatusChange={handleStatusChange} />
        <TaskChecklist tasks={tasks} todayBlocks={todayBlocks} onToggle={handleToggle} />
      </div>
    </div>
  )
}
```

Replace the entire file with:

```tsx
import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { NotificationBanner } from '../components/layout/NotificationBanner'
import { TodayTimeline } from '../components/dashboard/TodayTimeline'
import { TaskChecklist } from '../components/dashboard/TaskChecklist'
import { TaskModal } from '../components/tasks/TaskModal'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { Task, TimeBlock } from '../types'

export default function TodayPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock } = useTimeBlocks(weekStart)
  const { tasks, createTask } = useTasks()
  const [showModal, setShowModal] = useState(false)

  const todayBlocks = blocks.filter(b =>
    new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleStatusChange(id: string, status: TimeBlock['status']) {
    updateBlock({ id, status })
  }

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  async function handleCreateTask(payload: Omit<Task, 'id' | 'user_id' | 'created_at'>) {
    await createTask(payload).catch(e => console.warn('Failed to create task', e))
    setShowModal(false)
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <NotificationBanner blocks={blocks} />
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <TodayTimeline blocks={todayBlocks} onStatusChange={handleStatusChange} />
        <TaskChecklist
          tasks={tasks}
          todayBlocks={todayBlocks}
          onToggle={handleToggle}
          onAddTask={() => setShowModal(true)}
        />
      </div>
      {showModal && (
        <TaskModal
          onSave={handleCreateTask}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
```

Changes: adds `useState` import; imports `TaskModal` and `Task`; destructures `createTask` from `useTasks()`; adds `showModal` state; adds `handleCreateTask`; passes `onAddTask` to `TaskChecklist`; renders `TaskModal` when `showModal` is true.

- [ ] **Step 2: Verify the app builds without errors**

```bash
npm run build
```

Expected: no TypeScript or build errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/TodayPage.tsx
git commit -m "feat: wire up New task modal on Today page"
```

---

## Task 4: Smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the following manually**

- Navigate to `/app/today`
- "Today's Tasks" sidebar shows a "+ New task" button in the top-right of its header
- Clicking "+ New task" opens the modal
- Modal shows title input, two radio buttons ("Normal task" selected by default, "Scheduled task" deselected)
- Selecting "Scheduled task" reveals the day-picker row (Sun–Sat buttons)
- Selecting "Normal task" hides the day-picker
- Preferred time field always visible below the day-picker (or its absence)
- Entering a title and clicking Save creates the task (verify in Supabase or by navigating to the Week view → Tasks panel)
- Clicking Cancel or the backdrop closes the modal without saving
- Save button with empty title does nothing (no error, no close)
- Dark mode looks correct

- [ ] **Step 3: Push to remote**

```bash
git push
```

Netlify will auto-deploy from the push.
