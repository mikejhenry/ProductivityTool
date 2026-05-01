# Task Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace block-based checkbox state in `TaskChecklist` and `DailyPanel` with task-level `completed_at` — checkboxes always enabled, strikethrough on check, cross-panel sync via shared React Query cache.

**Architecture:** A single `completed_at: timestamptz` column on the `tasks` table drives done state for both task types. Flexible tasks are done when the field is non-null; daily routines are done when it matches today's date (auto-resets overnight). A new `toggleTask` mutation in `useTasks` writes the field optimistically.

**Tech Stack:** React, TypeScript, Tailwind CSS, @tanstack/react-query, Supabase, Vitest

---

## File Structure

| Action | File | Change |
|---|---|---|
| Modify | `src/lib/dateUtils.ts` | Add `isSameDay(a, b)` |
| Modify | `src/test/dateUtils.test.ts` | Add `isSameDay` tests |
| Modify | `src/types/index.ts` | Add `completed_at: string \| null` to `Task` |
| Modify | `src/hooks/useTasks.ts` | Add `toggleTask` mutation with optimistic update |
| Modify | `src/components/dashboard/TaskChecklist.tsx` | Task-based done state, always-enabled checkbox |
| Modify | `src/components/daily/DailyPanel.tsx` | Task-based done state, remove `todayBlocks` prop |
| Modify | `src/pages/TodayPage.tsx` | Use `toggleTask`, remove `todayBlocks` from DailyPanel |
| Modify | `src/pages/DailyPage.tsx` | Use `toggleTask`, remove `todayBlocks` from DailyPanel |

---

## Codebase Context (read before implementing any task)

**Key types** (`src/types/index.ts`):
```ts
interface Task {
  id: string; user_id: string; title: string
  type: 'daily' | 'flexible'
  preferred_time: string | null  // "HH:MM:SS"
  repeat_days: number[]
  created_at: string
  // completed_at added in Task 2
}
```

**`useTasks()` hook** (`src/hooks/useTasks.ts`): returns `{ tasks, createTask, updateTask, deleteTask }`. All mutations use `mutateAsync`. Cache key is `['tasks', uid]`.

**`isSameDay` logic:** two dates are the same day if they share year, month, and date — regardless of time zone offset. Use local-time getters (`getFullYear`, `getMonth`, `getDate`).

**CSS classes** (`src/index.css`): `.btn-primary`, `.btn-ghost`, `.input`

---

## Task 1: `isSameDay` utility + tests

**Files:**
- Modify: `src/lib/dateUtils.ts`
- Modify: `src/test/dateUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `src/test/dateUtils.test.ts`. Add at the end of the file:

```ts
describe('isSameDay', () => {
  it('returns true for two Date objects on the same local calendar day', () => {
    const a = new Date(2026, 4, 1, 9, 0, 0)   // May 1 09:00 local
    const b = new Date(2026, 4, 1, 23, 59, 0)  // May 1 23:59 local
    expect(isSameDay(a, b)).toBe(true)
  })
  it('returns false for dates on different days', () => {
    const a = new Date(2026, 4, 1, 23, 59, 0)  // May 1
    const b = new Date(2026, 4, 2, 0, 0, 0)    // May 2
    expect(isSameDay(a, b)).toBe(false)
  })
  it('returns false for same time but different months', () => {
    const a = new Date(2026, 3, 1, 9, 0, 0)  // Apr 1
    const b = new Date(2026, 4, 1, 9, 0, 0)  // May 1
    expect(isSameDay(a, b)).toBe(false)
  })
  it('returns false for same day different years', () => {
    const a = new Date(2025, 4, 1)
    const b = new Date(2026, 4, 1)
    expect(isSameDay(a, b)).toBe(false)
  })
})
```

Also add `isSameDay` to the import at the top of the test file:
```ts
import {
  getWeekStart, formatWeekRange,
  minutesFromMidnight, blockHeightPercent,
  shiftBlockByDays, isSameDay,
} from '../lib/dateUtils'
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npm test
```

Expected: 4 new failures — `isSameDay is not a function` (or similar).

- [ ] **Step 3: Implement `isSameDay`**

Add at the end of `src/lib/dateUtils.ts`:

```ts
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
```

- [ ] **Step 4: Run tests and confirm all pass**

```bash
npm test
```

Expected: 18 tests pass (14 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dateUtils.ts src/test/dateUtils.test.ts
git commit -m "feat: add isSameDay utility"
```

---

