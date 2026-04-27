# Task Title Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a task's name is edited anywhere in the week tab, the change propagates to all views — timetable blocks, Today timeline, and Today checklist.

**Architecture:** Two focused changes: (1) `useTasks.updateTask` bulk-updates all linked `time_blocks.title` whenever a title change is included in the patch; (2) `AppPage` wraps `updateBlock` to also call `updateTask` when a block with a linked task is saved with a new title, triggering the cascade in (1). No new files.

**Tech Stack:** React, TypeScript, Supabase (JS client), @tanstack/react-query, Vitest

---

## File Structure

| Action | File | Change |
|---|---|---|
| Modify | `src/hooks/useTasks.ts` | `updateTask` mutationFn cascades `title` to linked blocks; `onSuccess` invalidates `['blocks']` |
| Modify | `src/pages/AppPage.tsx` | Add `handleUpdateBlock` wrapper; pass it as `onUpdate` to `TimetableGrid` |

---

## Context: how the data model works

`tasks` and `time_blocks` each have their own `title` column. They start in sync when a scheduled task is created (both set to the same string), but drift if either is edited independently. React Query caches blocks per week under key `['blocks', weekStart.toISOString()]` and tasks under `['tasks', uid]`. Calling `qc.invalidateQueries({ queryKey: ['blocks'] })` with just the prefix invalidates all weeks at once.

---

## Task 1: Cascade title in `useTasks.updateTask`

**Files:**
- Modify: `src/hooks/useTasks.ts`

This task makes editing a task's name (via the TaskList sidebar) automatically update all linked time blocks.

- [ ] **Step 1: Open `src/hooks/useTasks.ts` and read the current `updateTask` mutation (lines 39–45)**

Current code for reference:
```ts
const updateTask = useMutation({
  mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
    const { error } = await supabase.from('tasks').update(patch).eq('id', id)
    if (error) throw error
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: key }),
})
```

- [ ] **Step 2: Replace the entire `updateTask` mutation with the cascading version**

Replace lines 39–45 with:
```ts
const updateTask = useMutation({
  mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
    const { error } = await supabase.from('tasks').update(patch).eq('id', id)
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
```

Key points:
- The `'title' in patch` check (not `patch.title`) correctly handles `title: ''` edge cases and only cascades when the caller intentionally included `title` in the patch.
- The bulk Supabase update (`UPDATE time_blocks SET title = ? WHERE task_id = ? AND user_id = ?`) updates every block linked to this task across all weeks.
- `onSuccess` now invalidates both `['tasks', uid]` and the `['blocks']` prefix (all weeks).

- [ ] **Step 3: Run the existing tests to confirm no regression**

```bash
npm test
```

Expected: all 10 tests pass. The mutation change has no effect on the pure-function tests.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTasks.ts
git commit -m "feat: cascade task title to linked time blocks on updateTask"
```

---

## Task 2: Wrap `updateBlock` in `AppPage` to sync task title

**Files:**
- Modify: `src/pages/AppPage.tsx`

This task makes editing a block's title (via the BlockModal in the timetable) propagate back to the linked task and all other blocks sharing that task.

- [ ] **Step 1: Open `src/pages/AppPage.tsx` and read the current file**

Current relevant lines for reference:

```tsx
// Line 17
const { tasks, createTask, updateTask, deleteTask } = useTasks()

// Line 49-56
<TimetableGrid
  weekStart={weekStart}
  blocks={blocks}
  tasks={tasks}
  onCreate={createBlock}
  onUpdate={updateBlock}   // ← this is what we're replacing
  onDelete={deleteBlock}
/>
```

The `TimeBlock` type is already imported on line 11:
```ts
import { TimeBlock } from '../types'
```

- [ ] **Step 2: Add `handleUpdateBlock` function after the `handleCopyWeek` function (after line 41)**

Insert this function between `handleCopyWeek` and the `return` statement:

```ts
async function handleUpdateBlock(patch: Partial<TimeBlock> & { id: string }) {
  await updateBlock(patch)
  if ('title' in patch) {
    const block = blocks.find(b => b.id === patch.id)
    if (block?.task_id) {
      await updateTask({ id: block.task_id, title: patch.title })
    }
  }
}
```

How it works:
- Always calls `updateBlock` first (updates the current block's title and all other fields).
- If `title` was part of the patch AND the block has a linked task, calls `updateTask` with just the title.
- `updateTask` (enhanced in Task 1) then bulk-updates all other blocks linked to the same task and invalidates both caches.
- If the block has no `task_id` (a standalone block), no task sync is attempted.

- [ ] **Step 3: Replace `onUpdate={updateBlock}` with `onUpdate={handleUpdateBlock}` in the `TimetableGrid` JSX**

Find:
```tsx
onUpdate={updateBlock}
```

Replace with:
```tsx
onUpdate={handleUpdateBlock}
```

- [ ] **Step 4: Run the existing tests to confirm no regression**

```bash
npm test
```

Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AppPage.tsx
git commit -m "feat: sync block title edit back to linked task and all sibling blocks"
```

---

## Task 3: Manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Create a scheduled task from the Today page**

1. Go to the Today page.
2. Click "+ New task" → "Scheduled task".
3. Enter title **"Test task"**, pick today's date, set a start and end time, save.
4. Confirm "Test task" appears in both the Today checklist and the Today timeline.
5. Go to the Week tab — confirm a time block titled "Test task" appears at the scheduled time.

- [ ] **Step 3: Edit the block title from the timetable**

1. On the Week tab, click the "Test task" block to open BlockModal.
2. Change the title to **"Renamed via block"** and save.
3. Confirm the block now shows "Renamed via block" in the timetable.
4. Go to the Today page — confirm both the Today timeline and the Today checklist show "Renamed via block".
5. Go back to Week tab, open the Tasks panel — confirm the task entry shows "Renamed via block".

- [ ] **Step 4: Edit the task title from the task panel**

1. On the Week tab, open the Tasks panel (bottom-right "Tasks" button).
2. Click the task to open TaskModal.
3. Change the title to **"Renamed via task"** and save.
4. Confirm the task panel shows "Renamed via task".
5. Go to the Today page — confirm both the Today timeline and the Today checklist show "Renamed via task".
6. Go back to Week tab — confirm the timetable block shows "Renamed via task".

- [ ] **Step 5: Verify unlinked blocks are unaffected**

1. Create a plain time block (click an empty timetable cell, don't link a task, save with title "Standalone").
2. Edit its title to "Standalone renamed".
3. Confirm no errors, the block title updates, and no tasks are affected.
