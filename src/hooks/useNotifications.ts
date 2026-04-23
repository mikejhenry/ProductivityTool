import { useEffect, useRef } from 'react'
import { TimeBlock } from '../types'

let swReg: ServiceWorkerRegistration | null = null

export function useNotifications(blocks: TimeBlock[]) {
  const initialized = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return
    if (initialized.current) return
    initialized.current = true

    const stored = localStorage.getItem('notif-permission')
    if (stored === 'denied' || stored === 'dismissed') return

    navigator.serviceWorker.register('/sw.js').then(reg => {
      swReg = reg
    }).catch(e => {
      console.warn('SW registration failed', e)
    })
  }, [])

  useEffect(() => {
    if (!swReg?.active || blocks.length === 0) return
    if (Notification.permission !== 'granted') return
    swReg.active.postMessage({ type: 'SCHEDULE', blocks })
  }, [blocks])

  async function requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied'
    const result = await Notification.requestPermission()
    localStorage.setItem('notif-permission', result)
    if (result === 'granted' && swReg?.active) {
      swReg.active.postMessage({ type: 'SCHEDULE', blocks })
    }
    return result
  }

  return {
    requestPermission,
    supported: 'Notification' in window && 'serviceWorker' in navigator,
  }
}
