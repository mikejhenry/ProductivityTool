import { useDraggable } from '@dnd-kit/core'
import { Task } from '../../types'

export function TaskItem({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { task },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-lg border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800 ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
        <button
          className="ml-2 flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onClick={e => { e.stopPropagation(); onEdit() }}
        >
          ✎
        </button>
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500">{task.type}</span>
    </div>
  )
}
