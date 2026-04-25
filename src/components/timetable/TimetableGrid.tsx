import { useRef, useEffect, useState } from 'react'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { TimeBlock as TBType, Task } from '../../types'
import { DayColumn, HOUR_HEIGHT } from './DayColumn'
import { BlockModal } from './BlockModal'
import { addDays } from '../../lib/dateUtils'

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
)

interface Props {
  weekStart: Date
  blocks: TBType[]
  tasks: Task[]
  onCreate: (block: Omit<TBType, 'id' | 'user_id' | 'created_at'>) => Promise<TBType>
  onUpdate: (patch: Partial<TBType> & { id: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TimetableGrid({ weekStart, blocks, tasks, onCreate, onUpdate, onDelete }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [modal, setModal] = useState<Partial<TBType> | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Auto-scroll to 6am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = HOUR_HEIGHT * 6
    }
  }, [])

  function jumpToNow() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = HOUR_HEIGHT * new Date().getHours() - 100
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || !over.data.current || !active.data.current) return

    // Moving an existing block
    if (active.data.current.block) {
      const block = active.data.current.block as TBType
      const { date } = over.data.current as { date: Date }
      const duration = new Date(block.end_time).getTime() - new Date(block.start_time).getTime()
      const newStart = new Date(date)
      newStart.setHours(
        new Date(block.start_time).getHours(),
        new Date(block.start_time).getMinutes(),
        0, 0
      )
      const newEnd = new Date(newStart.getTime() + duration)
      onUpdate({ id: block.id, start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
      return
    }

    // Dropping a task onto the grid to create a block
    if (active.data.current.task) {
      const task = active.data.current.task as Task
      const { date } = over.data.current as { date: Date }
      const start = new Date(date)
      if (task.preferred_time) {
        const [h, m] = task.preferred_time.split(':').map(Number)
        start.setHours(h, m, 0, 0)
      }
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      setModal({
        title: task.title,
        task_id: task.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        type: 'soft',
        status: 'planned',
        reminder_minutes: [],
        color: '#6366f1',
      })
    }
  }

  function handleCellClick(startTime: Date) {
    const end = new Date(startTime.getTime() + 60 * 60 * 1000)
    setModal({
      start_time: startTime.toISOString(),
      end_time: end.toISOString(),
    })
  }

  function handleEditBlock(block: TBType) {
    setModal(block)
  }

  function blocksForDay(dayIndex: number) {
    const date = addDays(weekStart, dayIndex)
    const dateStr = date.toDateString()
    return blocks.filter(b => {
      const startStr = new Date(b.start_time).toDateString()
      const endStr = new Date(b.end_time).toDateString()
      return startStr === dateStr || endStr === dateStr
    })
  }

  const dailyTasks = tasks.filter(t => t.type === 'daily')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Jump to now button */}
      <div className="flex items-center justify-end border-b border-gray-200 px-3 py-1 dark:border-slate-700">
        <button
          className="rounded px-2 py-2 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700 sm:py-1"
          onClick={jumpToNow}
        >
          Jump to now
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div ref={scrollRef} className="flex flex-1 overflow-auto">
          {/* Hours column */}
          <div className="sticky left-0 z-10 flex w-10 flex-col flex-shrink-0 border-r border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 sm:w-14">
            <div className="h-6 border-b border-gray-200 dark:border-slate-700" />
            {HOUR_LABELS.map((label, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 text-right"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="absolute right-1.5 -top-2 text-[10px] leading-none text-gray-400 dark:text-slate-500">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="grid min-w-[480px] flex-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {Array.from({ length: 7 }, (_, i) => (
              <DayColumn
                key={i}
                dayIndex={i}
                weekStart={weekStart}
                blocks={blocksForDay(i)}
                dailyTasks={dailyTasks}
                onEdit={handleEditBlock}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {modal && (
        <BlockModal
          initial={modal}
          tasks={tasks}
          onSave={block =>
            modal.id
              ? onUpdate({ id: modal.id, ...block })
              : onCreate(block)
          }
          onDelete={modal.id ? () => { onDelete(modal.id!); setModal(null) } : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
