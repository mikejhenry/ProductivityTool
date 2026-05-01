# Task Completion — Design Spec
**Date:** 2026-05-01

## Overview

Replace the block-based done state in `TaskChecklist` and `DailyPanel` with task-level completion tracked via a `completed_at` timestamp on the `tasks` table. Checkboxes are always enabled (no longer gated on a time block existing). Cross-panel sync is automatic via the shared React Query cache.

---

## Data Layer

### Schema change

```sql
ALTER TABLE tasks ADD COLUMN completed_at timestamptz DEFAULT null;
```

No new tables. No migration files — apply in Supabase dashboard.

### Done-state derivation

| Task type | Done when |
|---|---|
| `'flexible'` | `completed_at IS NOT NULL` |
| `'daily'` | `completed_at IS NOT NULL` AND `date(completed_at) = today` |

Daily routines auto-reset overnight: tomorrow `isSameDay(completed_at, today)` returns false, so the checkbox appears unchecked without any explicit reset.

### `Task` type update

Add field to `src/types/index.ts`:

```ts
interface Task {
  id: string
  user_id: string
  title: string
  type: 'daily' | 'flexible'
  preferred_time: string | null
  repeat_days: number[]
  completed_at: string | null   // ← new
  created_at: string
}
```

---

## Hook Changes

### `useTasks` — new `toggleTask` mutation

Add to `src/hooks/useTasks.ts`:

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

Expose as `toggleTask: toggleTask.mutateAsync`.

---

## Utility

Add `isSameDay` to `src/lib/dateUtils.ts`:

```ts
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
```

---

## Component Changes

### `TaskChecklist` (`src/components/dashboard/TaskChecklist.tsx`)

**Props change:** `onToggle: (taskId: string, done: boolean) => void`
(was `blockId: string`)

**Done-state logic — replace:**
```ts
// REMOVE
const isTaskDone = (task: Task) =>
  todayBlocks.some(b => b.task_id === task.id && b.status === 'completed')
const blockForTask = (task: Task) => todayBlocks.find(b => b.task_id === task.id)
```

```ts
// ADD
const isTaskDone = (task: Task) => {
  if (!task.completed_at) return false
  if (task.type === 'daily') return isSameDay(new Date(task.completed_at), new Date())
  return true
}
```

**Checkbox — replace:**
```tsx
// REMOVE
<input
  type="checkbox"
  checked={done}
  disabled={!block}
  onChange={e => block && onToggle(block.id, e.target.checked)}
  ...
/>
```

```tsx
// ADD
<input
  type="checkbox"
  checked={done}
  onChange={e => onToggle(task.id, e.target.checked)}
  ...
/>
```

`todayBlocks` prop and `blockForTask` are no longer used for done state but `todayBlocks` is still passed (required by the parent's existing interface). Remove `blockForTask` entirely. Keep `linkedFlexible` filter unchanged — TaskChecklist still shows only flexible tasks that have a time block today.

### `DailyPanel` (`src/components/daily/DailyPanel.tsx`)

**Props change:** `onToggle: (taskId: string, done: boolean) => void`
(was `blockId: string`)

Remove `todayBlocks` prop entirely — it is no longer needed for completion state.

**Done-state logic — replace:**
```ts
// REMOVE
const isTaskDone = (task: Task) =>
  todayBlocks.some(b => b.task_id === task.id && b.status === 'completed')
const blockForTask = (task: Task) =>
  todayBlocks.find(b => b.task_id === task.id)
```

```ts
// ADD
const isTaskDone = (task: Task) =>
  !!task.completed_at && isSameDay(new Date(task.completed_at), new Date())
```

**Checkbox — replace:**
```tsx
// REMOVE
<input
  type="checkbox"
  checked={done}
  disabled={!block}
  onChange={e => block && onToggle(block.id, e.target.checked)}
  ...
/>
```

```tsx
// ADD
<input
  type="checkbox"
  checked={done}
  onChange={e => onToggle(task.id, e.target.checked)}
  ...
/>
```

Remove the time badge logic referencing `block` — time badge still comes from `task.preferred_time` (unchanged).

### `TodayPage` (`src/pages/TodayPage.tsx`)

- Import `toggleTask` from `useTasks()`
- Replace `handleToggle`:

```ts
// REMOVE
function handleToggle(blockId: string, done: boolean) {
  updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
}
```

```ts
// ADD
function handleToggle(taskId: string, done: boolean) {
  toggleTask({ id: taskId, done })
}
```

- Remove `todayBlocks` prop from `<DailyPanel>` call
- Update `<TaskChecklist onToggle={handleToggle} ...>` — signature already matches

### `DailyPage` (`src/pages/DailyPage.tsx`)

- Import `toggleTask` from `useTasks()`
- Replace `handleToggle`:

```ts
// REMOVE
function handleToggle(blockId: string, done: boolean) {
  updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
}
```

```ts
// ADD
function handleToggle(taskId: string, done: boolean) {
  toggleTask({ id: taskId, done })
}
```

- Remove `todayBlocks` prop from `<DailyPanel>` call
- `updateBlock` is no longer needed in `DailyPage` — remove from `useTimeBlocks` destructure if it becomes unused

---

## Cross-View Sync

No extra wiring needed. Both `TaskChecklist` and `DailyPanel` read from `useTasks()` which shares cache key `['tasks', uid]`. The `toggleTask` mutation updates the cache optimistically and invalidates on settle, so all mounted components re-render instantly.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `toggleTask` network failure | Optimistic update rolls back via `onError` handler |
| `toggleTask` called while unauthenticated | Throws — caught by React Query, logged to console |

---

## What Stays the Same

- `TodayTimeline` — block status dropdown (planned/completed/moved/skipped) is unchanged; it tracks time-slot completion independently
- `DailyItemModal` — unchanged
- Block creation/deletion in `DailyItemModal` — unchanged
- Week timetable — unchanged

---

## Out of Scope

- Showing unscheduled flexible tasks in TaskChecklist (currently only block-linked flexible tasks appear)
- Completion history or streaks
- Syncing block status ↔ task completion_at (they remain independent)
- End-of-day reset for flexible tasks