## Task 2: DB column + `completed_at` type + `toggleTask` mutation

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useTasks.ts`

**DB prerequisite (manual step — do this before writing any code):**

In the Supabase dashboard SQL editor, run:
```sql
ALTER TABLE tasks ADD COLUMN completed_at timestamptz DEFAULT null;
```

No migration file exists in this project — schema changes are applied directly.

- [ ] **Step 1: Add `completed_at` to the `Task` interface**

In `src/types/index.ts`, find the `Task` interface and add `completed_at`:

```ts
export interface Task {
  id: string
  user_id: string
  title: string
  type: 'daily' | 'flexible'
  preferred_time: string | null  // "HH:MM:SS"
  repeat_days: number[]          // 0=Sun…6=Sat
  completed_at: string | null    // ISO timestamp; null = not done
  created_at: string
}
```

- [ ] **Step 2: Add `toggleTask` mutation to `useTasks`**

In `src/hooks/useTasks.ts`, add the mutation before the `return` statement. The full addition:

```ts
const toggleTask = useMutation({
  mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
    const patch = { completed_at: done ? new Date().toISOString() : null }
    const { error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .eq('user_id', uid!)
    if (error) throw error
  },
  onMutate: async ({ id, done }) => {
    await qc.cancelQueries({ queryKey: key })
    const previous = qc.getQueryData<Task[]>(key)
    qc.setQueryData<Task[]>(key, old =>
      old?.map(t =>
        t.id === id
          ? { ...t, completed_at: done ? new Date().toISOString() : null }
          : t
      ) ?? []
    )
    return { previous }
  },
  onError: (_err, _vars, ctx) => {
    if (ctx?.previous) qc.setQueryData(key, ctx.previous)
  },
  onSettled: () => qc.invalidateQueries({ queryKey: key }),
})
```

Add `toggleTask: toggleTask.mutateAsync` to the return object:

```ts
return {
  tasks,
  createTask: createTask.mutateAsync,
  updateTask: updateTask.mutateAsync,
  deleteTask: deleteTask.mutateAsync,
  toggleTask: toggleTask.mutateAsync,
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 18 tests pass — no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/hooks/useTasks.ts
git commit -m "feat: add completed_at to Task type and toggleTask mutation"
```

---

## Task 3: Update `TaskChecklist`

**Files:**
- Modify: `src/components/dashboard/TaskChecklist.tsx`

Replace the entire file contents:

```tsx
import { isSameDay } from '../../lib/dateUtils'
import { Task, TimeBlock } from '../../types'

interface Props {
  tasks: Task[]
  todayBlocks: TimeBlock[]
  onToggle: (taskId: string, done: boolean) => void
  onAddTask?: () => void
}

export function TaskChecklist({ tasks, todayBlocks, onToggle, onAddTask }: Props) {
  const today = new Date().getDay()
  const dailyTasks = tasks.filter(t => t.type === 'daily' && t.repeat_days.includes(today))
  const linkedTaskIds = new Set(todayBlocks.map(b => b.task_id).filter((id): id is string => id !== null))
  const linkedFlexible = tasks.filter(t => t.type === 'flexible' && linkedTaskIds.has(t.id))

  const isTaskDone = (task: Task) => {
    if (!task.completed_at) return false
    if (task.type === 'daily') return isSameDay(new Date(task.completed_at), new Date())
    return true
  }

  const allTasks = [...dailyTasks, ...linkedFlexible]

  return (
    <aside className="w-full overflow-y-auto border-t border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 md:w-64 md:border-l md:border-t-0 md:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Today's Tasks</h2>
        {onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-700"
          >
            + New task
          </button>
        )}
      </div>
      {allTasks.length === 0 && <p className="text-xs text-gray-400">No tasks for today.</p>}
      <div className="space-y-2">
        {allTasks.map(task => {
          const done = isTaskDone(task)
          return (
            <label key={task.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={done}
                onChange={e => onToggle(task.id, e.target.checked)}
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

Key changes from original:
- `onToggle` prop: `blockId` → `taskId`
- `isTaskDone`: block-based → `task.completed_at` + `isSameDay`
- Removed `blockForTask` helper (no longer needed)
- Checkbox: always enabled (removed `disabled={!block}`), calls `onToggle(task.id, ...)`

- [ ] **Step 1: Replace the file**

Write the file above to `src/components/dashboard/TaskChecklist.tsx`.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 18 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/TaskChecklist.tsx
git commit -m "feat: task-based completion in TaskChecklist"
```

---

## Task 4: Update `DailyPanel`

**Files:**
- Modify: `src/components/daily/DailyPanel.tsx`

Replace the entire file contents:

```tsx
import { isSameDay } from '../../lib/dateUtils'
import { Task } from '../../types'

interface Props {
  tasks: Task[]
  onToggle: (taskId: string, done: boolean) => void
  onAdd: () => void
  onEdit: (task: Task) => void
}

export function DailyPanel({ tasks, onToggle, onAdd, onEdit }: Props) {
  const dailyTasks = tasks.filter(t => t.type === 'daily')

  const isTaskDone = (task: Task) =>
    !!task.completed_at && isSameDay(new Date(task.completed_at), new Date())

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
          return (
            <div key={task.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={done}
                onChange={e => onToggle(task.id, e.target.checked)}
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

Key changes from original:
- Removed `todayBlocks: TimeBlock[]` prop entirely
- `onToggle` prop: `blockId` → `taskId`
- `isTaskDone`: uses `task.completed_at` + `isSameDay`
- Removed `blockForTask` helper
- Checkbox: always enabled, calls `onToggle(task.id, ...)`
- No `TimeBlock` import needed

- [ ] **Step 1: Replace the file**

Write the file above to `src/components/daily/DailyPanel.tsx`.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 18 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/daily/DailyPanel.tsx
git commit -m "feat: task-based completion in DailyPanel, remove todayBlocks prop"
```

---

## Task 5: Update `TodayPage` and `DailyPage`

**Files:**
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/DailyPage.tsx`

### `TodayPage` changes

- [ ] **Step 1: Read the current file**

```
src/pages/TodayPage.tsx
```

- [ ] **Step 2: Import `toggleTask` from `useTasks`**

Find the `useTasks` destructure line:
```ts
const { tasks, createTask, deleteTask } = useTasks()
```

Replace with:
```ts
const { tasks, createTask, deleteTask, toggleTask } = useTasks()
```

- [ ] **Step 3: Replace `handleToggle`**

Find:
```ts
function handleToggle(blockId: string, done: boolean) {
  updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
}
```

Replace with:
```ts
function handleToggle(taskId: string, done: boolean) {
  toggleTask({ id: taskId, done })
}
```

- [ ] **Step 4: Remove `todayBlocks` prop from `<DailyPanel>`**

Find the `<DailyPanel>` block in the JSX. It currently includes `todayBlocks={todayBlocks}`. Remove that prop:

```tsx
<DailyPanel
  tasks={tasks}
  onToggle={handleToggle}
  onAdd={() => setDailyModal({})}
  onEdit={task => setDailyModal({ task })}
/>
```

- [ ] **Step 5: Check for unused `updateBlock`**

If `updateBlock` is now only used by `handleStatusChange` (for TodayTimeline), leave it. If it is no longer used anywhere in the file, remove it from the `useTimeBlocks` destructure to avoid a TypeScript unused-variable warning.

`handleStatusChange` still uses `updateBlock`:
```ts
function handleStatusChange(id: string, status: TimeBlock['status']) {
  updateBlock({ id, status })
}
```
So `updateBlock` stays — no change needed here.

### `DailyPage` changes

- [ ] **Step 6: Read the current file**

```
src/pages/DailyPage.tsx
```

- [ ] **Step 7: Import `toggleTask`, remove `updateBlock`**

Find the `useTimeBlocks` destructure:
```ts
const { blocks, updateBlock } = useTimeBlocks(weekStart)
```

Replace with:
```ts
const { blocks } = useTimeBlocks(weekStart)
```

Find the `useTasks` destructure:
```ts
const { tasks } = useTasks()
```

Replace with:
```ts
const { tasks, toggleTask } = useTasks()
```

- [ ] **Step 8: Replace `handleToggle`**

Find:
```ts
function handleToggle(blockId: string, done: boolean) {
  updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
}
```

Replace with:
```ts
function handleToggle(taskId: string, done: boolean) {
  toggleTask({ id: taskId, done })
}
```

- [ ] **Step 9: Remove `todayBlocks` prop from `<DailyPanel>`**

Find the `<DailyPanel>` in the JSX. Remove `todayBlocks={todayBlocks}`:

```tsx
<DailyPanel
  tasks={tasks}
  onToggle={handleToggle}
  onAdd={() => setModal({})}
  onEdit={task => setModal({ task })}
/>
```

Since `todayBlocks` is no longer passed to DailyPanel, check if `todayBlocks` is still used elsewhere in `DailyPage`. If it is not used anywhere after removing it from the DailyPanel prop, remove the `todayBlocks` derivation:
```ts
// REMOVE this if todayBlocks is unused:
const todayBlocks = blocks.filter(
  b => new Date(b.start_time).toDateString() === new Date().toDateString()
)
```

And if `blocks` is also unused after that, remove it from the `useTimeBlocks` destructure too. If `blocks` is unused, the `useTimeBlocks(weekStart)` call can be removed entirely from DailyPage.

- [ ] **Step 10: Run tests**

```bash
npm test
```

Expected: 18 tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/pages/TodayPage.tsx src/pages/DailyPage.tsx
git commit -m "feat: wire toggleTask into TodayPage and DailyPage"
```
