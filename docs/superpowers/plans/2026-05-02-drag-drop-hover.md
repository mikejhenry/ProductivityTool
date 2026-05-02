# Drag-and-Drop Reordering & Hover CSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop reordering to TaskChecklist, DailyPanel, and ShoppingPage (unchecked items only), persisting order via a `sort_order` column in Supabase, plus hover-colour CSS on all interactive rows and timetable blocks.

**Architecture:** Install `@dnd-kit/sortable` on top of the existing `@dnd-kit/core`. Add a `reorderByIds` pure utility used by two new hook mutations (`reorderTasks`, `reorderItems`). Each list component wraps its rows in `DndContext` + `SortableContext`, calls the appropriate mutation on drag end with optimistic rollback on failure. Hover states are pure Tailwind classes.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, @dnd-kit/core (v6.3.1, already installed), @dnd-kit/sortable (to install), @tanstack/react-query, Supabase, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/reorderUtils.ts` | **Create** | Pure `reorderByIds` helper used in optimistic updates |
| `src/test/reorderUtils.test.ts` | **Create** | Unit tests for reorderByIds |
| `src/hooks/useTasks.ts` | **Modify** | Change order to `sort_order`; add `reorderTasks` mutation |
| `src/hooks/useShoppingItems.ts` | **Modify** | Change order to `sort_order`; add `reorderItems` mutation |
| `src/components/timetable/TimeBlock.tsx` | **Modify** | Add `hover:brightness-110 transition-[filter]` |
| `src/components/dashboard/TaskChecklist.tsx` | **Modify** | DnD wrapper, `SortableTaskRow`, hover CSS, `onReorder` prop |
| `src/components/daily/DailyPanel.tsx` | **Modify** | DnD wrapper, `SortableDailyRow`, hover CSS, `onReorder` prop |
| `src/pages/TodayPage.tsx` | **Modify** | Pass `onReorder` to TaskChecklist and DailyPanel |
| `src/pages/DailyPage.tsx` | **Modify** | Pass `onReorder` to DailyPanel |
| `src/pages/ShoppingPage.tsx` | **Modify** | DnD wrapper for unchecked items, `SortableShoppingRow`, hover CSS |

---

## Pre-flight: Supabase columns

Before starting tasks, add these columns in the Supabase dashboard SQL editor (or confirm they already exist):

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
```

---

### Task 1: Install @dnd-kit/sortable

**Files:**
- No source files modified

- [ ] **Step 1: Install the package**

```bash
npm install @dnd-kit/sortable
```

Expected output: `added 1 package` (or similar — it depends on @dnd-kit/core which is already installed)

- [ ] **Step 2: Verify the build still passes**

```bash
npm run build
```

Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @dnd-kit/sortable"
```

---

### Task 2: Add reorderByIds utility with tests

**Files:**
- Create: `src/lib/reorderUtils.ts`
- Create: `src/test/reorderUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/test/reorderUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { reorderByIds } from '../lib/reorderUtils'

describe('reorderByIds', () => {
  it('reorders items to match orderedIds', () => {
    const items = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]
    const result = reorderByIds(items, ['c', 'a', 'b'])
    expect(result.map(i => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('preserves the full item object (not just id)', () => {
    const items = [{ id: 'x', value: 42 }, { id: 'y', value: 99 }]
    const result = reorderByIds(items, ['y', 'x'])
    expect(result[0]).toEqual({ id: 'y', value: 99 })
    expect(result[1]).toEqual({ id: 'x', value: 42 })
  })

  it('filters out ids not present in items', () => {
    const items = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    const result = reorderByIds(items, ['b', 'unknown', 'a'])
    expect(result.map(i => i.id)).toEqual(['b', 'a'])
  })

  it('returns empty array when items is empty', () => {
    const result = reorderByIds([], ['a', 'b'])
    expect(result).toEqual([])
  })

  it('returns empty array when orderedIds is empty', () => {
    const items = [{ id: 'a', name: 'A' }]
    const result = reorderByIds(items, [])
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/test/reorderUtils.test.ts
```

Expected: FAIL — `Cannot find module '../lib/reorderUtils'`

- [ ] **Step 3: Create the utility**

Create `src/lib/reorderUtils.ts`:

```ts
/**
 * Reorders `items` to match the sequence given by `orderedIds`.
 * Items whose id is not in orderedIds are omitted.
 * Used by optimistic updates in useTasks and useShoppingItems.
 */
export function reorderByIds<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const map = new Map(items.map(item => [item.id, item]))
  return orderedIds
    .map(id => map.get(id))
    .filter((item): item is T => item !== undefined)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/test/reorderUtils.test.ts
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/reorderUtils.ts src/test/reorderUtils.test.ts
git commit -m "feat: add reorderByIds utility with tests"
```

---

### Task 3: Update useTasks — sort_order ordering + reorderTasks mutation

**Files:**
- Modify: `src/hooks/useTasks.ts`

- [ ] **Step 1: Replace the file with the updated version**

Replace the entire contents of `src/hooks/useTasks.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Task } from '../types'
import { reorderByIds } from '../lib/reorderUtils'

export function useTasks() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id
  const key = ['tasks', uid]

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', uid!)
        .order('sort_order')
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const createTask = useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'completed_at'>) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...task, user_id: uid! })
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      if (!uid) throw new Error('Not authenticated')
      const { error } = await supabase.from('tasks').update(patch).eq('id', id).eq('user_id', uid!)
      if (error) throw error
      if ('title' in patch) {
        const { error: blockError } = await supabase
          .from('time_blocks')
          .update({ title: patch.title })
          .eq('task_id', id)
          .eq('user_id', uid!)
        if (blockError) throw blockError
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['blocks'] })
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

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

  const reorderTasks = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('tasks')
            .update({ sort_order: index })
            .eq('id', id)
            .eq('user_id', uid!)
        )
      )
    },
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Task[]>(key)
      qc.setQueryData<Task[]>(key, old =>
        old ? reorderByIds(old, orderedIds) : []
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    tasks,
    createTask: createTask.mutateAsync,
    updateTask: updateTask.mutateAsync,
    deleteTask: deleteTask.mutateAsync,
    toggleTask: toggleTask.mutateAsync,
    reorderTasks: reorderTasks.mutateAsync,
  }
}
```

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTasks.ts
git commit -m "feat: add reorderTasks mutation and sort by sort_order in useTasks"
```

