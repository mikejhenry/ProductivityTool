import { TimeBlock, WeekSummary } from '../types'

export function computeWeekSummary(blocks: TimeBlock[]): WeekSummary {
  let totalMinutes = 0
  let completed = 0, moved = 0, skipped = 0

  for (const b of blocks) {
    const mins = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000
    totalMinutes += mins
    if (b.status === 'completed') completed++
    else if (b.status === 'moved') moved++
    else if (b.status === 'skipped') skipped++
  }

  const actionable = completed + moved + skipped
  return {
    totalMinutes,
    completed,
    moved,
    skipped,
    completionRate: actionable ? (completed / actionable) * 100 : 0,
  }
}
