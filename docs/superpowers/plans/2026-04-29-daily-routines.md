# Daily Routines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Daily Routines feature — a shared panel visible on a new `/app/daily` page and as a third column on the Today page — where users manage recurring daily habits that optionally appear as semi-transparent time blocks in the week timetable.

**Architecture:** Daily items reuse the existing `tasks` table (`type: 'daily'`, `repeat_days: [0..6]`). A new shared `DailyPanel` component is mounted on both the Daily page and Today page; React Query's shared cache keeps them in sync automatically. Scheduled daily items auto-create 7 time blocks for the current week; those blocks render behind regular blocks at 25% opacity via a new `isDaily` prop on `TimeBlock`.

**Tech Stack:** React, TypeScript, Tailwind CSS, @tanstack/react-query, Supabase, Vitest

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/colorUtils.ts` | `hexToRgba` helper for transparent daily block colours |
| Create | `src/test/colorUtils.test.ts` | Unit tests for `hexToRgba` |
| Create | `src/components/daily/DailyPanel.tsx` | Shared daily routines list used on both Daily page and Today page |
| Create | `src/components/daily/DailyItemModal.tsx` | Add/edit/delete modal; owns task + block mutations |
| Create | `src/pages/DailyPage.tsx` | Page shell at `/app/daily` |
| Modify | `src/components/timetable/TimeBlock.tsx` | Add `isDaily` prop — transparent style, z-index 1, 🔁 prefix |
| Modify | `src/components/timetable/DayColumn.tsx` | Accept `dailyTaskIds`; pass `isDaily` to `TimeBlock`; suppress dashed overlay when real block exists |
| Modify | `src/components/timetable/TimetableGrid.tsx` | Build `dailyTaskIds` set; pass to each `DayColumn` |
| Modify | `src/components/layout/Navbar.tsx` | Add "Daily" nav link |
| Modify | `src/App.tsx` | Add `/app/daily` route |
| Modify | `src/components/dashboard/TodayTimeline.tsx` | Add empty-state UI + `onAddTask` prop |
| Modify | `src/pages/TodayPage.tsx` | Add `DailyPanel` third column + `DailyItemModal` |

---

## Codebase Context (read before implementing any task)

**Key types** (`src/types/index.ts`):
```ts
interface Task {
  id: string; user_id: string; title: string
  type: 'daily' | 'flexible'
  preferred_time: string | null  // "HH:MM:SS"
  repeat_days: number[]          // 0=Sun…6=Sat
  created_at: string
}
interface TimeBlock {
  id: string; user_id: string; task_id: string | null; title: string
  start_time: string; end_time: string
  type: 'soft' | 'hard'; status: 'planned'|'completed'|'moved'|'skipped'
  reminder_minutes: number[]; color: string | null; created_at: string
}
```

**Hooks:**
- `useTasks()` → `{ tasks, createTask, updateTask, deleteTask }` — all tasks, shared cache key `['tasks', uid]`
- `useTimeBlocks(weekStart)` → `{ blocks, createBlock, updateBlock, deleteBlock }` — blocks for the current week, cache key `['blocks', weekStart.toISOString()]`

**Utilities** (`src/lib/dateUtils.ts`): `addDays(date, n)` adds n days to a Date.

**CSS classes** (`src/index.css`): `.input`, `.btn-primary` (disabled:opacity-50), `.btn-ghost`

**Existing pattern for modal shells** (copy from `TaskModal`):
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
  <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
       role="dialog" aria-modal="true" aria-labelledby="modal-title"
       onClick={e => e.stopPropagation()}>
    ...
  </div>
</div>
```

**Existing pattern for aside panels** (copy from `TaskChecklist`):
```tsx
<aside className="w-full overflow-y-auto border-t border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 md:w-64 md:border-l md:border-t-0 md:p-4">
```

---

## Task 1: `hexToRgba` colour utility

**Files:**
- Create: `src/lib/colorUtils.ts`
- Create: `src/test/colorUtils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/colorUtils.test.ts
import { describe, it, expect } from 'vitest'
import { hexToRgba } from '../lib/colorUtils'

describe('hexToRgba', () => {
  it('converts a 6-digit hex with # to rgba', () => {
    expect(hexToRgba('#6366f1', 0.25)).toBe('rgba(99,102,241,0.25)')
  })
  it('converts a 6-digit hex without # to rgba', () => {
    expect(hexToRgba('6366f1', 0.5)).toBe('rgba(99,102,241,0.5)')
  })
  it('returns the original string if the input is not valid hex', () => {
    expect(hexToRgba('not-a-color', 0.5)).toBe('not-a-color')
  })
  it('handles alpha = 1', () => {
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255,255,255,1)')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npm test
```
Expected: 4 new failures — `hexToRgba` is not defined.

