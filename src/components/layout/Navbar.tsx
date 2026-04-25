import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../hooks/useProfile'
import { useWeek } from '../../contexts/WeekContext'
import { formatWeekRange, addDays } from '../../lib/dateUtils'

interface NavbarProps {
  onCopyWeek?: () => void
}

export function Navbar({ onCopyWeek }: NavbarProps) {
  const { signOut } = useAuth()
  const { profile, updateTheme } = useProfile()
  const { weekStart, setWeekStart } = useWeek()
  const navigate = useNavigate()
  const location = useLocation()
  const isToday = location.pathname === '/app/today'
  const theme = profile?.theme ?? 'light'

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark')
    const next = isDark ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', !isDark)
    localStorage.setItem('theme', next)
    updateTheme(next)
  }

  return (
    <nav className="border-b border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {/* Top row: title + actions */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-bold text-indigo-600 dark:text-indigo-400">TimeBlock</span>
        <div className="flex items-center gap-1">
          <button className="rounded p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/app/settings" className="rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700">Settings</Link>
          <button className="rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700" onClick={async () => { await signOut(); navigate('/login') }}>Sign out</button>
        </div>
      </div>

      {/* Nav links row */}
      <div className="flex items-center gap-1 border-t border-gray-100 px-3 py-1 dark:border-slate-700">
        <Link to="/app/today" className={`rounded px-3 py-1.5 text-sm ${isToday ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700'}`}>Today</Link>
        <Link to="/app" className={`rounded px-3 py-1.5 text-sm ${!isToday ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700'}`}>Week</Link>

        {/* Week navigation — inline on the nav row, only on week view */}
        {!isToday && (
          <div className="ml-auto flex items-center gap-1">
            <button className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
            <span className="text-xs text-gray-600 dark:text-gray-300 sm:text-sm">{formatWeekRange(weekStart)}</span>
            <button className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
            <button
              onClick={() => onCopyWeek?.()}
              className="rounded px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700"
            >
              Copy week
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
