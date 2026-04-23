import { TimeBlock } from '../types'

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + 6)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d: Date) => {
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const dateObj = new Date(`${year}-${month}-${day}`)
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return `${fmt(weekStart)} – ${fmt(end)}`
}

export function minutesFromMidnight(isoString: string): number {
  const d = new Date(isoString)
  return d.getHours() * 60 + d.getMinutes()
}

export function blockTopPercent(startIso: string): number {
  return (minutesFromMidnight(startIso) / 1440) * 100
}

export function blockHeightPercent(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  return ((end - start) / 1000 / 60 / 1440) * 100
}

export function shiftBlockByDays(block: TimeBlock, days: number): TimeBlock {
  const ms = days * 24 * 60 * 60 * 1000
  return {
    ...block,
    start_time: new Date(new Date(block.start_time).getTime() + ms).toISOString(),
    end_time: new Date(new Date(block.end_time).getTime() + ms).toISOString(),
  }
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}
