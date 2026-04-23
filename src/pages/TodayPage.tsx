import { Navbar } from '../components/layout/Navbar'
import { NotificationBanner } from '../components/layout/NotificationBanner'
import { TodayTimeline } from '../components/dashboard/TodayTimeline'
import { TaskChecklist } from '../components/dashboard/TaskChecklist'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { TimeBlock } from '../types'

export default function TodayPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock } = useTimeBlocks(weekStart)
  const { tasks } = useTasks()

  const todayBlocks = blocks.filter(b =>
    new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleStatusChange(id: string, status: TimeBlock['status']) {
    updateBlock({ id, status })
  }

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <NotificationBanner blocks={blocks} />
      <div className="flex flex-1 overflow-hidden">
        <TodayTimeline blocks={todayBlocks} onStatusChange={handleStatusChange} />
        <TaskChecklist tasks={tasks} todayBlocks={todayBlocks} onToggle={handleToggle} />
      </div>
    </div>
  )
}
