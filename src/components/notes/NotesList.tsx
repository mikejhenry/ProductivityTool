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