- [ ] **Step 3: Implement `hexToRgba`**

```ts
// src/lib/colorUtils.ts
export function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return hex
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r},${g},${b},${alpha})`
}
```

- [ ] **Step 4: Run the tests and confirm all pass**

```bash
npm test
```
Expected: 14 tests pass (10 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorUtils.ts src/test/colorUtils.test.ts
git commit -m "feat: add hexToRgba colour utility"
```

---

## Task 2: `TimeBlock` — isDaily visual treatment

**Files:**
- Modify: `src/components/timetable/TimeBlock.tsx`

Daily blocks render behind regular blocks with a transparent background and 🔁 prefix.

- [ ] **Step 1: Read the current file**

```
src/components/timetable/TimeBlock.tsx
```

Current Props interface:
```ts
interface Props {
  block: TBType
  topPercent: number
  heightPercent: number
  onEdit: (block: TBType) => void
}
```

Current style object uses `backgroundColor: block.color ?? '#6366f1'` and `zIndex: isDragging ? 50 : 10`.

- [ ] **Step 2: Replace the entire file with the updated version**

```tsx
// src/components/timetable/TimeBlock.tsx
import { useDraggable } from '@dnd-kit/core'
import { TimeBlock as TBType } from '../../types'
import { hexToRgba } from '../../lib/colorUtils'

const STATUS_STYLE: Record<string, string> = {
  planned: 'opacity-100',
  completed: 'opacity-60 line-through',
  moved: 'opacity-50 italic',
  skipped: 'opacity-40',
}

interface Props {
  block: TBType
  topPercent: number
  heightPercent: number
  isDaily?: boolean
  onEdit: (block: TBType) => void
}

export function TimeBlock({ block, topPercent, heightPercent, isDaily = false, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: { block },
  })

  const baseColor = block.color ?? '#6366f1'
  const bgColor = isDaily ? hexToRgba(baseColor, 0.25) : baseColor

  const style: React.CSSProperties = {
    top: `${topPercent}%`,
    height: `${Math.max(heightPercent, 1.5)}%`,
    minHeight: '20px',
    backgroundColor: bgColor,
    border: isDaily ? '1px dashed rgba(99,102,241,0.5)' : undefined,
    transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : isDaily ? 1 : 10,
  }

  const typeStyle = block.type === 'hard'
    ? 'border-l-4 border-l-white/60'
    : 'border-l-2 border-l-white/30'

  const textColor = isDaily ? 'text-indigo-700 dark:text-indigo-300' : 'text-white'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded px-1.5 py-0.5 select-none ${isDaily ? '' : typeStyle} ${STATUS_STYLE[block.status]} ${textColor}`}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onEdit(block)}
    >
      <p className="truncate text-xs font-medium leading-tight">
        {isDaily ? '🔁 ' : ''}{block.title}
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Run the tests**

```bash
npm test
```
Expected: 14 tests pass — no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/components/timetable/TimeBlock.tsx
git commit -m "feat: add isDaily visual treatment to TimeBlock"
```

---

## Task 3: `DayColumn` + `TimetableGrid` — wire up daily block detection

**Files:**
- Modify: `src/components/timetable/DayColumn.tsx`
- Modify: `src/components/timetable/TimetableGrid.tsx`

`TimetableGrid` builds a `Set<string>` of daily task IDs and passes it down. `DayColumn` uses it to set `isDaily` on each block and suppresses the dashed suggestion overlay when a real block already exists for that task.

- [ ] **Step 1: Update `DayColumn`**

Replace the Props interface and the two render sections (suggestion overlays + time blocks). Full updated file:

```tsx
// src/components/timetable/DayColumn.tsx
import { useDroppable } from '@dnd-kit/core'
import { TimeBlock as TBType, Task } from '../../types'
import { TimeBlock } from './TimeBlock'
import { blockTopPercent, blockHeightPercent, addDays } from '../../lib/dateUtils'

export const HOUR_HEIGHT = 60 // px per hour

interface Props {
  dayIndex: number
  weekStart: Date
  blocks: TBType[]
  dailyTasks: Task[]
  dailyTaskIds: Set<string>
  onEdit: (block: TBType) => void
  onCellClick: (startTime: Date) => void
}

