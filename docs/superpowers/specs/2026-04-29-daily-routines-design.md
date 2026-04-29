# Daily Routines — Design Spec
**Date:** 2026-04-29

## Overview

Add a "Daily" pane to the app where users manage recurring daily routines. Daily items are either unscheduled (checklist only) or scheduled (appear in Today's timeline and the week timetable as semi-transparent blocks behind regular blocks). The pane lives in two places simultaneously — a dedicated `/app/daily` page and a third column on the Today page — and both stay in sync via the shared React Query cache.

A secondary improvement: when Today's timeline has no blocks, show an empty-state button to quickly schedule something.

---

## Data Layer

### No schema changes required

Daily items reuse the existing `tasks` table:

| Field | Value |
|---|---|
| `type` | `'daily'` |
| `repeat_days` | `[0,1,2,3,4,5,6]` (all days, hardcoded on creation) |
| `preferred_time` | `null` for unscheduled; `"HH:MM:SS"` for scheduled |

### Time blocks for scheduled daily items

When a daily item is saved with a time, 7 time blocks are created — one per day of the current week (Sun–Sat) — linked via `task_id`. Block fields on creation:

| Field | Value |
|---|---|
| `task_id` | ID of the daily task |
| `title` | Same as task title |
| `start_time` | ISO timestamp: day of week + `preferred_time` |
| `end_time` | `start_time` + 1 hour |
| `type` | `'soft'` |
| `status` | `'planned'` |
| `reminder_minutes` | `[]` |
| `color` | `null` (renders as default indigo, styled with opacity in the UI) |

### Editing a scheduled daily item

If a daily item already has a scheduled time and the user changes or removes it:
- **Time changed:** delete all existing blocks for this task in the current week, then create 7 new blocks with the new time
- **Time removed:** delete all existing blocks for this task in the current week; no new blocks created

### Sync

Both the Daily page and Today page call `useTasks()` and `useTimeBlocks(weekStart)`. They share the same React Query cache. Any mutation (add, edit, delete, toggle) invalidates the shared cache keys and both views re-render automatically.

---

## Architecture

### New files

| File | Responsibility |
|---|---|
| `src/components/daily/DailyPanel.tsx` | Shared daily routines list — used on both Daily page and Today page |
| `src/components/daily/DailyItemModal.tsx` | Add/edit modal for daily items; handles task mutation + bulk block creation/deletion |
| `src/pages/DailyPage.tsx` | Page shell at `/app/daily`; mounts `DailyPanel` with hooks |

### Modified files

| File | Change |
|---|---|
| `src/App.tsx` | Add `/app/daily` route |
| `src/components/layout/Navbar.tsx` | Add "Daily" nav link; add `isDaily` active state |
| `src/pages/TodayPage.tsx` | Add `DailyPanel` as third column; pass required props |
| `src/components/dashboard/TodayTimeline.tsx` | Add empty-state UI when `blocks.length === 0` |
| `src/components/timetable/TimetableGrid.tsx` | Build `dailyTaskIds` set; pass to `DayColumn` |
| `src/components/timetable/DayColumn.tsx` | Accept `dailyTaskIds`; pass `isDaily` to `TimeBlock`; suppress suggestion overlay when real block exists |
| `src/components/timetable/TimeBlock.tsx` | Accept `isDaily` prop; apply transparent style + lower z-index for daily blocks |

---

## Components

### `DailyPanel` (`src/components/daily/DailyPanel.tsx`)

**Props:**
```ts
interface Props {
  tasks: Task[]
  todayBlocks: TimeBlock[]
  weekStart: Date
  onToggle: (blockId: string, done: boolean) => void
  onAdd: () => void
  onEdit: (task: Task) => void
}
```

**Behaviour:**
- Filters `tasks` where `type === 'daily'`
- Each row: checkbox + title + optional time badge (e.g. `7:00 AM`)
- Checkbox state: `todayBlocks.some(b => b.task_id === task.id && b.status === 'completed')`
- Checkbox disabled if no block exists for today (`todayBlocks.find(b => b.task_id === task.id)` is undefined)
- Clicking a row calls `onEdit(task)`
- "+ Add daily item" button calls `onAdd()`
- Empty state: "No daily routines yet. Add one to get started."

### `DailyItemModal` (`src/components/daily/DailyItemModal.tsx`)

**Props:**
```ts
interface Props {
  initial?: Task
  weekStart: Date
  onClose: () => void
}
```

The modal owns its own mutations via `useTasks()` and `useTimeBlocks(weekStart)` directly — no callbacks passed in for save, since the bulk block logic is complex enough to live inside the modal.

**Fields:**
- **Title** — text input, required. Save disabled if empty.
- **Scheduled** — checkbox. Off = unscheduled. On = reveals `<input type="time">`.

**On save (create):**
1. `createTask({ type: 'daily', repeat_days: [0,1,2,3,4,5,6], preferred_time: time ? time + ':00' : null, title })`
2. If time is set: create 7 blocks (one per day of week, Sun–Sat of `weekStart` week), each `start_time = day + time`, `end_time = start_time + 1hr`
3. `onClose()`

**On save (edit):**
1. `updateTask({ id, title, preferred_time: time ? time + ':00' : null })`
2. If time changed or removed: delete all blocks in current week where `task_id = id` (query `blocks` from hook, filter by task_id), then if time is set recreate 7 blocks
3. `onClose()`

**On delete:**
1. Delete all blocks in current week where `task_id = id`
2. `deleteTask(id)`
3. `onClose()`

**Styling:** Same modal shell as `TaskModal` — `fixed inset-0 z-50`, max-w-sm, backdrop click closes. Escape key closes. `role="dialog"`, `aria-modal`, `aria-labelledby`.

### `DailyPage` (`src/pages/DailyPage.tsx`)

```tsx
export default function DailyPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock } = useTimeBlocks(weekStart)
  const { tasks } = useTasks()
  const [modal, setModal] = useState<{ task?: Task } | null>(null)

  const todayBlocks = blocks.filter(b =>
    new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DailyPanel
          tasks={tasks}
          todayBlocks={todayBlocks}
          weekStart={weekStart}
          onToggle={handleToggle}
          onAdd={() => setModal({})}
          onEdit={task => setModal({ task })}
        />
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

### `TodayPage` changes

Add `DailyPanel` as a third column in the flex layout. Layout becomes:

```tsx
<div className="flex flex-1 flex-col overflow-hidden md:flex-row">
  <TodayTimeline blocks={todayBlocks} onStatusChange={handleStatusChange} onAddTask={() => setTaskMode('pick')} />
  <TaskChecklist tasks={tasks} todayBlocks={todayBlocks} onToggle={handleToggle} onAddTask={() => setTaskMode('pick')} />
  <DailyPanel
    tasks={tasks}
    todayBlocks={todayBlocks}
    weekStart={weekStart}
    onToggle={handleToggle}
    onAdd={() => setDailyModal({})}
    onEdit={task => setDailyModal({ task })}
  />
</div>
{dailyModal !== null && (
  <DailyItemModal initial={dailyModal.task} weekStart={weekStart} onClose={() => setDailyModal(null)} />
)}
```

New state: `const [dailyModal, setDailyModal] = useState<{ task?: Task } | null>(null)`

`TodayTimeline` gets a new optional prop `onAddTask?: () => void` (passed through to the empty-state button).

### `TodayTimeline` empty-state

When `blocks.length === 0`, render inside the scroll area:

```tsx
{blocks.length === 0 && (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <p className="text-sm text-gray-400 dark:text-gray-500">Nothing scheduled for today.</p>
    {onAddTask && (
      <button type="button" className="btn-primary" onClick={onAddTask}>
        + Schedule something
      </button>
    )}
  </div>
)}
```

### Week view — daily block visual treatment

**`TimetableGrid`:** Build a `Set<string>` of daily task IDs and pass to each `DayColumn`:

```ts
const dailyTaskIds = new Set(tasks.filter(t => t.type === 'daily').map(t => t.id))
```

**`DayColumn`:** Accept `dailyTaskIds: Set<string>`. Pass `isDaily={dailyTaskIds.has(block.task_id ?? '')}` to each `TimeBlock`. For the suggestion overlay, suppress it if a real block already exists for that task on that day:

```ts
// In the suggestion overlay filter:
.filter(t => !blocks.some(b => b.task_id === t.id))
```

**`TimeBlock`:** Accept `isDaily?: boolean`. When true:
- `zIndex: 1` (behind regular blocks at z-index 10)
- `backgroundColor`: block's colour with `0.25` opacity — achieved via inline style converting hex to `rgba`, or using a CSS filter
- Border: `1px dashed` instead of the type-based border
- Title prefix: `🔁 ` prepended

Simplest opacity approach — override backgroundColor with rgba:
```ts
const bgColor = isDaily
  ? hexToRgba(block.color ?? '#6366f1', 0.25)
  : (block.color ?? '#6366f1')
```

Add a small `hexToRgba(hex: string, alpha: number): string` utility to `src/lib/dateUtils.ts` (or a new `src/lib/colorUtils.ts`).

---

## Navbar

Add "Daily" link between "Today" and "Week":

```tsx
const isDaily = location.pathname === '/app/daily'
// ...
<Link to="/app/daily" className={`... ${isDaily ? 'font-semibold text-indigo-600 dark:text-indigo-400' : '...'}`}>Daily</Link>
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `createTask` fails | Modal stays open, blocks not created, error logged |
| `createTask` succeeds, a block creation fails | Task exists, partial blocks — logged. Acceptable (consistent with rest of app) |
| `updateTask` fails | Modal stays open, no block changes, error logged |
| Block deletion fails on edit | Modal stays open, error logged |
| `deleteTask` fails | Modal stays open, error logged |
| Toggle (updateBlock) fails | Optimistic update rolls back via existing `useTimeBlocks` onError handler |

---

## Out of Scope

- Choosing which days of the week a daily item applies to (always all 7 for now)
- Auto-creating blocks when navigating to a future week (blocks exist for the current week only; future weeks show the dashed suggestion overlay until blocks are created)
- Editing a daily item's time from the week timetable block (use the Daily pane for that)
- Drag-to-reschedule for daily routine blocks (they can be dragged like any block, but that only moves the individual block, not the recurring time)
- In-modal error messages (console-only, consistent with rest of app)
