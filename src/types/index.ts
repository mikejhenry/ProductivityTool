export interface Profile {
  id: string
  theme: 'light' | 'dark'
  email: string | null
  has_real_email: boolean
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  type: 'daily' | 'flexible'
  preferred_time: string | null  // "HH:MM:SS"
  repeat_days: number[]          // 0=Sun…6=Sat
  completed_at: string | null    // ISO timestamp; null = not done
  sort_order: number
  created_at: string
}

export interface TimeBlock {
  id: string
  user_id: string
  task_id: string | null
  title: string
  start_time: string             // ISO timestamp
  end_time: string               // ISO timestamp
  type: 'soft' | 'hard'
  status: 'planned' | 'completed' | 'moved' | 'skipped'
  reminder_minutes: number[]
  color: string | null
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

export interface ShoppingItem {
  id: string
  user_id: string
  name: string
  checked: boolean
  created_at: string
}

export interface WeekSummary {
  totalMinutes: number
  completed: number
  moved: number
  skipped: number
  completionRate: number
}
