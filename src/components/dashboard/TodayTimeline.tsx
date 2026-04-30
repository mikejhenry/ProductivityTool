import { TimeBlock } from '../../types'

const STATUS_COLOR: Record<string, string> = {
  planned: 'border-indigo-400',
  completed: 'border-green-400',
  moved: 'border-amber-400',
  skipped: 'border-gray-300',
}

const STATUS_OPACITY: Record<string, string> = {
  planned: '',
  completed: 'opacity-60',
  moved: 'opacity-50',
  skipped: 'opacity-40',
}

interface Props {
  blocks: TimeBlock[]
  onStatusChange: (id: string, status: TimeBlock['status']) => void
  onAddTask?: () => void
}

export function TodayTimeline({ blocks, onStatusChange, onAddTask }: Props) {
  const now = new Date()
  const sorted = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time))

  const upcoming = sorted.filter(b =>
    new Date(b.start_time) > now &&
    new Date(b.start_time) <= new Date(now.getTime() + 2 * 60 * 60 * 1000)
  )

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {upcoming.length > 0 && (
        <div className="mb-4 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-900/30">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">Up next</p>
          <p className="font-semibold text-gray-900 dark:text-white">{upcoming[0].title}</p>
          <p className="text-sm text-gray-500">{fmt(upcoming[0].start_time)} – {fmt(upcoming[0].end_time)}</p>
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Nothing scheduled for today.</p>
          {onAddTask && (
            <button type="button" className="btn-primary" onClick={onAddTask}>
              + Schedule something
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(block => {
            const isPast = new Date(block.end_time) < now
            return (
              <div
                key={block.id}
                className={`flex items-start gap-3 rounded-lg border-l-4 bg-white p-3 shadow-sm dark:bg-slate-800 ${STATUS_COLOR[block.status]} ${STATUS_OPACITY[block.status] || (isPast && block.status === 'planned' ? 'opacity-60' : '')}`}
              >
                <div className="flex-1">
                  <p className={`font-medium text-gray-900 dark:text-white ${block.status === 'completed' ? 'line-through' : ''}`}>
                    {block.title}
                  </p>
                  <p className="text-xs text-gray-400">{fmt(block.start_time)} – {fmt(block.end_time)}</p>
                </div>
                <select
                  className="rounded border border-gray-200 bg-transparent text-xs dark:border-slate-600 dark:text-gray-300"
                  value={block.status}
                  onChange={e => onStatusChange(block.id, e.target.value as TimeBlock['status'])}
                >
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="moved">Moved</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
