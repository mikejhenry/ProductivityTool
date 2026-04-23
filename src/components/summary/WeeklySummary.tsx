import { TimeBlock } from '../../types'
import { computeWeekSummary } from '../../lib/summaryUtils'

export function WeeklySummary({ blocks }: { blocks: TimeBlock[] }) {
  const s = computeWeekSummary(blocks)
  const hours = (s.totalMinutes / 60).toFixed(1)

  return (
    <div className="flex gap-6 border-b border-gray-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
      <Stat label="Planned" value={`${hours}h`} />
      <Stat label="Completed" value={s.completed} color="text-green-600" />
      <Stat label="Moved" value={s.moved} color="text-amber-500" />
      <Stat label="Skipped" value={s.skipped} color="text-gray-400" />
      <Stat label="Rate" value={`${s.completionRate.toFixed(0)}%`} color="text-indigo-600" />
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-700' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className={`font-semibold dark:text-white ${color}`}>{value}</span>
    </div>
  )
}
