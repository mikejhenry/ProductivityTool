import { Task, TimeBlock } from '../../types'

interface Props {
  tasks: Task[]
  todayBlocks: TimeBlock[]
  onToggle: (blockId: string, done: boolean) => void
  onAddTask?: () => void
}

export function TaskChecklist({ tasks, todayBlocks, onToggle, onAddTask }: Props) {
  const today = new Date().getDay()
  const dailyTasks = tasks.filter(t => t.type === 'daily' && t.repeat_days.includes(today))
  const linkedTaskIds = new Set(todayBlocks.map(b => b.task_id).filter((id): id is string => id !== null))
  const linkedFlexible = tasks.filter(t => t.type === 'flexible' && linkedTaskIds.has(t.id))

  const isTaskDone = (task: Task) =>
    todayBlocks.some(b => b.task_id === task.id && b.status === 'completed')

  const blockForTask = (task: Task) => todayBlocks.find(b => b.task_id === task.id)

  const allTasks = [...dailyTasks, ...linkedFlexible]

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
      <div className="space-y-2">
        {allTasks.map(task => {
          const done = isTaskDone(task)
          const block = blockForTask(task)
          return (
            <label key={task.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={done}
                disabled={!block}
                onChange={e => block && onToggle(block.id, e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-indigo-600 sm:h-4 sm:w-4"
              />
              <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                {task.title}
              </span>
            </label>
          )
        })}
      </div>
    </aside>
  )
}
