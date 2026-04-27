# Add Task Button on Today Page — Design Spec
**Date:** 2026-04-27

## Overview

Add a "+ New task" button to the Today page's `TaskChecklist` panel that opens a modified `TaskModal`. The modal replaces its current `<select>` dropdown with radio buttons so users can choose "Normal task" (flexible) or "Scheduled task" (daily) before filling in the form.

---

## Architecture

### Components modified

| File | Change |
|---|---|
| `src/components/tasks/TaskModal.tsx` | Replace `<select>` with two radio buttons; layout/fields unchanged |
| `src/components/dashboard/TaskChecklist.tsx` | Add `onAddTask?: () => void` prop; render "+ New task" button |
| `src/pages/TodayPage.tsx` | Add modal open/close state; destructure `createTask`; pass `onAddTask` |

No new files. No new hooks. No schema changes.

---

## TaskModal changes

The modal already manages `type` state (`'flexible' | 'daily'`). The `<select>` is replaced with a two-option radio group:

- **"Normal task"** → sets `type = 'flexible'`
- **"Scheduled task"** → sets `type = 'daily'`

The radio buttons appear directly below the title input, above the day-picker and time field. All existing conditional rendering (`type === 'daily'` shows day picker) stays exactly as-is. `onSave` / `onDelete` / `onClose` signatures are unchanged — this is a pure UI swap with no data layer impact.

The default radio selection when opening for a new task is "Normal task" (`flexible`), matching the current default.

---

## TaskChecklist button

`TaskChecklist` gains an optional `onAddTask?: () => void` prop.

The header row changes from a plain `<h2>` to a flex row:
- Left: "Today's Tasks" heading (unchanged)
- Right: "+ New task" button (only rendered when `onAddTask` is provided)

Button styling: small, ghost-style (indigo text, no background, hover underline or subtle bg) — consistent with the panel's compact sidebar aesthetic.

---

## TodayPage wiring

`TodayPage` adds:
- `const [showModal, setShowModal] = useState(false)` — controls modal visibility
- Destructures `createTask` from `useTasks()` (already available in the hook)
- Passes `onAddTask={() => setShowModal(true)}` to `TaskChecklist`
- Renders `TaskModal` when `showModal` is true:
  - `onSave`: calls `createTask(payload)` then `setShowModal(false)`
  - `onClose`: calls `setShowModal(false)`
  - No `onDelete` (creating new tasks only)
  - No `initial` prop (blank form)

---

## Button placement and responsive margins

The "+ New task" button sits **inside the `TaskChecklist` header**, not as a floating button. This avoids z-index and overlap issues on the Today layout (which already has a timeline panel taking up the left/main area).

The TaskChecklist panel itself is a sidebar (`md:w-64`) that is always visible — no floating button with bottom margin is needed here. The button lives in the panel header row at the top of the sidebar.

This is distinct from the Week view's floating "Tasks" button (which opens a slide-out panel overlay). The Today page's task panel is always visible, so a header-embedded button is more appropriate and requires no responsive margin adjustments.

---

## Error Handling

- `createTask` failures: log to console (consistent with rest of app's mutation error handling)
- Empty title: `handleSave` already guards with `if (!title.trim()) return` — no change needed

---

## Out of Scope

- Editing existing tasks from the Today page
- Reordering tasks
- Linking newly created tasks to time blocks automatically
- Any changes to the Week view's TaskModal usage
