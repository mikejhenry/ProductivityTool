# Notes Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Notes page where users can create, edit, and delete personal notes with a title and body, stored in Supabase with auto-save.

**Architecture:** Split-panel layout — list on the left (260px), editor on the right (flex-1) on desktop. On mobile the list and editor are full-screen and toggle based on selection. A `useNotes` hook handles all Supabase CRUD via React Query, matching the existing `useTasks` pattern. Auto-save is a 1-second debounce in `NoteEditor`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase (postgres + RLS), React Query (`@tanstack/react-query`), React Router

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/types/index.ts` | Add `Note` interface |
| Create | `src/hooks/useNotes.ts` | Supabase CRUD for notes via React Query |
| Create | `src/components/notes/NotesList.tsx` | Left panel — list of note titles + New note button |
| Create | `src/components/notes/NoteEditor.tsx` | Right panel — title input, body textarea, delete button, auto-save |
| Create | `src/pages/NotesPage.tsx` | Page shell — owns selection state, wires up split layout |
| Modify | `src/App.tsx` | Add `/app/notes` route |
| Modify | `src/components/layout/Navbar.tsx` | Add Notes nav link |

---

## Task 1: Supabase SQL schema

**Files:**
- No code files — run SQL in Supabase dashboard

- [ ] **Step 1: Run the following SQL in Supabase SQL Editor (Dashboard → SQL Editor → New query)**

```sql
CREATE TABLE IF NOT EXISTS notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Untitled',
  body        text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes"
  ON notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Verify the table exists**

In the Supabase dashboard, go to Table Editor and confirm `notes` appears with columns: `id`, `user_id`, `title`, `body`, `created_at`, `updated_at`.

---

## Task 2: Add Note type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add the `Note` interface to `src/types/index.ts` after the `TimeBlock` interface**

```typescript
export interface Note {
  id: string
  user_id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Note type"
```

---

## Task 3: Create useNotes hook

**Files:**
- Create: `src/hooks/useNotes.ts`

- [ ] **Step 1: Create `src/hooks/useNotes.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Note } from '../types'

export function useNotes() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id
  const key = ['notes', uid]

  const { data: notes = [], error: loadError } = useQuery<Note[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', uid!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const createNote = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .insert({ user_id: uid!, title: 'Untitled', body: '' })
        .select()
        .single()
      if (error) throw error
      return data as Note
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateNote = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Note> & { id: string }) => {
      const { error } = await supabase
        .from('notes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    notes,
    loadError,
    createNote: createNote.mutateAsync,
    updateNote: updateNote.mutateAsync,
    deleteNote: deleteNote.mutateAsync,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNotes.ts
git commit -m "feat: add useNotes hook"
```

---

## Task 4: Create NotesList component

**Files:**
- Create: `src/components/notes/NotesList.tsx`

- [ ] **Step 1: Create `src/components/notes/NotesList.tsx`**

```tsx
import { Note } from '../../types'

interface NotesListProps {
  notes: Note[]
  selectedId: string | null
  loadError: Error | null
  onSelect: (note: Note) => void
  onCreate: () => void
}

export function NotesList({ notes, selectedId, loadError, onSelect, onCreate }: NotesListProps) {
  return (
    <div className="flex h-full w-full flex-col border-r border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 md:w-64 md:shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-slate-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notes</span>
        <button
          onClick={onCreate}
          className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-700"
        >
          + New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loadError && (
          <p className="px-3 py-4 text-xs text-red-500">Failed to load notes.</p>
        )}
        {!loadError && notes.length === 0 && (
          <p className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500">
            No notes yet. Create one above.
          </p>
        )}
        {notes.map(note => (
          <button
            key={note.id}
            onClick={() => onSelect(note)}
            className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
              selectedId === note.id
                ? 'bg-indigo-50 font-medium text-indigo-600 dark:bg-slate-700 dark:text-indigo-400'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-700'
            }`}
          >
            <span className="block truncate">{note.title || 'Untitled'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/NotesList.tsx
git commit -m "feat: add NotesList component"
```

---

## Task 5: Create NoteEditor component

**Files:**
- Create: `src/components/notes/NoteEditor.tsx`

- [ ] **Step 1: Create `src/components/notes/NoteEditor.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Note } from '../../types'

