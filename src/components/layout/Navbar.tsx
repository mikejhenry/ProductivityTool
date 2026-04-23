import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../hooks/useProfile'
import { useWeek } from '../../contexts/WeekContext'
import { formatWeekRange, addDays } from '../../lib/dateUtils'

export function Navbar() {
  const { signOut } = useAuth()
  const { profile, updateTheme } = useProfile()
  const { weekStart, setWeekStart } = useWeek()
  const navigate = useNavigate()
  const location = useLocation()
  const isToday = location.pathname === '/app/today'
  const theme = profile?.theme ?? 'light'

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', next === 'dark')
    updateTheme(next)
  }

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-4">
        <span className="font-bold text-indigo-600 dark:text-indigo-400">TimeBlock</span>
        <Link to="/app/today" className={`btn-ghost ${isToday ? 'font-semibold' : ''}`}>Today</Link>
        <Link to="/app" className={`btn-ghost ${!isToday ? 'font-semibold' : ''}`}>Week</Link>
      </div>

      {!isToday && (
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
          <span className="text-sm text-gray-700 dark:text-gray-300">{formatWeekRange(weekStart)}</span>
          <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <Link to="/app/settings" className="btn-ghost">Settings</Link>
        <button className="btn-ghost" onClick={async () => { await signOut(); navigate('/login') }}>Sign out</button>
      </div>
    </nav>
  )
}
