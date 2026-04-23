import { useDroppable } from '@dnd-kit/core'
import { TimeBlock as TBType, Task } from '../../types'
import { TimeBlock } from './TimeBlock'
import { blockTopPercent, blockHeightPercent, addDays } from '../../lib/dateUtils'

export const HOUR_HEIGHT = 60 // px per hour

interface Props {
  dayIndex: number
  weekStart: Date
  blocks: TBType[]
  dailyTasks: Task[]
  onEdit: (block: TBType) => void
  onCellClick: (startTime: Date) => void
}

export function DayColumn({ dayIndex, weekStart, blocks, dailyTasks, onEdit, onCellClick }: Props) {
  const date = addDays(weekStart, dayIndex)
  const isToday = new Date().toDateString() === date.toDateString()
  const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })

  const { setNodeRef } = useDroppable({
    id: `day-${dayIndex}`,
    data: { dayIndex, date },
  })

  return (
    <div className="flex flex-col border-r border-gray-200 dark:border-slate-700 last:border-r-0 min-w-0">
      {/* Day header */}
      <div className={`sticky top-0 z-20 border-b border-gray-200 bg-white py-1 text-center text-xs font-medium dark:border-slate-700 dark:bg-slate-900 ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {dayLabel}
      </div>

      {/* Hour grid */}
      <div ref={setNodeRef} className="relative flex-1">
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={hour}
            className="border-b border-gray-100 dark:border-slate-800"
            style={{ height: `${HOUR_HEIGHT}px` }}
            onClick={() => {
              const d = new Date(date)
              d.setHours(hour, 0, 0, 0)
              onCellClick(d)
            }}
          />
        ))}

        {/* Suggested overlays for daily tasks with preferred_time */}
        {dailyTasks
          .filter(t => t.preferred_time && t.repeat_days.includes(date.getDay()))
          .map(t => {
            const [h, m] = t.preferred_time!.split(':').map(Number)
            const topPct = ((h * 60 + m) / 1440) * 100
            return (
              <div
                key={t.id}
                className="absolute left-0.5 right-0.5 cursor-pointer rounded border border-dashed border-indigo-400 bg-indigo-50/60 px-1.5 py-0.5 dark:bg-indigo-900/20"
                style={{ top: `${topPct}%`, height: '4.17%', minHeight: '20px', zIndex: 5 }}
                onClick={(e) => {
                  e.stopPropagation()
                  const start = new Date(date)
                  start.setHours(h, m, 0, 0)
                  onCellClick(start)
                }}
              >
                <p className="truncate text-xs text-indigo-400">{t.title}</p>
              </div>
            )
          })}

        {/* Time blocks */}
        {blocks.map(block => {
          // For overnight blocks starting on this day, clip height to end of day
          const startDay = new Date(block.start_time).toDateString()
          const endDay = new Date(block.end_time).toDateString()
          const isOvernightStart = startDay === date.toDateString() && endDay !== date.toDateString()
          const isOvernightEnd = startDay !== date.toDateString() && endDay === date.toDateString()

          const topPct = isOvernightEnd ? 0 : blockTopPercent(block.start_time)
          const rawHeight = blockHeightPercent(block.start_time, block.end_time)
          const heightPct = isOvernightStart
            ? 100 - topPct
            : isOvernightEnd
            ? blockTopPercent(block.end_time)
            : rawHeight

          return (
            <TimeBlock
              key={block.id}
              block={block}
              topPercent={topPct}
              heightPercent={heightPct}
              onEdit={onEdit}
            />
          )
        })}
      </div>
    </div>
  )
}
