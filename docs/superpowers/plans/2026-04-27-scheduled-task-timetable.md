# Scheduled Task Timetable Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user creates a "Scheduled task" from the Today page, it automatically creates a linked time block on the week timetable; a type picker lets them choose Normal vs Scheduled before the relevant form opens.

**Architecture:** Three changes — rename a label in `TaskModal`, create a new `ScheduledTaskModal` component, and update `TodayPage` to manage a four-state `taskMode` that drives a type picker plus two separate modals. No schema changes; the existing `tasks` and `time_blocks` tables support everything needed.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase via React Query (`@tanstack/react-query`)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/components/tasks/TaskModal.tsx` | Rename "Scheduled task" radio label to "Recurring" |
| Create | `src/components/tasks/ScheduledTaskModal.tsx` | Form for date-specific scheduled task (date, start, end, recurring toggle) |
| Modify | `src/pages/TodayPage.tsx` | Replace `showModal` bool with `taskMode` state; inline `TypePickerModal`; wire `createBlock`; add `handleCreateScheduledTask` |

---

## Task 1: Rename "Scheduled task" label to "Recurring" in TaskModal

**Files:**
- Modify: `src/components/tasks/TaskModal.tsx`

The current radio label for `value="daily"` reads "Scheduled task". Now that "Scheduled task" means something specific (the new date-specific modal), rename it to "Recurring" to avoid confusion in the week-view Tasks panel.

- [ ] **Step 1: Change the label text**

In `src/components/tasks/TaskModal.tsx`, find the radio label for the daily option (around line 60-70):

```tsx
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
```

Change `Scheduled task` to `Recurring`:

```tsx
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="task-type"
                value="daily"
                checked={type === 'daily'}
                onChange={() => setType('daily')}
                className="h-4 w-4 accent-indigo-600 focus:ring-2 focus:ring-indigo-500"
              />
              Recurring
            </label>
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/TaskModal.tsx
git commit -m "fix: rename Scheduled task radio to Recurring in TaskModal"
```

---

## Task 2: Create ScheduledTaskModal

**Files:**
- Create: `src/components/tasks/ScheduledTaskModal.tsx`

This modal handles date-specific scheduled task creation. Fields: title, date (default today), start time, end time, Repeats checkbox (reveals day-of-week picker when checked). Calls `onSave` with task payload + block payload. Does NOT close itself — the parent closes after both mutations succeed.

- [ ] **Step 1: Create the file**

Create `src/components/tasks/ScheduledTaskModal.tsx` with the following content:

```tsx
import { useState } from 'react'
import { Task } from '../../types'

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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
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
              className="h-4 w-4 accent-indigo-600"
            />
            Repeats
          </label>
          {repeats && (
            <div className="flex gap-1">
              {DAYS.map((d, i) => (
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
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/ScheduledTaskModal.tsx
git commit -m "feat: add ScheduledTaskModal with date, start/end time, and repeats"
```

---

## Task 3: Update TodayPage with type picker and scheduled task wiring

**Files:**
- Modify: `src/pages/TodayPage.tsx`

Replace the `showModal: boolean` state with `taskMode: null | 'pick' | 'normal' | 'scheduled'`. Add an inline `TypePickerModal` component, wire `createBlock` from `useTimeBlocks`, and add `handleCreateScheduledTask` that sequences `createTask` → `createBlock`.

- [ ] **Step 1: Replace the entire file**

The current `src/pages/TodayPage.tsx` is:

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
    try {
      await createTask(payload)
      setShowModal(false)
    } catch (e) {
      console.error('Failed to create task', e)
    }
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

Replace the entire file with:

```tsx
import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { NotificationBanner } from '../components/layout/NotificationBanner'
import { TodayTimeline } from '../components/dashboard/TodayTimeline'
import { TaskChecklist } from '../components/dashboard/TaskChecklist'
import { TaskModal } from '../components/tasks/TaskModal'
import { ScheduledTaskModal } from '../components/tasks/ScheduledTaskModal'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { Task, TimeBlock } from '../types'

type TaskMode = null | 'pick' | 'normal' | 'scheduled'

interface TypePickerModalProps {
  onNormal: () => void
  onScheduled: () => void
  onClose: () => void
}

function TypePickerModal({ onNormal, onScheduled, onClose }: TypePickerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xs rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">New task</h2>
        <div className="flex flex-col gap-3">
          <button type="button" className="btn-primary" onClick={onNormal}>Normal task</button>
          <button type="button" className="btn-primary" onClick={onScheduled}>Scheduled task</button>
        </div>
      </div>
    </div>
  )
}

export default function TodayPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock, createBlock } = useTimeBlocks(weekStart)
  const { tasks, createTask } = useTasks()
  const [taskMode, setTaskMode] = useState<TaskMode>(null)

  const todayBlocks = blocks.filter(b =>
    new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleStatusChange(id: string, status: TimeBlock['status']) {
    updateBlock({ id, status })
  }

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  async function handleCreateNormalTask(payload: Omit<Task, 'id' | 'user_id' | 'created_at'>) {
    try {
      await createTask(payload)
      setTaskMode(null)
    } catch (e) {
      console.error('Failed to create task', e)
    }
  }

  async function handleCreateScheduledTask(
    taskPayload: Omit<Task, 'id' | 'user_id' | 'created_at'>,
    blockPayload: { date: string; startTime: string; endTime: string }
  ) {
    try {
      const newTask = await createTask(taskPayload)
      // Use local-time constructor to avoid UTC midnight off-by-one in non-UTC timezones
      const startDate = new Date(`${blockPayload.date}T00:00:00`)
      const [startH, startM] = blockPayload.startTime.split(':').map(Number)
      startDate.setHours(startH, startM, 0, 0)
      const endDate = new Date(`${blockPayload.date}T00:00:00`)
      const [endH, endM] = blockPayload.endTime.split(':').map(Number)
      endDate.setHours(endH, endM, 0, 0)
      await createBlock({
        task_id: newTask.id,
        title: taskPayload.title,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        type: 'soft',
        status: 'planned',
        reminder_minutes: [],
        color: null,
      })
      setTaskMode(null)
    } catch (e) {
      console.error('Failed to create scheduled task', e)
    }
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
          onAddTask={() => setTaskMode('pick')}
        />
      </div>
      {taskMode === 'pick' && (
        <TypePickerModal
          onNormal={() => setTaskMode('normal')}
          onScheduled={() => setTaskMode('scheduled')}
          onClose={() => setTaskMode(null)}
        />
      )}
      {taskMode === 'normal' && (
        <TaskModal
          onSave={handleCreateNormalTask}
          onClose={() => setTaskMode(null)}
        />
      )}
      {taskMode === 'scheduled' && (
        <ScheduledTaskModal
          onSave={handleCreateScheduledTask}
          onClose={() => setTaskMode(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no TypeScript or build errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/TodayPage.tsx
git commit -m "feat: add type picker and ScheduledTaskModal wiring to TodayPage"
```

---

## Task 4: Smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the following manually**

**Type picker:**
- Navigate to `/app/today`
- Click "+ New task" in the TaskChecklist sidebar header
- A modal appears with two buttons: "Normal task" and "Scheduled task"
- Clicking the backdrop closes the picker without opening either modal

**Normal task flow:**
- Click "+ New task" → "Normal task"
- The existing task modal opens (title input, Normal task / Recurring radio buttons)
- Create a task — it appears in the Tasks panel on the week view
- Modal closes after save

**Scheduled task flow (non-recurring):**
- Click "+ New task" → "Scheduled task"
- `ScheduledTaskModal` opens with title, date (defaulted to today), start time, end time, Repeats checkbox
- Fill in all fields, leave Repeats unchecked, save
- Navigate to `/app` (week view) — a time block appears on today's column at the correct time with the task title
- Return to `/app/today` — the task appears in the Today's Tasks checklist (checkbox enabled)

**Scheduled task flow (recurring):**
- Click "+ New task" → "Scheduled task"
- Fill in title, date, start time, end time
- Check "Repeats" — the Sun–Sat day picker appears
- Select one or more days, save
- Week view shows a block for today (or the chosen date)
- The task appears in Today's checklist on any day matching the selected repeat days

**Empty title guard:**
- Open either modal, leave title blank, click Save — nothing happens, modal stays open

**Error resilience:**
- Modal stays open on save failure (tested by temporarily cutting network in DevTools)

- [ ] **Step 3: Run tests**

```bash
npm run build
```

Expected: build passes cleanly.

- [ ] **Step 4: Push to remote**

```bash
git push
```

Netlify will auto-deploy from the push.
