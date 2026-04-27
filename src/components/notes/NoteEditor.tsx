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
    if (titleDebounce.current) clearTimeout(titleDebounce.current)
    if (bodyDebounce.current) clearTimeout(bodyDebounce.current)
    if (note) {
      setTitle(note.title)
      setBody(note.body)
      setDeleteError('')
    }
  }, [note?.id])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounce.current) clearTimeout(titleDebounce.current)
      if (bodyDebounce.current) clearTimeout(bodyDebounce.current)
    }
  }, [])

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
