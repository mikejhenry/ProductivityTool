// src/pages/DailyPage.tsx
import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { DailyPanel } from '../components/daily/DailyPanel'
import { DailyItemModal } from '../components/daily/DailyItemModal'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { Task } from '../types'

export default function DailyPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock } = useTimeBlocks(weekStart)
  const { tasks } = useTasks()
  const [modal, setModal] = useState<{ task?: Task } | null>(null)

  const todayBlocks = blocks.filter(
    b => new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-lg overflow-y-auto p-4">
          <DailyPanel
            tasks={tasks}
            todayBlocks={todayBlocks}
            onToggle={handleToggle}
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
