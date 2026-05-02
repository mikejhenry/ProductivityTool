import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { isSameDay } from '../../lib/dateUtils'
import { Task, TimeBlock } from '../../types'

interface Props {
  tasks: Task[]
  todayBlocks: TimeBlock[]
  onToggle: (taskId: string, done: boolean) => void
  onReorder: (orderedIds: string[]) => void
  onAddTask?: () => void
}

interface SortableTaskRowProps {
  task: Task
  done: boolean
  onToggle: (taskId: string, done: boolean) => void
}

function SortableTaskRow({ task, done, onToggle }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex cursor-default items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab px-1 text-gray-300 hover:text-gray-500 dark:text-slate-600 dark:hover:text-slate-400 select-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      <input
        type="checkbox"
        checked={done}
        onChange={e => onToggle(task.id, e.target.checked)}
        className="h-5 w-5 rounded border-gray-300 text-indigo-600 sm:h-4 sm:w-4"
      />
      <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
        {task.title}
      </span>
    </div>
  )
}

export function TaskChecklist({ tasks, todayBlocks, onToggle, onReorder, onAddTask }: Props) {
  const today = new Date().getDay()
  const dailyTasks = tasks.filter(t => t.type === 'daily' && t.repeat_days.includes(today))
  const linkedTaskIds = new Set(todayBlocks.map(b => b.task_id).filter((id): id is string => id !== null))
  const linkedFlexible = tasks.filter(t => t.type === 'flexible' && linkedTaskIds.has(t.id))

  const isTaskDone = (task: Task) => {
    if (!task.completed_at) return false
    if (task.type === 'daily') return isSameDay(new Date(task.completed_at), new Date())
    return true
  }

  const allTasks = [...dailyTasks, ...linkedFlexible]

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = allTasks.findIndex(t => t.id === active.id)
    const newIndex = allTasks.findIndex(t => t.id === over.id)
    const reorderedVisible = arrayMove(allTasks, oldIndex, newIndex)
    // Merge back into the full tasks list so sort_order is written for every task
    const visibleIds = new Set(allTasks.map(t => t.id))
    const remaining = tasks.filter(t => !visibleIds.has(t.id))
    onReorder([...reorderedVisible, ...remaining].map(t => t.id))
  }

  return (
    <aside className="w-full overflow-y-auto border-t border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 md:w-64 md:border-l md:border-t-0 md:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Today's Tasks</h2>
        {onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-700"
          >
            + New task
          </button>
        )}
      </div>
      {allTasks.length === 0 && <p className="text-xs text-gray-400">No tasks for today.</p>}
      <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
        <SortableContext items={allTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {allTasks.map(task => (
              <SortableTaskRow
                key={task.id}
                task={task}
                done={isTaskDone(task)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </aside>
  )
}
