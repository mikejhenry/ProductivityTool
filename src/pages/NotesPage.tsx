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
