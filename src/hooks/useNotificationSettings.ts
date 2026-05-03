import { useState } from 'react'

const PAUSED_KEY = 'notif-paused'
const PERMISSION_KEY = 'notif-permission'

export function useNotificationSettings() {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'denied'
  )

  const [paused, setPausedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PAUSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  const enabled = permission === 'granted' && !paused

  function setPaused(v: boolean): void {
    try {
      if (v) {
        localStorage.setItem(PAUSED_KEY, 'true')
      } else {
        localStorage.removeItem(PAUSED_KEY)
      }
    } catch {
      // localStorage unavailable — fail silently
    }
    setPausedState(v)
  }

  async function requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied'
    try {
      const result = await Notification.requestPermission()
      try {
        localStorage.setItem(PERMISSION_KEY, result)
      } catch {
        // localStorage unavailable — fail silently
      }
      setPermission(result)
      return result
    } catch {
      return 'denied'
    }
  }

  return { permission, paused, enabled, supported, requestPermission, setPaused }
}
