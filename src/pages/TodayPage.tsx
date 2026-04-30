import { useState, useEffect } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { NotificationBanner } from '../components/layout/NotificationBanner'
import { TodayTimeline } from '../components/dashboard/TodayTimeline'
import { TaskChecklist } from '../components/dashboard/TaskChecklist'
import { TaskModal } from '../components/tasks/TaskModal'
import { ScheduledTaskModal, BlockPayload } from '../components/tasks/ScheduledTaskModal'
import { DailyPanel } from '../components/daily/DailyPanel'
import { DailyItemModal } from '../components/daily/DailyItemModal'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { Task, TimeBlock } from '../types'

type TaskMode = null | 'pick' | 'normal' | 'scheduled'

interface TypePickerModalProps {
  onNormal: () => void
  onScheduled: () => void
  onClose: () => void
}

function TypePickerModal({ onNormal, onScheduled, onClose }: TypePickerModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xs rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" role="dialog" aria-modal="true" aria-labelledby="picker-modal-title" onClick={e => e.stopPropagation()}>
        <h2 id="picker-modal-title" className="mb-4 text-lg font-bold text-gray-900 dark:text-white">New task</h2>
        <div className="flex flex-col gap-3">
          <button type="button" className="btn-primary" onClick={onNormal}>Normal task</button>
          <button type="button" className="btn-primary" onClick={onScheduled}>Scheduled task</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function TodayPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock, createBlock } = useTimeBlocks(weekStart)
  const { tasks, createTask, deleteTask } = useTasks()
  const [taskMode, setTaskMode] = useState<TaskMode>(null)
  const [dailyModal, setDailyModal] = useState<{ task?: Task } | null>(null)

  const todayBlocks = blocks.filter(b =>
    new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleStatusChange(id: string, status: TimeBlock['status']) {
    updateBlock({ id, status })
  }

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  async function handleCreateNormalTask(payload: Omit<Task, 'id' | 'user_id' | 'created_at'>) {
    try {
      await createTask(payload)
      setTaskMode(null)
    } catch (e) {
      console.error('Failed to create task', e)
    }
  }

  async function handleCreateScheduledTask(
    taskPayload: Omit<Task, 'id' | 'user_id' | 'created_at'>,
    blockPayload: BlockPayload
  ) {
    let newTask: Task | undefined
    try {
      newTask = await createTask(taskPayload)
      // Use local-time constructor to avoid UTC midnight off-by-one in non-UTC timezones
      const startDate = new Date(`${blockPayload.date}T00:00:00`)
      const [startH, startM] = blockPayload.startTime.split(':').map(Number)
      startDate.setHours(startH, startM, 0, 0)
      const endDate = new Date(`${blockPayload.date}T00:00:00`)
      const [endH, endM] = blockPayload.endTime.split(':').map(Number)
      endDate.setHours(endH, endM, 0, 0)
      await createBlock({
        task_id: newTask.id,
        title: taskPayload.title,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        type: 'soft',
        status: 'planned',
        reminder_minutes: [],
        color: null,
      })
      setTaskMode(null)
    } catch (e) {
      console.error('Failed to create scheduled task', e)
      // Best-effort rollback: delete the task if block creation failed
      if (newTask) {
        deleteTask(newTask.id).catch(re => console.error('Failed to rollback task', re))
      }
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <NotificationBanner blocks={blocks} />
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <TodayTimeline
          blocks={todayBlocks}
          onStatusChange={handleStatusChange}
          onAddTask={() => setTaskMode('pick')}
        />
        <TaskChecklist
          tasks={tasks}
          todayBlocks={todayBlocks}
          onToggle={handleToggle}
          onAddTask={() => setTaskMode('pick')}
        />
        <DailyPanel
          tasks={tasks}
          todayBlocks={todayBlocks}
          onToggle={handleToggle}
          onAdd={() => setDailyModal({})}
          onEdit={task => setDailyModal({ task })}
        />
      </div>
      {taskMode === 'pick' && (
        <TypePickerModal
          onNormal={() => setTaskMode('normal')}
          onScheduled={() => setTaskMode('scheduled')}
          onClose={() => setTaskMode(null)}
        />
      )}
      {taskMode === 'normal' && (
        <TaskModal
          onSave={handleCreateNormalTask}
          onClose={() => setTaskMode(null)}
        />
      )}
      {taskMode === 'scheduled' && (
        <ScheduledTaskModal
          onSave={handleCreateScheduledTask}
          onClose={() => setTaskMode(null)}
        />
      )}
      {dailyModal !== null && (
        <DailyItemModal
          initial={dailyModal.task}
          weekStart={weekStart}
          onClose={() => setDailyModal(null)}
        />
      )}
    </div>
  )
}
