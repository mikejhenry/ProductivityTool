# Drag-and-Drop Reordering & Hover CSS Design

## Overview

Two complementary improvements to the task/routine/shopping UX:

1. **Drag-and-drop reordering** — users can reorder tasks (TaskChecklist), daily routines (DailyPanel), and shopping list items (ShoppingPage) by dragging. Order persists across reloads via a `sort_order` integer column in Supabase.
2. **Hover CSS** — row-level colour changes on mouseover for task rows, daily rows, shopping items, and timetable blocks. Improves accessibility for users with vision impairment.

---

## Data Layer

### New columns

Add to Supabase via the dashboard SQL editor:

```sql
ALTER TABLE tasks ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE shopping_items ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
```

Existing rows all receive `sort_order = 0`. On first drag the full reindex writes sequential values (0, 1, 2…), fixing any ties permanently.

### Query ordering changes

- `useTasks` query: change `.order('created_at')` → `.order('sort_order')`
- `useShoppingItems` query: change `.order('created_at')` → `.order('sort_order')`

### New mutations

**`reorderTasks(orderedIds: string[])`** in `useTasks`:

```ts
const reorderTasks = useMutation({
  mutationFn: async (orderedIds: string[]) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from('tasks').update({ sort_order: index }).eq('id', id).eq('user_id', uid!)
      )
    )
  },
  onMutate: async (orderedIds) => {
    await qc.cancelQueries({ queryKey: key })
    const previous = qc.getQueryData<Task[]>(key)
    qc.setQueryData<Task[]>(key, old => {
      if (!old) return []
      const map = new Map(old.map(t => [t.id, t]))
      return orderedIds.map(id => map.get(id)!).filter(Boolean)
    })
    return { previous }
  },
  onError: (_err, _vars, ctx) => {
    if (ctx?.previous) qc.setQueryData(key, ctx.previous)
  },
  onSettled: () => qc.invalidateQueries({ queryKey: key }),
})
// export as: reorderTasks: reorderTasks.mutateAsync
```

**`reorderItems(orderedIds: string[])`** in `useShoppingItems` — identical pattern, targeting `shopping_items` table.

---

## Dependency

Install `@dnd-kit/sortable` (sits on top of already-installed `@dnd-kit/core` v6.3.1):

```bash
npm install @dnd-kit/sortable
```

---

## Component Design

### Shared drag-and-drop pattern

Each sortable list uses:

```tsx
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// In the list component:
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return
  const oldIndex = items.findIndex(i => i.id === active.id)
  const newIndex = items.findIndex(i => i.id === over.id)
  const reordered = arrayMove(items, oldIndex, newIndex)
  reorderItems(reordered.map(i => i.id))
}

<DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
  <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
    {items.map(item => <SortableRow key={item.id} item={item} />)}
  </SortableContext>
</DndContext>
```

Each row uses `useSortable`:

```tsx
function SortableRow({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle */}
      <span {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 px-1">⠿</span>
      {/* Row content */}
    </div>
  )
}
```

The gripper icon `⠿` is always visible (not just on hover) so keyboard and pointer users have a clear target.

### TaskChecklist

- Wrap the task list in `DndContext` + `SortableContext`
- All tasks (checked and unchecked) are sortable
- Each task row becomes a sortable item with a drag handle on the left
- `handleDragEnd` calls `reorderTasks` from `useTasks`
- Add hover CSS: `hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors` to each row wrapper

### DailyPanel

- Same pattern as TaskChecklist
- All daily tasks are sortable
- `handleDragEnd` calls `reorderTasks` from `useTasks` (daily tasks share the same `tasks` table and `sort_order` column)
- Add hover CSS: `hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors` to each row wrapper

### ShoppingPage

- Only **unchecked** items are sortable; checked items have no drag handle and sit outside `SortableContext`
- `SortableContext` receives only unchecked item IDs
- Checked items retain their `sort_order` values; if unchecked later they return to their stored position
- `handleDragEnd` calls `reorderItems` from `useShoppingItems`
- Add hover CSS: `hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors` to each `<li>`

### TimeBlock (TimetableGrid)

- Add `hover:brightness-110 transition-[filter]` to the block's outer `<div>`
- No JS changes; existing inline styles (dragging, colour) take precedence

---

## Hover CSS Summary

| Component | Element | Classes added |
|---|---|---|
| TaskChecklist | Row wrapper `<div>` | `hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors` |
| DailyPanel | Row wrapper `<div>` | `hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors` |
| ShoppingPage | `<li>` | `hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors` |
| TimeBlock | Outer `<div>` | `hover:brightness-110 transition-[filter]` |

---

## Error Handling

| Scenario | Handling |
|---|---|
| Reorder mutation fails | `onError` rolls back optimistic update to previous order |
| Empty list | `SortableContext` with empty `items` array renders nothing — no special case needed |
| Single-item list | `arrayMove` returns same array; mutation writes same values — harmless no-op |
| Checked shopping items dragged | Excluded from `SortableContext`; no drag handles rendered |
| `sort_order` ties on first load | Display order is Supabase default for equal values; first drag fixes all via full reindex |
| TimeBlock brightness during drag | Inline drag styles take CSS specificity precedence over Tailwind filter classes |

---

## Files Affected

| File | Change |
|---|---|
| `src/hooks/useTasks.ts` | Change `.order('created_at')` → `.order('sort_order')`; add `reorderTasks` mutation |
| `src/hooks/useShoppingItems.ts` | Change `.order('created_at')` → `.order('sort_order')`; add `reorderItems` mutation |
| `src/components/dashboard/TaskChecklist.tsx` | DnD wrapper + sortable rows + hover CSS |
| `src/components/daily/DailyPanel.tsx` | DnD wrapper + sortable rows + hover CSS |
| `src/pages/ShoppingPage.tsx` | DnD wrapper (unchecked only) + sortable rows + hover CSS |
| `src/components/timetable/TimeBlock.tsx` | Add `hover:brightness-110 transition-[filter]` |
