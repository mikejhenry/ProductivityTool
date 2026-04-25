import { useState } from 'react'
import { Task } from '../../types'
import { TaskItem } from './TaskItem'
import { TaskModal } from './TaskModal'

interface Props {
  tasks: Task[]
  open: boolean
  onClose: () => void
  onCreate: (t: Omit<Task, 'id' | 'user_id' | 'created_at'>) => Promise<Task>
  onUpdate: (patch: Partial<Task> & { id: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TaskList({ tasks, open, onClose, onCreate, onUpdate, onDelete }: Props) {
  const [modal, setModal] = useState<{ task?: Task } | null>(null)

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Overlay panel */}
      <aside className="fixed right-0 top-0 z-40 flex h-full w-64 flex-col border-l border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-slate-700">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Tasks</span>
          <div className="flex items-center gap-1">
            <button
              className="rounded px-2 py-1 text-lg leading-none text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700"
              onClick={() => setModal({})}
            >
              +
            </button>
            <button
              className="rounded px-2 py-1 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-slate-700"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {tasks.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">No tasks yet. Click + to add one.</p>
          )}
          {tasks.map(t => (
            <TaskItem key={t.id} task={t} onEdit={() => setModal({ task: t })} />
          ))}
        </div>
        {modal && (
          <TaskModal
            initial={modal.task}
            onSave={t => modal.task ? onUpdate({ id: modal.task.id, ...t }) : onCreate(t)}
            onDelete={modal.task ? () => { onDelete(modal.task!.id); setModal(null) } : undefined}
            onClose={() => setModal(null)}
          />
        )}
      </aside>
    </>
  )
}
