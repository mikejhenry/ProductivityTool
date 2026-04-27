# Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-width Shopping List page where users can add items, check them off into a strikethrough "Done" section, uncheck them, delete individually, or bulk-clear done items.

**Architecture:** Single `ShoppingPage` component owns all UI state (add input value). Data is managed by `useShoppingItems` hook following the same React Query + Supabase pattern as `useNotes`. No split panel — one full-width list per user. Unchecked and done items are derived by filtering in the component.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase (postgres + RLS), React Query (`@tanstack/react-query`), React Router

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/types/index.ts` | Add `ShoppingItem` interface |
| Create | `src/hooks/useShoppingItems.ts` | Supabase CRUD for shopping items via React Query |
| Create | `src/pages/ShoppingPage.tsx` | Full-width page — add input, unchecked list, done section |
| Modify | `src/App.tsx` | Add `/app/shopping` route |
| Modify | `src/components/layout/Navbar.tsx` | Add Shopping nav link |

---

## Task 1: Supabase SQL schema

**Files:**
- No code files — run SQL in Supabase dashboard

- [ ] **Step 1: Run the following SQL in Supabase SQL Editor (Dashboard → SQL Editor → New query)**

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

- [ ] **Step 2: Verify the table exists**

In the Supabase dashboard, go to Table Editor and confirm `shopping_items` appears with columns: `id`, `user_id`, `name`, `checked`, `created_at`.

---

## Task 2: Add ShoppingItem type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add the `ShoppingItem` interface to `src/types/index.ts` after the `Note` interface**

```typescript
export interface ShoppingItem {
  id: string
  user_id: string
  name: string
  checked: boolean
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add ShoppingItem type"
```

---

## Task 3: Create useShoppingItems hook

**Files:**
- Create: `src/hooks/useShoppingItems.ts`

- [ ] **Step 1: Create `src/hooks/useShoppingItems.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ShoppingItem } from '../types'

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
        .order('created_at', { ascending: true })
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

  return {
    items,
    loadError,
    addItem: addItem.mutateAsync,
    toggleItem: toggleItem.mutateAsync,
    deleteItem: deleteItem.mutateAsync,
    clearDone: clearDone.mutateAsync,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useShoppingItems.ts
git commit -m "feat: add useShoppingItems hook"
```

---

## Task 4: Create ShoppingPage

**Files:**
- Create: `src/pages/ShoppingPage.tsx`

- [ ] **Step 1: Create `src/pages/ShoppingPage.tsx`**

```tsx
import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { useShoppingItems } from '../hooks/useShoppingItems'

export default function ShoppingPage() {
  const { items, loadError, addItem, toggleItem, deleteItem, clearDone } = useShoppingItems()
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

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-6">

          {/* Error state */}
          {loadError && (
            <p className="mb-4 text-sm text-red-500">Failed to load shopping list.</p>
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
          <ul className="space-y-1">
            {unchecked.map(item => (
              <li key={item.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-slate-800">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleItem({ id: item.id, checked: true }).catch(e => console.warn('Failed to toggle item', e))}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{item.name}</span>
              </li>
            ))}
          </ul>

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
                  <li key={item.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-slate-800">
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

- [ ] **Step 2: Commit**

```bash
git add src/pages/ShoppingPage.tsx
git commit -m "feat: add ShoppingPage with add, check, done section, and clear"
```

---

## Task 5: Wire up route and nav

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Navbar.tsx`

- [ ] **Step 1: Add the Shopping route to `src/App.tsx`**

Add the import at the top with the other page imports:
```tsx
import ShoppingPage from './pages/ShoppingPage'
```

Add the route after the `/app/notes` route:
```tsx
<Route path="/app/shopping" element={<ProtectedRoute><ShoppingPage /></ProtectedRoute>} />
```

The full routes block should look like:
```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/signup" element={<SignupPage />} />
  <Route path="/reset-password" element={<ResetPasswordPage />} />
  <Route path="/app" element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
  <Route path="/app/today" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
  <Route path="/app/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
  <Route path="/app/shopping" element={<ProtectedRoute><ShoppingPage /></ProtectedRoute>} />
  <Route path="/app/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
  <Route path="*" element={<Navigate to="/login" replace />} />
</Routes>
```

- [ ] **Step 2: Add the Shopping link to `src/components/layout/Navbar.tsx`**

Add this variable alongside the existing `isToday`, `isWeek`, `isNotes` declarations:
```tsx
const isShopping = location.pathname === '/app/shopping'
```

Add the Shopping link after the Notes link:
```tsx
<Link
  to="/app/shopping"
  className={`rounded px-3 py-1.5 text-sm ${isShopping ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700'}`}
>
  Shopping
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/layout/Navbar.tsx
git commit -m "feat: wire up Shopping route and nav link"
```

---

## Task 6: Smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the following manually**

- "Shopping" link appears in the nav after "Notes"
- Navigating to `/app/shopping` loads the page without errors
- Typing in the input and pressing Enter (or clicking Add) adds an item
- Add button is disabled when input is empty
- Checking an item moves it to the Done section with strikethrough text
- Clicking the checkbox on a done item moves it back to unchecked
- Clicking 🗑 on a done item deletes it
- "Clear all" removes all done items
- Empty state message shows when the list is empty
- Dark mode looks correct

- [ ] **Step 3: Push to remote**

```bash
git push
```

Netlify will auto-deploy from the push.