---

### Task 4: Update useShoppingItems — sort_order ordering + reorderItems mutation

**Files:**
- Modify: `src/hooks/useShoppingItems.ts`

- [ ] **Step 1: Replace the file with the updated version**

Replace the entire contents of `src/hooks/useShoppingItems.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ShoppingItem } from '../types'
import { reorderByIds } from '../lib/reorderUtils'

export function useShoppingItems() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id
  const key = ['shopping_items', uid]

  const { data: items = [], error: loadError } = useQuery<ShoppingItem[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('user_id', uid!)
        .order('sort_order')
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const addItem = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('shopping_items')
        .insert({ user_id: uid!, name, checked: false })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const toggleItem = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from('shopping_items')
        .update({ checked })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const clearDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('user_id', uid!)
        .eq('checked', true)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const reorderItems = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('shopping_items')
            .update({ sort_order: index })
            .eq('id', id)
            .eq('user_id', uid!)
        )
      )
    },
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<ShoppingItem[]>(key)
      qc.setQueryData<ShoppingItem[]>(key, old =>
        old ? reorderByIds(old, orderedIds) : []
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    items,
    loadError,
    addItem: addItem.mutateAsync,
    toggleItem: toggleItem.mutateAsync,
    deleteItem: deleteItem.mutateAsync,
    clearDone: clearDone.mutateAsync,
    reorderItems: reorderItems.mutateAsync,
  }
}
```

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useShoppingItems.ts
git commit -m "feat: add reorderItems mutation and sort by sort_order in useShoppingItems"
```

---

### Task 5: Add hover CSS to TimeBlock

**Files:**
- Modify: `src/components/timetable/TimeBlock.tsx`

Current outer `<div>` className (line 50):
```tsx
className={`absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded px-1.5 py-0.5 select-none ${isDaily ? '' : typeStyle} ${STATUS_STYLE[block.status]} ${textColor}`}
```

- [ ] **Step 1: Add hover and transition classes to the outer div**

Replace the className string on the outer `<div>` (line 50):

```tsx
className={`absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded px-1.5 py-0.5 select-none hover:brightness-110 transition-[filter] ${isDaily ? '' : typeStyle} ${STATUS_STYLE[block.status]} ${textColor}`}
```

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/timetable/TimeBlock.tsx
git commit -m "feat: add hover brightness effect to timetable TimeBlock"
```

---

### Task 6: Make TaskChecklist sortable with hover CSS + wire TodayPage

**Files:**
- Modify: `src/components/dashboard/TaskChecklist.tsx`
- Modify: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Replace TaskChecklist.tsx with the sortable version**

Replace the entire contents of `src/components/dashboard/TaskChecklist.tsx`:

