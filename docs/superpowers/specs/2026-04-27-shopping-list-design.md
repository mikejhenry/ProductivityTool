# Shopping List — Design Spec
**Date:** 2026-04-27

## Overview

Add a Shopping List page to the app where users can maintain a single shared shopping list. Items can be added, checked off (moving them to a "Done" section with strikethrough styling), unchecked, deleted individually, or bulk-cleared. The page is full-width with no split panel.

---

## Data Layer

### Supabase table: `shopping_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users(id)`, `ON DELETE CASCADE` |
| `name` | `text` | The item text |
| `checked` | `boolean` | Default `false` |
| `created_at` | `timestamptz` | Default `now()` |

### Sort order
- Unchecked items: `created_at` ascending (oldest first)
- Checked items: `created_at` ascending within the Done section

### RLS

- Enable RLS on `shopping_items`
- Single policy: users can `SELECT`, `INSERT`, `UPDATE`, `DELETE` their own rows (`auth.uid() = user_id`)

### SQL to run in Supabase

```sql
CREATE TABLE IF NOT EXISTS shopping_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  checked     boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own shopping items"
  ON shopping_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Architecture

### Hook: `useShoppingItems`

Single hook following the same React Query + Supabase pattern as `useNotes` and `useTasks`:

- `items` — all items for the user, fetched once and split in the component
- `loadError` — query error exposed for UI display
- `addItem(name: string)` — inserts a new unchecked item
- `toggleItem(id: string, checked: boolean)` — updates `checked` field
- `deleteItem(id: string)` — deletes a single item
- `clearDone()` — deletes all items where `checked = true` for the current user

The hook returns `items` unsorted from Supabase (ordered by `created_at` ascending). The component derives `unchecked` and `done` arrays by filtering.

---

## Components

### `ShoppingPage` (`src/pages/ShoppingPage.tsx`)

Full-width page shell at `/app/shopping`. Uses `useShoppingItems`. Derives two lists:
- `unchecked = items.filter(i => !i.checked)`
- `done = items.filter(i => i.checked)`

Renders `<Navbar />` then the full-width content area.

**Add input (top of page):**
- Text input + "Add" button side by side
- Submits on button click or Enter key
- Input clears after successful add
- Disabled/ignored if input is empty or whitespace-only

**Unchecked items list:**
- Each row: checkbox on left, item name on right
- Checking the checkbox calls `toggleItem(id, true)` — item moves to Done section
- Empty state: "Your shopping list is empty. Add an item above."

**Done section (only rendered when `done.length > 0`):**
- Section header: "Done" label on the left, "Clear all" button on the right
- "Clear all" calls `clearDone()`
- Each done item row: checked checkbox + ~~strikethrough~~ item name + trash icon on right
- Clicking the checkbox calls `toggleItem(id, false)` — moves item back to unchecked
- Trash icon calls `deleteItem(id)`

**Error state:** If `loadError`, show "Failed to load shopping list." at the top of the content area.

---

## Navigation

Add a "Shopping" link to the nav row in `Navbar.tsx`, after the "Notes" link.

Active state detection: `location.pathname === '/app/shopping'`

Add `isShopping` alongside existing `isToday`, `isWeek`, `isNotes` variables.

Add route in `App.tsx`:
```tsx
<Route path="/app/shopping" element={<ProtectedRoute><ShoppingPage /></ProtectedRoute>} />
```

---

## Error Handling

- Failed loads: show error message in place of list content
- Failed adds/toggles/deletes: log to console (mutations are best-effort; input state is preserved so nothing is lost)
- `clearDone`: on failure, log to console — no UI disruption

---

## Out of Scope

- Multiple named lists
- Item quantities or units
- Categories / aisles
- Drag-to-reorder
- Sharing lists with other users
