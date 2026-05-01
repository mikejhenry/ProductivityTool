import { isSameDay } from '../../lib/dateUtils'
import { Task } from '../../types'

interface Props {
  tasks: Task[]
  onToggle: (taskId: string, done: boolean) => void
  onAdd: () => void
  onEdit: (task: Task) => void
}

export function DailyPanel({ tasks, onToggle, onAdd, onEdit }: Props) {
  const dailyTasks = tasks.filter(t => t.type === 'daily')

  const isTaskDone = (task: Task) =>
    !!task.completed_at && isSameDay(new Date(task.completed_at), new Date())

  return (
    <aside className="w-full overflow-y-auto border-t border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900 md:w-64 md:border-l md:border-t-0 md:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Daily Routines</h2>
        <button
          type="button"
          onClick={onAdd}
          className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-700"
        >
          + Add
        </button>
      </div>
      {dailyTasks.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No daily routines yet. Add one to get started.
        </p>
      )}
      <div className="space-y-2">
        {dailyTasks.map(task => {
          const done = isTaskDone(task)
          return (
            <div key={task.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={done}
                onChange={e => onToggle(task.id, e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-indigo-600 sm:h-4 sm:w-4"
              />
              <button
                type="button"
                onClick={() => onEdit(task)}
                className={`flex-1 text-left text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}
              >
                {task.title}
              </button>
              {task.preferred_time && (
                <span className="shrink-0 text-xs text-indigo-500 dark:text-indigo-400">
                  {task.preferred_time.slice(0, 5)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