```tsx
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { isSameDay } from '../../lib/dateUtils'
import { Task, TimeBlock } from '../../types'

interface Props {
  tasks: Task[]
  todayBlocks: TimeBlock[]
  onToggle: (taskId: string, done: boolean) => void
  onReorder: (orderedIds: string[]) => void
  onAddTask?: () => void
}

interface SortableTaskRowProps {
  task: Task
  done: boolean
  onToggle: (taskId: string, done: boolean) => void
}

function SortableTaskRow({ task, done, onToggle }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex cursor-default items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab px-1 text-gray-300 hover:text-gray-500 dark:text-slate-600 dark:hover:text-slate-400 select-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      <input
        type="checkbox"
        checked={done}
        onChange={e => onToggle(task.id, e.target.checked)}
        className="h-5 w-5 rounded border-gray-300 text-indigo-600 sm:h-4 sm:w-4"
      />
      <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
        {task.title}
      </span>
    </div>
  )
}

export function TaskChecklist({ tasks, todayBlocks, onToggle, onReorder, onAddTask }: Props) {
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = allTasks.findIndex(t => t.id === active.id)
    const newIndex = allTasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(allTasks, oldIndex, newIndex)
    onReorder(reordered.map(t => t.id))
  }

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
      <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
        <SortableContext items={allTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {allTasks.map(task => (
              <SortableTaskRow
                key={task.id}
                task={task}
                done={isTaskDone(task)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </aside>
  )
}
```

- [ ] **Step 2: Update TodayPage to wire onReorder**

In `src/pages/TodayPage.tsx`, make two changes:

**Change 1** — update the `useTasks` destructure (currently line 49):

```tsx
const { tasks, createTask, deleteTask, toggleTask, reorderTasks } = useTasks()
```

**Change 2** — add `onReorder` prop to `<TaskChecklist>` (currently around line 118–123):

```tsx
<TaskChecklist
  tasks={tasks}
  todayBlocks={todayBlocks}
  onToggle={handleToggle}
  onReorder={ids => reorderTasks(ids).catch(e => console.error('Failed to reorder tasks', e))}
  onAddTask={() => setTaskMode('pick')}
/>
```

- [ ] **Step 3: Run the build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/TaskChecklist.tsx src/pages/TodayPage.tsx
git commit -m "feat: add drag-and-drop reordering and hover CSS to TaskChecklist"
```

---

### Task 7: Make DailyPanel sortable with hover CSS + wire TodayPage + DailyPage

**Files:**
- Modify: `src/components/daily/DailyPanel.tsx`
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/DailyPage.tsx`

- [ ] **Step 1: Replace DailyPanel.tsx with the sortable version**

Replace the entire contents of `src/components/daily/DailyPanel.tsx`:

```tsx
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { isSameDay } from '../../lib/dateUtils'
import { Task } from '../../types'

interface Props {
  tasks: Task[]
  onToggle: (taskId: string, done: boolean) => void
  onReorder: (orderedIds: string[]) => void
  onAdd: () => void
  onEdit: (task: Task) => void
}

interface SortableDailyRowProps {
  task: Task
  done: boolean
  onToggle: (taskId: string, done: boolean) => void
  onEdit: (task: Task) => void
}

function SortableDailyRow({ task, done, onToggle, onEdit }: SortableDailyRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex cursor-default items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab px-1 text-gray-300 hover:text-gray-500 dark:text-slate-600 dark:hover:text-slate-400 select-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
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
}

export function DailyPanel({ tasks, onToggle, onReorder, onAdd, onEdit }: Props) {
  const dailyTasks = tasks.filter(t => t.type === 'daily')

  const isTaskDone = (task: Task) =>
    !!task.completed_at && isSameDay(new Date(task.completed_at), new Date())

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = dailyTasks.findIndex(t => t.id === active.id)
    const newIndex = dailyTasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(dailyTasks, oldIndex, newIndex)
    onReorder(reordered.map(t => t.id))
  }

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
      <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
        <SortableContext items={dailyTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {dailyTasks.map(task => (
              <SortableDailyRow
                key={task.id}
                task={task}
                done={isTaskDone(task)}
                onToggle={onToggle}
                onEdit={onEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </aside>
  )
}
```

- [ ] **Step 2: Update TodayPage to wire onReorder for DailyPanel**

In `src/pages/TodayPage.tsx`, update `<DailyPanel>` (currently around line 124–129):

```tsx
<DailyPanel
  tasks={tasks}
  onToggle={handleToggle}
  onReorder={ids => reorderTasks(ids).catch(e => console.error('Failed to reorder tasks', e))}
  onAdd={() => setDailyModal({})}
  onEdit={task => setDailyModal({ task })}
/>
```

(Note: `reorderTasks` is already destructured from `useTasks()` in Task 6 — no further change to the destructure needed.)

- [ ] **Step 3: Update DailyPage to wire onReorder**

In `src/pages/DailyPage.tsx`, make two changes:

**Change 1** — update the `useTasks` destructure (currently line 12):

