import { useState } from 'react'
import { TimeBlock } from '../../types'
import { formatWeekRange, addDays } from '../../lib/dateUtils'

interface WeekOption {
  weekStart: Date
  blocks: TimeBlock[]
}

interface Props {
  currentWeekStart: Date
  allFetchedBlocks: TimeBlock[]
  onCopy: (blocks: TimeBlock[], targetWeekStart: Date) => void
  onClose: () => void
}

export function WeekPickerModal({ currentWeekStart, allFetchedBlocks, onCopy, onClose }: Props) {
  const [selected, setSelected] = useState<Date | null>(null)

  const options: WeekOption[] = Array.from({ length: 12 }, (_, i) => {
    const ws = addDays(currentWeekStart, -(i + 1) * 7)
    const wsEnd = addDays(ws, 7)
    const weekBlocks = allFetchedBlocks.filter(b => {
      const t = new Date(b.start_time)
      return t >= ws && t < wsEnd
    })
    return { weekStart: ws, blocks: weekBlocks }
  })

  const preview = selected
    ? options.find(o => o.weekStart.getTime() === selected.getTime())?.blocks ?? []
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Copy from previous week</h2>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.weekStart.getTime()}
              onClick={() => setSelected(opt.weekStart)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected?.getTime() === opt.weekStart.getTime() ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              <span className="font-medium">{formatWeekRange(opt.weekStart)}</span>
              <span className="ml-2 text-gray-400">{opt.blocks.length} blocks</span>
            </button>
          ))}
        </div>
        {selected && preview.length > 0 && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-slate-700">
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Will copy:</p>
            {preview.slice(0, 5).map(b => (
              <p key={b.id} className="text-xs text-gray-600 dark:text-gray-300">• {b.title}</p>
            ))}
            {preview.length > 5 && <p className="text-xs text-gray-400">…and {preview.length - 5} more</p>}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700" onClick={onClose}>Cancel</button>
          <button
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={!selected || preview.length === 0}
            onClick={() => { if (selected) { onCopy(preview, currentWeekStart); onClose() } }}
          >
            Copy {preview.length} blocks
          </button>
        </div>
      </div>
    </div>
  )
}
