# Task Title Sync — Design Spec
**Date:** 2026-04-27

## Overview

When a task's name is edited anywhere in the app, the change should propagate to all places that display it. Currently `tasks.title` and `time_blocks.title` are stored independently and drift out of sync when either is edited.

---

## Problem

Two edit surfaces exist on the week tab:

| Surface | What it edits | What stays stale |
|---|---|---|
| Block modal (`BlockModal`) | `time_blocks.title` | `tasks.title` → `TaskChecklist` shows old name |
| Task panel (`TaskModal` via `TaskList`) | `tasks.title` | `time_blocks.title` → `TodayTimeline` and timetable blocks show old name |

Views affected:
- **`TodayTimeline`** (Today page) — renders `block.title`
- **`TaskChecklist`** (Today page) — renders `task.title`
- **`TaskList`** sidebar (Week tab) — renders `task.title`
- **Timetable blocks** (Week tab) — render `block.title`

---

## No Schema Changes Required

The existing `tasks` and `time_blocks` tables are sufficient. The fix is application-layer cascade logic.

---

## Architecture

### Two-way cascade via two small changes

#### Change 1 — `useTasks.updateTask` cascade  
*(handles: task panel edit → all linked blocks)*

When `updateTask` receives a patch that includes `title`, it additionally runs a bulk update on all linked time blocks for that task:

```ts
if ('title' in patch) {
  await supabase
    .from('time_blocks')
    .update({ title: patch.title })
    .eq('task_id', id)
    .eq('user_id', uid!)
}
```

`onSuccess` invalidates both `['tasks', uid]` and `['blocks']` (prefix match, covers all weeks).

#### Change 2 — `AppPage` block-update wrapper  
*(handles: block modal edit → linked task + all other linked blocks)*

`AppPage` wraps `updateBlock` before passing it to `TimetableGrid`. When the patch includes a `title` and the block has a `task_id`, it also calls `updateTask` after the block update:

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

`updateTask` (enhanced by Change 1) cascades the new title to all other blocks linked to the same task.

---

## Data Flow

**Edit block title via BlockModal:**
1. `handleUpdateBlock` → `updateBlock` (updates current block in DB)
2. `handleUpdateBlock` → `updateTask({ id: task_id, title })` (updates task in DB)
3. `updateTask` cascade → bulk-updates all `time_blocks` where `task_id` matches (including current block — idempotent)
4. Cache invalidation: `['blocks']` + `['tasks', uid]` — all views re-render with new title

**Edit task title via TaskList / TaskModal:**
1. `updateTask({ id, title, ...otherFields })` (updates task in DB)
2. `updateTask` cascade → bulk-updates all `time_blocks` where `task_id` matches
3. Cache invalidation: `['blocks']` + `['tasks', uid]` — all views re-render with new title

---

## Modified Files

| File | Change |
|---|---|
| `src/hooks/useTasks.ts` | `updateTask` mutationFn: bulk-update `time_blocks.title` when `title` is in patch; `onSuccess`: also invalidate `['blocks']` |
| `src/pages/AppPage.tsx` | Replace `onUpdate={updateBlock}` with `onUpdate={handleUpdateBlock}`; add `handleUpdateBlock` wrapper |

No new files.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `updateBlock` fails | Error thrown, `updateTask` not called, no cascade |
| `updateBlock` succeeds, `updateTask` fails | Block title updated, task + other blocks stale — consistent with rest of app (console error only) |
| `updateTask` cascade (block update) fails | Task title updated, some blocks may be stale — console error only |
| All succeed | All views show new title after cache invalidation |

---

## Out of Scope

- Propagating other block fields (start/end time, type, color) back to the task
- Syncing title when a block's `task_id` is changed (re-linking to a different task)
- In-UI error messages (console-only, consistent with rest of app)