```tsx
const { tasks, toggleTask, reorderTasks } = useTasks()
```

**Change 2** — add `onReorder` prop to `<DailyPanel>` (currently around line 24–29):

```tsx
<DailyPanel
  tasks={tasks}
  onToggle={handleToggle}
  onReorder={ids => reorderTasks(ids).catch(e => console.error('Failed to reorder tasks', e))}
  onAdd={() => setModal({})}
  onEdit={task => setModal({ task })}
/>
```

- [ ] **Step 4: Run the build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/daily/DailyPanel.tsx src/pages/TodayPage.tsx src/pages/DailyPage.tsx
git commit -m "feat: add drag-and-drop reordering and hover CSS to DailyPanel"
```

---

### Task 8: Make ShoppingPage unchecked items sortable with hover CSS

**Files:**
- Modify: `src/pages/ShoppingPage.tsx`

- [ ] **Step 1: Replace ShoppingPage.tsx with the sortable version**

Replace the entire contents of `src/pages/ShoppingPage.tsx`:

```tsx
import { useState } from 'react'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Navbar } from '../components/layout/Navbar'
import { useShoppingItems } from '../hooks/useShoppingItems'
import { ShoppingItem } from '../types'

interface SortableShoppingRowProps {
  item: ShoppingItem
  onToggle: (id: string, checked: boolean) => void
}

function SortableShoppingRow({ item, onToggle }: SortableShoppingRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-300 hover:text-gray-500 dark:text-slate-600 dark:hover:text-slate-400 select-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      <input
        type="checkbox"
        checked={false}
        onChange={() => onToggle(item.id, true)}
        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{item.name}</span>
    </li>
  )
}

export default function ShoppingPage() {
  const { items, loadError, addItem, toggleItem, deleteItem, clearDone, reorderItems } = useShoppingItems()
  const [input, setInput] = useState('')

  const unchecked = items.filter(i => !i.checked)
  const done = items.filter(i => i.checked)

  async function handleAdd() {
    const name = input.trim()
    if (!name) return
    await addItem(name).catch(e => console.warn('Failed to add item', e))
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd()
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = unchecked.findIndex(i => i.id === active.id)
    const newIndex = unchecked.findIndex(i => i.id === over.id)
    const reordered = arrayMove(unchecked, oldIndex, newIndex)
    reorderItems(reordered.map(i => i.id)).catch(e => console.error('Failed to reorder items', e))
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-6">

          {/* Error state */}
          {loadError && (
            <p className="mb-4 text-sm text-red-500 dark:text-red-400">Failed to load shopping list.</p>
          )}

          {/* Add input */}
          <div className="mb-6 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-gray-500"
              placeholder="Add an item..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {/* Unchecked items */}
          {unchecked.length === 0 && done.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Your shopping list is empty. Add an item above.
            </p>
          )}
          {unchecked.length > 0 && (
            <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
              <SortableContext items={unchecked.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1">
                  {unchecked.map(item => (
                    <SortableShoppingRow
                      key={item.id}
                      item={item}
                      onToggle={(id, checked) =>
                        toggleItem({ id, checked }).catch(e => console.warn('Failed to toggle item', e))
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {/* Done section */}
          {done.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Done</span>
                <button
                  onClick={() => clearDone().catch(e => console.warn('Failed to clear done', e))}
                  className="text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                >
                  Clear all
                </button>
              </div>
              <ul className="space-y-1">
                {done.map(item => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleItem({ id: item.id, checked: false }).catch(e => console.warn('Failed to toggle item', e))}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="flex-1 text-sm text-gray-400 line-through dark:text-gray-500">{item.name}</span>
                    <button
                      onClick={() => deleteItem(item.id).catch(e => console.warn('Failed to delete item', e))}
                      className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400"
                      title="Delete item"
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass (the new reorderUtils tests plus all existing tests).

- [ ] **Step 4: Commit**

```bash
git add src/pages/ShoppingPage.tsx
git commit -m "feat: add drag-and-drop reordering and hover CSS to ShoppingPage"
```

---

## Manual Smoke Test

After all tasks complete, open the dev server (`npm run dev`) and verify:

1. **TaskChecklist** — drag a task row up/down; order persists on page refresh
2. **DailyPanel (Today page)** — drag a daily routine; order matches DailyPanel on the `/app/daily` page
3. **DailyPage** — drag a daily routine; order matches Today page
4. **ShoppingPage** — drag an unchecked item; checked items have no drag handle; order persists on refresh
5. **Timetable blocks** — hover over a block; it brightens slightly
6. **Task rows** — hover over any task/daily row; background darkens subtly
7. **Dark mode** — repeat checks 5–6 with dark mode enabled
