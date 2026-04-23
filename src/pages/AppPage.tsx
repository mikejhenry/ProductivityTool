import { Navbar } from '../components/layout/Navbar'
import { TimetableGrid } from '../components/timetable/TimetableGrid'
import { TaskList } from '../components/tasks/TaskList'
import { WeeklySummary } from '../components/summary/WeeklySummary'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { useNotifications } from '../hooks/useNotifications'

export default function AppPage() {
  const { weekStart } = useWeek()
  const { blocks, createBlock, updateBlock, deleteBlock } = useTimeBlocks(weekStart)
  const { tasks, createTask, updateTask, deleteTask } = useTasks()
  useNotifications(blocks)

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <WeeklySummary blocks={blocks} />
      <div className="flex flex-1 overflow-hidden">
        <TimetableGrid
          weekStart={weekStart}
          blocks={blocks}
          tasks={tasks}
          onCreate={createBlock}
          onUpdate={updateBlock}
          onDelete={deleteBlock}
        />
        <TaskList
          tasks={tasks}
          onCreate={createTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
        />
      </div>
    </div>
  )
}
