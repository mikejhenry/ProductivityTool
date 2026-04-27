import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { NotificationBanner } from '../components/layout/NotificationBanner'
import { TodayTimeline } from '../components/dashboard/TodayTimeline'
import { TaskChecklist } from '../components/dashboard/TaskChecklist'
import { TaskModal } from '../components/tasks/TaskModal'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { Task, TimeBlock } from '../types'

export default function TodayPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock } = useTimeBlocks(weekStart)
  const { tasks, createTask } = useTasks()
  const [showModal, setShowModal] = useState(false)

  const todayBlocks = blocks.filter(b =>
    new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleStatusChange(id: string, status: TimeBlock['status']) {
    updateBlock({ id, status })
  }

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  async function handleCreateTask(payload: Omit<Task, 'id' | 'user_id' | 'created_at'>) {
    try {
      await createTask(payload)
      setShowModal(false)
    } catch (e) {
      console.error('Failed to create task', e)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <NotificationBanner blocks={blocks} />
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <TodayTimeline blocks={todayBlocks} onStatusChange={handleStatusChange} />
        <TaskChecklist
          tasks={tasks}
          todayBlocks={todayBlocks}
          onToggle={handleToggle}
          onAddTask={() => setShowModal(true)}
        />
      </div>
      {showModal && (
        <TaskModal
          onSave={handleCreateTask}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
