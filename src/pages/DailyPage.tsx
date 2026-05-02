// src/pages/DailyPage.tsx
import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { DailyPanel } from '../components/daily/DailyPanel'
import { DailyItemModal } from '../components/daily/DailyItemModal'
import { useWeek } from '../contexts/WeekContext'
import { useTasks } from '../hooks/useTasks'
import { Task } from '../types'

export default function DailyPage() {
  const { weekStart } = useWeek()
  const { tasks, toggleTask, reorderTasks } = useTasks()
  const [modal, setModal] = useState<{ task?: Task } | null>(null)

  function handleToggle(taskId: string, done: boolean) {
    toggleTask({ id: taskId, done })
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-lg overflow-y-auto p-4">
          <DailyPanel
            tasks={tasks}
            onToggle={handleToggle}
            onReorder={ids => reorderTasks(ids).catch(e => console.error('Failed to reorder tasks', e))}
            onAdd={() => setModal({})}
            onEdit={task => setModal({ task })}
          />
        </div>
      </div>
      {modal !== null && (
        <DailyItemModal
          initial={modal.task}
          weekStart={weekStart}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
