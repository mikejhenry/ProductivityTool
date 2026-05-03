import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useNotificationSettings } from '../hooks/useNotificationSettings'
import { ToggleSwitch } from '../components/settings/ToggleSwitch'
import { Navbar } from '../components/layout/Navbar'

export default function SettingsPage() {
  const { profile, updateEmail } = useProfile()
  const [email, setEmail] = useState(profile?.email ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const { permission, paused, enabled, supported, requestPermission, setPaused } =
    useNotificationSettings()

  async function handleSaveEmail() {
    setError('')
    try {
      await updateEmail(email)
      setSaved(true)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleToggle() {
    if (permission === 'default') {
      const result = await requestPermission()
      // Explicitly clear any stale pause flag that may have been set before permission was granted
      if (result === 'granted') setPaused(false)
    } else if (permission === 'granted') {
      setPaused(!paused)
    }
    // 'denied': toggle is disabled, handler never fires
  }

  function notifStatusText(): string {
    if (!supported) return 'Not supported in this browser'
    if (permission === 'denied') return 'Blocked in browser — enable in browser settings'
    if (permission === 'granted' && paused) return 'Notifications are paused'
    if (permission === 'granted') return 'Notifications are on'
    return 'Click to enable notifications'
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="mx-auto mt-8 w-full max-w-md rounded-xl bg-white p-4 shadow dark:bg-slate-800 sm:p-6">
        <h1 className="mb-6 text-lg font-bold text-gray-900 dark:text-white sm:text-xl">Settings</h1>

        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Recovery Email</h2>
          {!profile?.has_real_email && (
            <p className="mb-2 text-xs text-amber-600">No recovery email set. Add one to enable password reset.</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <button
              className="w-full rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 sm:w-auto"
              onClick={handleSaveEmail}
            >
              Save
            </button>
          </div>
          {saved && <p className="mt-1 text-xs text-green-600">Saved! Check your email to confirm.</p>}
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Notifications</h2>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{notifStatusText()}</p>
            <ToggleSwitch
              checked={enabled}
              disabled={permission === 'denied' || !supported}
              label="Enable notifications"
              onChange={handleToggle}
            />
          </div>
        </div>

        <Link to="/app/today" className="text-sm text-indigo-600 underline dark:text-indigo-400">
          ← Back to app
        </Link>
      </div>
    </div>
  )
}
