import { useState, useEffect } from 'react'
import { useNotifications } from '../../hooks/useNotifications'
import { TimeBlock } from '../../types'

export function NotificationBanner({ blocks }: { blocks: TimeBlock[] }) {
  const [show, setShow] = useState(false)
  const { requestPermission, supported } = useNotifications(blocks)

  useEffect(() => {
    if (!supported) return
    const stored = localStorage.getItem('notif-permission')
    if (!stored && Notification.permission === 'default') setShow(true)
  }, [supported])

  if (!show) return null

  return (
    <div className="flex flex-col gap-2 bg-indigo-50 px-4 py-3 text-sm dark:bg-indigo-900/30 sm:flex-row sm:items-center sm:justify-between sm:py-2">
      <span className="text-indigo-700 dark:text-indigo-200">
        Enable notifications to get reminders for your time blocks.
      </span>
      <div className="flex gap-2">
        <button
          className="rounded px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700"
          onClick={() => { localStorage.setItem('notif-permission', 'dismissed'); setShow(false) }}
        >
          Dismiss
        </button>
        <button
          className="rounded bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700"
          onClick={async () => { await requestPermission(); setShow(false) }}
        >
          Enable
        </button>
      </div>
    </div>
  )
}