export function DayColumn({ dayIndex, weekStart, blocks, dailyTasks, dailyTaskIds, onEdit, onCellClick }: Props) {
  const date = addDays(weekStart, dayIndex)
  const isToday = new Date().toDateString() === date.toDateString()
  const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
  const dayLabelShort = date.toLocaleDateString('en-US', { weekday: 'narrow' }) + ' ' + date.getDate()

  const { setNodeRef } = useDroppable({
    id: `day-${dayIndex}`,
    data: { dayIndex, date },
  })

  return (
    <div className="flex flex-col border-r border-gray-200 dark:border-slate-700 last:border-r-0 min-w-0">
      {/* Day header */}
      <div className={`sticky top-0 z-20 flex h-7 items-center justify-center border-b border-gray-200 bg-white text-center text-xs font-medium dark:border-slate-700 dark:bg-slate-900 sm:h-6 ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
        <span className="sm:hidden">{dayLabelShort}</span>
        <span className="hidden sm:inline">{dayLabel}</span>
      </div>

      {/* Hour grid */}
      <div ref={setNodeRef} className="relative flex-1">
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={hour}
            className="border-b border-gray-100 dark:border-slate-800"
            style={{ height: `${HOUR_HEIGHT}px` }}
            onClick={() => {
              const d = new Date(date)
              d.setHours(hour, 0, 0, 0)
              onCellClick(d)
            }}
          />
        ))}

        {/* Suggested overlays for daily tasks with preferred_time — hidden when a real block exists */}
        {dailyTasks
          .filter(t =>
            t.preferred_time &&
            t.repeat_days.includes(date.getDay()) &&
            !blocks.some(b => b.task_id === t.id)
          )
          .map(t => {
            const [h, m] = t.preferred_time!.split(':').map(Number)
            const topPct = ((h * 60 + m) / 1440) * 100
            return (
              <div
                key={t.id}
                className="absolute left-0.5 right-0.5 cursor-pointer rounded border border-dashed border-indigo-400 bg-indigo-50/60 px-1.5 py-0.5 dark:bg-indigo-900/20"
                style={{ top: `${topPct}%`, height: '4.17%', minHeight: '20px', zIndex: 5 }}
                onClick={(e) => {
                  e.stopPropagation()
                  const start = new Date(date)
                  start.setHours(h, m, 0, 0)
                  onCellClick(start)
                }}
              >
                <p className="truncate text-xs text-indigo-400">{t.title}</p>
              </div>
            )
          })}

        {/* Time blocks */}
        {blocks.map(block => {
          const startDay = new Date(block.start_time).toDateString()
          const endDay = new Date(block.end_time).toDateString()
          const isOvernightStart = startDay === date.toDateString() && endDay !== date.toDateString()
          const isOvernightEnd = startDay !== date.toDateString() && endDay === date.toDateString()

          const topPct = isOvernightEnd ? 0 : blockTopPercent(block.start_time)
          const rawHeight = blockHeightPercent(block.start_time, block.end_time)
          const minutesToEnd = isOvernightEnd
            ? new Date(block.end_time).getHours() * 60 + new Date(block.end_time).getMinutes()
            : 0
          const heightPct = isOvernightStart
            ? 100 - topPct
            : isOvernightEnd
            ? (minutesToEnd / 1440) * 100
            : rawHeight

          return (
            <TimeBlock
              key={block.id}
              block={block}
              topPercent={topPct}
              heightPercent={heightPct}
              isDaily={dailyTaskIds.has(block.task_id ?? '')}
              onEdit={onEdit}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `TimetableGrid` to build `dailyTaskIds` and pass it to `DayColumn`**

In `src/components/timetable/TimetableGrid.tsx`, find line:
```ts
const dailyTasks = tasks.filter(t => t.type === 'daily')
```

Replace with:
```ts
const dailyTasks = tasks.filter(t => t.type === 'daily')
const dailyTaskIds = new Set(tasks.filter(t => t.type === 'daily').map(t => t.id))
```

Then in the `DayColumn` JSX (inside the `.map`), add the new prop:
```tsx
<DayColumn
  key={i}
  dayIndex={i}
  weekStart={weekStart}
  blocks={blocksForDay(i)}
  dailyTasks={dailyTasks}
  dailyTaskIds={dailyTaskIds}
  onEdit={handleEditBlock}
  onCellClick={handleCellClick}
/>
```

- [ ] **Step 3: Run the tests**

```bash
npm test
```
Expected: 14 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/timetable/DayColumn.tsx src/components/timetable/TimetableGrid.tsx
git commit -m "feat: wire dailyTaskIds through timetable for transparent daily block rendering"
```

---

## Task 4: `DailyPanel` shared component

**Files:**
- Create: `src/components/daily/DailyPanel.tsx`

This component is mounted on both the Daily page and the Today page. It shows the list of daily routines, checkboxes for today, and exposes add/edit callbacks to the parent.

- [ ] **Step 1: Create the file**

```tsx
// src/components/daily/DailyPanel.tsx
import { Task, TimeBlock } from '../../types'

interface Props {
  tasks: Task[]
  todayBlocks: TimeBlock[]
  onToggle: (blockId: string, done: boolean) => void
  onAdd: () => void
  onEdit: (task: Task) => void
}

export function DailyPanel({ tasks, todayBlocks, onToggle, onAdd, onEdit }: Props) {
  const dailyTasks = tasks.filter(t => t.type === 'daily')

  const isTaskDone = (task: Task) =>
    todayBlocks.some(b => b.task_id === task.id && b.status === 'completed')

  const blockForTask = (task: Task) =>
    todayBlocks.find(b => b.task_id === task.id)

  return (
    <aside className="w-full overflow-y-auto border-t border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 md:w-64 md:border-l md:border-t-0 md:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Daily Routines</h2>
        <button
          type="button"
          onClick={onAdd}
          className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-700"
        >
          + Add
        </button>
      </div>
      {dailyTasks.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No daily routines yet. Add one to get started.
        </p>
      )}
      <div className="space-y-2">
        {dailyTasks.map(task => {
          const done = isTaskDone(task)
          const block = blockForTask(task)
          return (
            <div key={task.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={done}
                disabled={!block}
                onChange={e => block && onToggle(block.id, e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-indigo-600 sm:h-4 sm:w-4"
              />
              <button
                type="button"
                onClick={() => onEdit(task)}
                className={`flex-1 text-left text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}
              >
                {task.title}
              </button>
              {task.preferred_time && (
                <span className="shrink-0 text-xs text-indigo-500 dark:text-indigo-400">
                  {task.preferred_time.slice(0, 5)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Run the tests**

```bash
npm test
```
Expected: 14 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/daily/DailyPanel.tsx
git commit -m "feat: add shared DailyPanel component"
```

---

## Task 5: `DailyItemModal` — add/edit/delete with block management

**Files:**
- Create: `src/components/daily/DailyItemModal.tsx`

This modal owns its mutations directly. On save with a time it creates 7 time blocks (one per day of the current week). On edit where the time changes, it deletes existing blocks first then recreates them.

- [ ] **Step 1: Create the file**

```tsx
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
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      const start = new Date(day)
      start.setHours(h, m, 0, 0)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      await createBlock({
        task_id: taskId,
        title: taskTitle,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        type: 'soft',
        status: 'planned',
        reminder_minutes: [],
        color: null,
      })
    }
  }

  async function handleSave() {
    if (!title.trim()) return
    const preferredTime = scheduled && time ? `${time}:00` : null

    try {
      if (initial) {
        // Edit path
        await updateTask({ id: initial.id, title: title.trim(), preferred_time: preferredTime })
        const timeChanged = preferredTime !== initial.preferred_time
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
```

- [ ] **Step 2: Run the tests**

```bash
npm test
```
Expected: 14 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/daily/DailyItemModal.tsx
git commit -m "feat: add DailyItemModal with task and week block management"
```

---

## Task 6: `DailyPage`, route, and Navbar link

**Files:**
- Create: `src/pages/DailyPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Navbar.tsx`

- [ ] **Step 1: Create `DailyPage`**

```tsx
// src/pages/DailyPage.tsx
import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { DailyPanel } from '../components/daily/DailyPanel'
import { DailyItemModal } from '../components/daily/DailyItemModal'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { Task } from '../types'

export default function DailyPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock } = useTimeBlocks(weekStart)
  const { tasks } = useTasks()
  const [modal, setModal] = useState<{ task?: Task } | null>(null)

  const todayBlocks = blocks.filter(
    b => new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-lg overflow-y-auto p-4">
          <DailyPanel
            tasks={tasks}
            todayBlocks={todayBlocks}
            onToggle={handleToggle}
            onAdd={() => setModal({})}
            onEdit={task => setModal({ task })}
          />
        </div>
      </div>
      {modal !== null && (
        <DailyItemModal
          initial={modal.task}
          weekStart={weekStart}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the route in `src/App.tsx`**

Current imports in `App.tsx`:
```ts
import TodayPage from './pages/TodayPage'
import NotesPage from './pages/NotesPage'
```

Add after the `TodayPage` import:
```ts
import DailyPage from './pages/DailyPage'
```

Current routes include:
```tsx
<Route path="/app/today" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
```

Add immediately after it:
```tsx
<Route path="/app/daily" element={<ProtectedRoute><DailyPage /></ProtectedRoute>} />
```

- [ ] **Step 3: Add the "Daily" nav link in `src/components/layout/Navbar.tsx`**

Find the existing `isToday` and `isWeek` declarations:
```ts
const isToday = location.pathname === '/app/today'
const isWeek = location.pathname === '/app'
```

Add after them:
```ts
const isDaily = location.pathname === '/app/daily'
```

Find the Today link in the nav links row:
```tsx
<Link to="/app/today" className={`rounded px-3 py-1.5 text-sm ${isToday ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700'}`}>Today</Link>
<Link to="/app" className={`rounded px-3 py-1.5 text-sm ${isWeek ? ...`}>Week</Link>
```

Insert a "Daily" link between Today and Week:
```tsx
<Link
  to="/app/daily"
  className={`rounded px-3 py-1.5 text-sm ${isDaily ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700'}`}
>
  Daily
</Link>
```

- [ ] **Step 4: Run the tests**

```bash
npm test
```
Expected: 14 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DailyPage.tsx src/App.tsx src/components/layout/Navbar.tsx
git commit -m "feat: add Daily page, route, and navbar link"
```

---

## Task 7: `TodayPage` + `TodayTimeline` — third column and empty state

**Files:**
- Modify: `src/components/dashboard/TodayTimeline.tsx`
- Modify: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Update `TodayTimeline` to add `onAddTask` prop and empty-state UI**

Current `TodayTimeline` Props:
```ts
interface Props {
  blocks: TimeBlock[]
  onStatusChange: (id: string, status: TimeBlock['status']) => void
}
```

Replace the entire file:
```tsx
// src/components/dashboard/TodayTimeline.tsx
import { TimeBlock } from '../../types'

const STATUS_COLOR: Record<string, string> = {
  planned: 'border-indigo-400',
  completed: 'border-green-400',
  moved: 'border-amber-400',
  skipped: 'border-gray-300',
}

const STATUS_OPACITY: Record<string, string> = {
  planned: '',
  completed: 'opacity-60',
  moved: 'opacity-50',
  skipped: 'opacity-40',
}

interface Props {
  blocks: TimeBlock[]
  onStatusChange: (id: string, status: TimeBlock['status']) => void
  onAddTask?: () => void
}

export function TodayTimeline({ blocks, onStatusChange, onAddTask }: Props) {
  const now = new Date()
  const sorted = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time))

  const upcoming = sorted.filter(b =>
    new Date(b.start_time) > now &&
    new Date(b.start_time) <= new Date(now.getTime() + 2 * 60 * 60 * 1000)
  )

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {upcoming.length > 0 && (
        <div className="mb-4 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-900/30">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">Up next</p>
          <p className="font-semibold text-gray-900 dark:text-white">{upcoming[0].title}</p>
          <p className="text-sm text-gray-500">{fmt(upcoming[0].start_time)} – {fmt(upcoming[0].end_time)}</p>
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Nothing scheduled for today.</p>
          {onAddTask && (
            <button type="button" className="btn-primary" onClick={onAddTask}>
              + Schedule something
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(block => {
            const isPast = new Date(block.end_time) < now
            return (
              <div
                key={block.id}
                className={`flex items-start gap-3 rounded-lg border-l-4 bg-white p-3 shadow-sm dark:bg-slate-800 ${STATUS_COLOR[block.status]} ${STATUS_OPACITY[block.status] || (isPast && block.status === 'planned' ? 'opacity-60' : '')}`}
              >
                <div className="flex-1">
                  <p className={`font-medium text-gray-900 dark:text-white ${block.status === 'completed' ? 'line-through' : ''}`}>
                    {block.title}
                  </p>
                  <p className="text-xs text-gray-400">{fmt(block.start_time)} – {fmt(block.end_time)}</p>
                </div>
                <select
                  className="rounded border border-gray-200 bg-transparent text-xs dark:border-slate-600 dark:text-gray-300"
                  value={block.status}
                  onChange={e => onStatusChange(block.id, e.target.value as TimeBlock['status'])}
                >
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="moved">Moved</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `TodayPage` to add `DailyPanel` + `DailyItemModal`**

Replace the entire `src/pages/TodayPage.tsx`:

```tsx
// src/pages/TodayPage.tsx
import { useState, useEffect } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { NotificationBanner } from '../components/layout/NotificationBanner'
import { TodayTimeline } from '../components/dashboard/TodayTimeline'
import { TaskChecklist } from '../components/dashboard/TaskChecklist'
import { TaskModal } from '../components/tasks/TaskModal'
import { ScheduledTaskModal, BlockPayload } from '../components/tasks/ScheduledTaskModal'
import { DailyPanel } from '../components/daily/DailyPanel'
import { DailyItemModal } from '../components/daily/DailyItemModal'
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
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xs rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" role="dialog" aria-modal="true" aria-labelledby="picker-modal-title" onClick={e => e.stopPropagation()}>
        <h2 id="picker-modal-title" className="mb-4 text-lg font-bold text-gray-900 dark:text-white">New task</h2>
        <div className="flex flex-col gap-3">
          <button type="button" className="btn-primary" onClick={onNormal}>Normal task</button>
          <button type="button" className="btn-primary" onClick={onScheduled}>Scheduled task</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function TodayPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock, createBlock } = useTimeBlocks(weekStart)
  const { tasks, createTask, deleteTask } = useTasks()
  const [taskMode, setTaskMode] = useState<TaskMode>(null)
  const [dailyModal, setDailyModal] = useState<{ task?: Task } | null>(null)

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
    blockPayload: BlockPayload
  ) {
    let newTask: Task | undefined
    try {
      newTask = await createTask(taskPayload)
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
      if (newTask) {
        deleteTask(newTask.id).catch(re => console.error('Failed to rollback task', re))
      }
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <NotificationBanner blocks={blocks} />
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <TodayTimeline
          blocks={todayBlocks}
          onStatusChange={handleStatusChange}
          onAddTask={() => setTaskMode('pick')}
        />
        <TaskChecklist
          tasks={tasks}
          todayBlocks={todayBlocks}
          onToggle={handleToggle}
          onAddTask={() => setTaskMode('pick')}
        />
        <DailyPanel
          tasks={tasks}
          todayBlocks={todayBlocks}
          onToggle={handleToggle}
          onAdd={() => setDailyModal({})}
          onEdit={task => setDailyModal({ task })}
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
      {dailyModal !== null && (
        <DailyItemModal
          initial={dailyModal.task}
          weekStart={weekStart}
          onClose={() => setDailyModal(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run the tests**

```bash
npm test
```
Expected: 14 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/TodayTimeline.tsx src/pages/TodayPage.tsx
git commit -m "feat: add DailyPanel to Today page and empty-state button in timeline"
```

---

## Task 8: Manual smoke test

**Files:** none (browser verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the Daily page**

1. Click "Daily" in the navbar — should navigate to `/app/daily`
2. Click "+ Add" — `DailyItemModal` opens with "New daily routine" title
3. Enter a title (e.g. "Morning run"), leave Scheduled unchecked, save
4. Item appears in the list with no time badge; checkbox is disabled (no block for today)
5. Click the item to edit it — modal opens in edit mode showing "Edit routine"
6. Check "Scheduled", enter a time (e.g. 07:00), save
7. Item now shows `07:00` badge; checkbox is enabled (blocks created for today)
8. Navigate to Week view — confirm 7 semi-transparent 🔁 blocks appear at 7am across all 7 days
9. Create a regular time block at 7am on any day — confirm it renders on top of the daily block

- [ ] **Step 3: Verify cross-view sync**

1. On the Daily page, add a new scheduled routine "Evening walk" at 20:00
2. Navigate to Today — "Evening walk" appears in both the Daily Routines panel and the task list (if today is a matching day)
3. Check the checkbox on Today — navigate back to Daily — checkbox shows checked there too

- [ ] **Step 4: Verify Today empty state**

1. On Today, if there are no time blocks for today, the timeline shows "Nothing scheduled for today." and a "+ Schedule something" button
2. Click the button — the type picker modal opens (Normal task / Scheduled task)

- [ ] **Step 5: Verify delete**

1. Open an existing daily routine in the Daily page
2. Click Delete — the item and all its week blocks disappear from both Daily and Today views and the week timetable
