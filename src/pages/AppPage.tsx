import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { TimetableGrid } from '../components/timetable/TimetableGrid'
import { TaskList } from '../components/tasks/TaskList'
import { WeeklySummary } from '../components/summary/WeeklySummary'
import { WeekPickerModal } from '../components/timetable/WeekPickerModal'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { useNotifications } from '../hooks/useNotifications'
import { TimeBlock } from '../types'
import { getWeekStart, shiftBlockByDays } from '../lib/dateUtils'

export default function AppPage() {
  const { weekStart } = useWeek()
  const { blocks, createBlock, updateBlock, deleteBlock } = useTimeBlocks(weekStart)
  const { tasks, createTask, updateTask, deleteTask } = useTasks()
  useNotifications(blocks)

  const [showWeekPicker, setShowWeekPicker] = useState(false)

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

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar onCopyWeek={() => setShowWeekPicker(true)} />
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
