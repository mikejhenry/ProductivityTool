import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { NotificationBanner } from '../components/layout/NotificationBanner'
import { TimetableGrid } from '../components/timetable/TimetableGrid'
import { TaskList } from '../components/tasks/TaskList'
import { WeeklySummary } from '../components/summary/WeeklySummary'
import { WeekPickerModal } from '../components/timetable/WeekPickerModal'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { TimeBlock } from '../types'
import { getWeekStart, shiftBlockByDays } from '../lib/dateUtils'

export default function AppPage() {
  const { weekStart } = useWeek()
  const { blocks, createBlock, updateBlock, deleteBlock } = useTimeBlocks(weekStart)
  const { tasks, createTask, updateTask, deleteTask } = useTasks()

  const [showWeekPicker, setShowWeekPicker] = useState(false)
  const [showTasks, setShowTasks] = useState(false)

  async function handleCopyWeek(sourceBlocks: TimeBlock[], targetWeekStart: Date) {
    if (sourceBlocks.length === 0) return
    const sourceWeekStart = getWeekStart(new Date(sourceBlocks[0].start_time))
    const daysDiff = Math.round((targetWeekStart.getTime() - sourceWeekStart.getTime()) / 86400000)
    await Promise.all(
      sourceBlocks.map(b => {
        const shifted = shiftBlockByDays(b, daysDiff)
        return createBlock({
          title: shifted.title,
          start_time: shifted.start_time,
          end_time: shifted.end_time,
          type: shifted.type,
          status: 'planned',
          reminder_minutes: shifted.reminder_minutes,
          color: shifted.color,
          task_id: shifted.task_id,
        })
      })
    )
  }

  async function handleUpdateBlock(patch: Partial<TimeBlock> & { id: string }) {
    await updateBlock(patch)
    if ('title' in patch) {
      const block = blocks.find(b => b.id === patch.id)
      if (block?.task_id) {
        await updateTask({ id: block.task_id, title: patch.title })
      }
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar onCopyWeek={() => setShowWeekPicker(true)} />
      <NotificationBanner blocks={blocks} />
      <WeeklySummary blocks={blocks} />
      <div className="relative flex flex-1 overflow-hidden">
        <TimetableGrid
          weekStart={weekStart}
          blocks={blocks}
          tasks={tasks}
          onCreate={createBlock}
          onUpdate={handleUpdateBlock}
          onDelete={deleteBlock}
        />
        <button
          onClick={() => setShowTasks(true)}
          className="absolute bottom-20 right-4 z-20 min-w-[72px] rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-700 sm:bottom-4 sm:py-2"
        >
          Tasks
        </button>
        <TaskList
          tasks={tasks}
          open={showTasks}
          onClose={() => setShowTasks(false)}
          onCreate={createTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
        />
      </div>
      {showWeekPicker && (
        <WeekPickerModal
          currentWeekStart={weekStart}
          allFetchedBlocks={blocks}
          onCopy={handleCopyWeek}
          onClose={() => setShowWeekPicker(false)}
        />
      )}
    </div>
  )
}
