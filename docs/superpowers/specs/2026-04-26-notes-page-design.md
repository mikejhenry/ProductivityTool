# Notes Page — Design Spec
**Date:** 2026-04-26

## Overview

Add a Notes page to the app where users can create, edit, and delete personal notes. Notes have a title and a body. The page uses a split-panel layout: a list on the left and an inline editor on the right (desktop), collapsing to full-screen editor on mobile.

---

## Data Layer

### Supabase table: `notes`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users(id)`, `ON DELETE CASCADE` |
| `title` | `text` | Default `'Untitled'` |
| `body` | `text` | Default `''` |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()`, updated on every save |

### RLS

- Enable RLS on `notes`
- Single policy: users can `SELECT`, `INSERT`, `UPDATE`, `DELETE` their own rows (`auth.uid() = user_id`)

### SQL to run in Supabase

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

---

## Architecture

### Hook: `useNotes`

Single hook encapsulating all Supabase interactions:

- `notes` — sorted by `updated_at` descending (most recently edited first)
- `createNote()` — inserts a new note with default title/body, returns the new note
- `updateNote({ id, title?, body? })` — patches the note, sets `updated_at = now()`
- `deleteNote(id)` — deletes the note, clears selection if it was selected

### Auto-save

The `NoteEditor` component debounces title and body changes by **1 second**. After the debounce fires, it calls `updateNote`. No save button — saving is silent and automatic.

---

## Components

### `NotesPage` (`src/pages/NotesPage.tsx`)

Page shell at `/app/notes`. Owns the selected note state (`selectedNoteId`). Renders `Navbar`, then a horizontal split of `NotesList` + `NoteEditor`.

### `NotesList` (`src/components/notes/NotesList.tsx`)

- "New note" button at the top — calls `createNote()`, then selects the returned note
- Lists all notes by title, newest-edited first
- Selected note highlighted in indigo (matching app's existing active styles)
- Empty state: "No notes yet. Create one above."

### `NoteEditor` (`src/components/notes/NoteEditor.tsx`)

- Shown when a note is selected; placeholder message when nothing is selected (desktop only)
- Editable title field at the top (plain styled input, not a textarea)
- Large textarea below for the body, fills remaining vertical space
- Trash icon button in the top-right corner to delete the note
- On delete: removes note, clears selection, returns to list on mobile

---

## Layout

### Desktop (`md:` breakpoint and above)

```
[ Navbar — full width                              ]
[ NotesList (260px) | NoteEditor (flex-1)          ]
```

Both panels are always visible. Selecting a note updates the editor panel in place.

### Mobile (below `md:`)

```
[ Navbar ]
[ NotesList — full screen ]
         ↓ tap a note
[ NoteEditor — full screen, with ← Back button ]
```

The editor takes over the full screen. A `← Back` button in the editor header returns to the list. Implemented via conditional rendering based on `selectedNoteId` and a `mobileView` state (`'list' | 'editor'`).

---

## Navigation

Add a "Notes" link to the nav row in `Navbar.tsx`, alongside Today and Week. Active state detection: `location.pathname.startsWith('/app/notes')`.

Add route in `App.tsx`:
```tsx
<Route path="/app/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
```

---

## Error Handling

- Failed saves: log to console, no UI disruption (auto-save is best-effort; data is in the input so nothing is lost)
- Failed deletes: show a brief inline error message in the editor header
- Failed loads: show an error state in the list panel

---

## Out of Scope

- Note search / filtering
- Rich text / markdown formatting
- Note sharing
- Folders or tags
