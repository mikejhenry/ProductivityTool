import { useEffect, useRef } from 'react'
import { TimeBlock } from '../types'

export function useNotifications(blocks: TimeBlock[]) {
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null)
  const blocksRef = useRef<TimeBlock[]>(blocks)
  blocksRef.current = blocks

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return
    const stored = localStorage.getItem('notif-permission')
    if (stored === 'denied' || stored === 'dismissed') return

    // navigator.serviceWorker.ready resolves only when the SW is fully active,
    // avoiding the race where .active is null right after register() resolves.
    navigator.serviceWorker.ready.then(reg => {
      swRegRef.current = reg
      // Send current blocks immediately after SW is ready
      if (Notification.permission === 'granted' && blocksRef.current.length > 0) {
        reg.active?.postMessage({ type: 'SCHEDULE', blocks: blocksRef.current })
      }
    }).catch(e => console.warn('SW ready failed', e))

    // Register if not already registered
    navigator.serviceWorker.register('/sw.js').catch(e => {
      console.warn('SW registration failed', e)
    })
  }, [])

  // Re-schedule whenever blocks change (e.g. new block created, reminder edited)
  useEffect(() => {
    if (!swRegRef.current?.active) return
    if (Notification.permission !== 'granted' || blocks.length === 0) return
    swRegRef.current.active.postMessage({ type: 'SCHEDULE', blocks })
  }, [blocks])

  async function requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied'
    const result = await Notification.requestPermission()
    localStorage.setItem('notif-permission', result)
    if (result === 'granted') {
      const reg = await navigator.serviceWorker.ready
      swRegRef.current = reg
      reg.active?.postMessage({ type: 'SCHEDULE', blocks: blocksRef.current })
    }
    return result
  }

  return {
    requestPermission,
    supported: 'Notification' in window && 'serviceWorker' in navigator,
  }
}
