# Scheduled Task Timetable Integration — Design Spec
**Date:** 2026-04-27

## Overview

When a user creates a "Scheduled task" from the Today page, it automatically creates a linked time block on the week timetable. The task defaults to today's date with a user-supplied start and end time. An optional "Repeats" checkbox reveals a day-of-week picker for recurring tasks. The existing "Scheduled task" label in `TaskModal` (week view) is renamed to "Recurring" to avoid confusion.

---

## Data Layer

### No schema changes required

The existing `tasks` table and `time_blocks` table already support everything needed:

**Non-recurring scheduled task:**
- `tasks`: `type = 'flexible'`, `repeat_days = []`, `preferred_time = startTime`
- `time_blocks`: linked via `task_id`, `start_time` and `end_time` as ISO timestamps for the selected date

The task appears in Today's checklist via the existing `linkedFlexible` path in `TaskChecklist` — tasks with `type = 'flexible'` that have a time block for today.

**Recurring scheduled task:**
- `tasks`: `type = 'daily'`, `repeat_days = [...]`, `preferred_time = startTime`
- `time_blocks`: one block created for the selected date, linked via `task_id`

The task appears in Today's checklist via the existing `dailyTasks` path on all matching weekdays. The time block enables the checkbox for the first occurrence; future occurrences show in the checklist but their checkboxes are disabled until a block is created for that week.

### TimeBlock fields used on creation

| Field | Value |
|---|---|
| `task_id` | ID of the newly created task |
| `title` | Same as task title |
| `start_time` | ISO timestamp: selected date + start time |
| `end_time` | ISO timestamp: selected date + end time |
| `type` | `'soft'` |
| `status` | `'planned'` |
| `reminder_minutes` | `[]` |
| `color` | `null` |

---

## Architecture

### New file

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/components/tasks/ScheduledTaskModal.tsx` | Form for date-specific scheduled task creation |

### Modified files

| Action | Path | Change |
|---|---|---|
| Modify | `src/pages/TodayPage.tsx` | Replace `showModal` bool with `taskMode` state; add type picker; wire `createBlock`; add `handleCreateScheduledTask` |
| Modify | `src/components/tasks/TaskModal.tsx` | Rename "Scheduled task" radio label to "Recurring" |

---

## Components

### `ScheduledTaskModal` (`src/components/tasks/ScheduledTaskModal.tsx`)

A focused modal for creating a date-specific scheduled task. Props:

```ts
interface Props {
  onSave: (
    task: Omit<Task, 'id' | 'user_id' | 'created_at'>,
    block: { date: string; startTime: string; endTime: string }
  ) => void | Promise<void>
  onClose: () => void
}
```

**Fields:**
- **Title** — text input, required (Save disabled / no-op if empty)
- **Date** — `<input type="date">`, defaults to today (`new Date().toISOString().slice(0, 10)`)
- **Start time** — `<input type="time">`
- **End time** — `<input type="time">`
- **Repeats** — `<input type="checkbox">`. When checked, reveals the Sun–Sat day-picker button row (same UI as `TaskModal`'s recurring day picker)

**Validation:** Save is a no-op if title is empty. No other validation — end time before start time is not blocked (the timetable already handles overlapping blocks).

**On save:** Calls `onSave` with:
- Task payload: `{ title, type: repeats ? 'daily' : 'flexible', preferred_time: startTime ? startTime + ':00' : null, repeat_days: repeats ? selectedDays : [] }`
- Block payload: `{ date, startTime, endTime }`

The modal does not close itself. The parent (`TodayPage`) closes it after both mutations succeed.

**Styling:** Same modal shell as `TaskModal` — `fixed inset-0 z-50 flex items-center justify-center bg-black/40`, inner `w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800`. Backdrop click calls `onClose`.

---

### `TodayPage` changes (`src/pages/TodayPage.tsx`)

**State:**

Replace `const [showModal, setShowModal] = useState(false)` with:

```ts
const [taskMode, setTaskMode] = useState<null | 'normal' | 'scheduled'>(null)
```

**New hook destructure:**

```ts
const { blocks, updateBlock, createBlock } = useTimeBlocks(weekStart)
```

**Type picker:**

When `taskMode` is `null` and the user clicks "+ New task", `taskMode` becomes `'pick'` (or equivalently: a separate `showPicker` boolean can be used). The picker is a small centered modal overlay with two buttons:

- **"Normal task"** → sets `taskMode = 'normal'`
- **"Scheduled task"** → sets `taskMode = 'scheduled'`

Cancel / backdrop click → `setTaskMode(null)`.

Implementation note: to keep the state minimal, use `taskMode` itself with a `'pick'` literal:

```ts
const [taskMode, setTaskMode] = useState<null | 'pick' | 'normal' | 'scheduled'>(null)
```

**Handlers:**

```ts
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
    const [startH, startM] = blockPayload.startTime.split(':')
    const [endH, endM] = blockPayload.endTime.split(':')
    const startDate = new Date(blockPayload.date)
    startDate.setHours(Number(startH), Number(startM), 0, 0)
    const endDate = new Date(blockPayload.date)
    endDate.setHours(Number(endH), Number(endM), 0, 0)
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
```

**Render:**

```tsx
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
```

The `TypePickerModal` is a small inline component defined in `TodayPage.tsx` (not a separate file — it's simple enough):

```tsx
function TypePickerModal({ onNormal, onScheduled, onClose }: {
  onNormal: () => void
  onScheduled: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xs rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">New task</h2>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={onNormal} className="btn-primary">Normal task</button>
          <button type="button" onClick={onScheduled} className="btn-primary">Scheduled task</button>
        </div>
      </div>
    </div>
  )
}
```

---

### `TaskModal` label change (`src/components/tasks/TaskModal.tsx`)

One change only — rename the radio button label for `value="daily"` from `"Scheduled task"` to `"Recurring"`. No logic changes.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Normal task creation fails | Modal stays open, error logged to console |
| Scheduled task: `createTask` fails | Modal stays open, `createBlock` is not called, error logged |
| Scheduled task: `createTask` succeeds but `createBlock` fails | Modal stays open, error logged; task is created but has no block (orphaned — acceptable, consistent with rest of app) |
| Both succeed | `setTaskMode(null)` — modal closes |

---

## Out of Scope

- Auto-creating time blocks for future occurrences of recurring tasks
- Editing scheduled tasks to update their linked time block
- Validation that end time is after start time
- Surfacing in-modal error messages to the user (console-only, consistent with rest of app)
