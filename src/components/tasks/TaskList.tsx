import { useState } from 'react'
import { Task } from '../../types'
import { TaskItem } from './TaskItem'
import { TaskModal } from './TaskModal'

interface Props {
  tasks: Task[]
  onCreate: (t: Omit<Task, 'id' | 'user_id' | 'created_at'>) => Promise<Task>
  onUpdate: (patch: Partial<Task> & { id: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TaskList({ tasks, onCreate, onUpdate, onDelete }: Props) {
  const [modal, setModal] = useState<{ task?: Task } | null>(null)

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-l border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-slate-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Tasks</span>
        <button className="btn-ghost text-lg leading-none" onClick={() => setModal({})}>+</button>
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
  )
}