interface NoteEditorProps {
  note: Note | null
  onUpdate: (patch: Partial<Note> & { id: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onBack?: () => void  // mobile only
}

export function NoteEditor({ note, onUpdate, onDelete, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state when selected note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setBody(note.body)
      setDeleteError('')
    }
  }, [note?.id])

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!note) return
    if (titleDebounce.current) clearTimeout(titleDebounce.current)
    titleDebounce.current = setTimeout(() => {
      onUpdate({ id: note.id, title: value }).catch(e => console.warn('Auto-save failed', e))
    }, 1000)
  }

  function handleBodyChange(value: string) {
    setBody(value)
    if (!note) return
    if (bodyDebounce.current) clearTimeout(bodyDebounce.current)
    bodyDebounce.current = setTimeout(() => {
      onUpdate({ id: note.id, body: value }).catch(e => console.warn('Auto-save failed', e))
    }, 1000)
  }

  async function handleDelete() {
    if (!note) return
    setDeleteError('')
    try {
      await onDelete(note.id)
    } catch {
      setDeleteError('Failed to delete note.')
    }
  }

  if (!note) {
    return (
      <div className="hidden flex-1 items-center justify-center text-sm text-gray-400 dark:text-gray-500 md:flex">
        Select a note or create a new one
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-900">
      {/* Editor header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-slate-700">
        {onBack && (
          <button
            onClick={onBack}
            className="mr-1 rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700"
          >
            ←
          </button>
        )}
        <input
          className="flex-1 bg-transparent text-base font-semibold text-gray-900 placeholder-gray-400 focus:outline-none dark:text-white dark:placeholder-gray-500"
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Untitled"
        />
        <button
          onClick={handleDelete}
          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-slate-700"
          title="Delete note"
        >
          🗑
        </button>
      </div>

      {deleteError && (
        <p className="px-3 pt-1 text-xs text-red-500">{deleteError}</p>
      )}

      {/* Body textarea */}
      <textarea
        className="flex-1 resize-none bg-transparent p-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none dark:text-gray-200 dark:placeholder-gray-500"
        value={body}
        onChange={e => handleBodyChange(e.target.value)}
        placeholder="Start writing..."
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/NoteEditor.tsx
git commit -m "feat: add NoteEditor component with auto-save"
```

---

## Task 6: Create NotesPage

**Files:**
- Create: `src/pages/NotesPage.tsx`

- [ ] **Step 1: Create `src/pages/NotesPage.tsx`**

```tsx
import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { NotesList } from '../components/notes/NotesList'
import { NoteEditor } from '../components/notes/NoteEditor'
import { useNotes } from '../hooks/useNotes'
import { Note } from '../types'

export default function NotesPage() {
  const { notes, loadError, createNote, updateNote, deleteNote } = useNotes()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')

  const selectedNote = notes.find(n => n.id === selectedId) ?? null

  async function handleCreate() {
    const note = await createNote()
    setSelectedId(note.id)
    setMobileView('editor')
  }

  function handleSelect(note: Note) {
    setSelectedId(note.id)
    setMobileView('editor')
  }

  async function handleDelete(id: string) {
    await deleteNote(id)
    setSelectedId(null)
    setMobileView('list')
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {/* NotesList: visible on desktop always; on mobile only when mobileView === 'list' */}
        <div className={`${mobileView === 'editor' ? 'hidden' : 'flex'} w-full md:flex md:w-auto`}>
          <NotesList
            notes={notes}
            selectedId={selectedId}
            loadError={loadError as Error | null}
            onSelect={handleSelect}
            onCreate={handleCreate}
          />
        </div>

        {/* NoteEditor: visible on desktop always; on mobile only when mobileView === 'editor' */}
        <div className={`${mobileView === 'list' ? 'hidden' : 'flex'} flex-1 md:flex`}>
          <NoteEditor
            note={selectedNote}
            onUpdate={updateNote}
            onDelete={handleDelete}
            onBack={mobileView === 'editor' ? () => setMobileView('list') : undefined}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/NotesPage.tsx
git commit -m "feat: add NotesPage with split-panel layout"
```

---

## Task 7: Wire up route and nav

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Navbar.tsx`

- [ ] **Step 1: Add the Notes route to `src/App.tsx`**

Add the import at the top with the other page imports:
```tsx
import NotesPage from './pages/NotesPage'
```

Add the route inside `<Routes>`, after the `/app/today` route:
```tsx
<Route path="/app/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
```

The routes block should look like:
```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/signup" element={<SignupPage />} />
  <Route path="/reset-password" element={<ResetPasswordPage />} />
  <Route path="/app" element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
  <Route path="/app/today" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
  <Route path="/app/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
  <Route path="/app/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
  <Route path="*" element={<Navigate to="/login" replace />} />
</Routes>
```

- [ ] **Step 2: Add the Notes link to `src/components/layout/Navbar.tsx`**

Add this variable with the existing `isToday` declaration:
```tsx
const isNotes = location.pathname.startsWith('/app/notes')
```

Add the Notes link in the nav links row, after the Week link:
```tsx
<Link
  to="/app/notes"
  className={`rounded px-3 py-1.5 text-sm ${isNotes ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700'}`}
>
  Notes
</Link>
```

Also update `isToday` active check — the Week link should only be active when on `/app` exactly and not on `/app/notes`:
```tsx
const isToday = location.pathname === '/app/today'
const isWeek = location.pathname === '/app'
const isNotes = location.pathname.startsWith('/app/notes')
```

Update the Week link to use `isWeek`:
```tsx
<Link to="/app" className={`rounded px-3 py-1.5 text-sm ${isWeek ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700'}`}>Week</Link>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/layout/Navbar.tsx
git commit -m "feat: wire up Notes route and nav link"
```

---

## Task 8: Smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the following manually**

- Notes link appears in the nav alongside Today and Week
- Navigating to `/app/notes` loads the page without errors
- Clicking "+ New" creates a note and opens the editor
- Typing in the title or body auto-saves after ~1 second (verify in Supabase Table Editor → notes)
- Clicking 🗑 deletes the note and returns to the list
- On mobile viewport (DevTools → toggle device toolbar): list and editor toggle correctly, ← Back button works
- Week link no longer stays highlighted when on Notes page

- [ ] **Step 3: Push to remote**

```bash
git push
```

Netlify will auto-deploy from the push.
