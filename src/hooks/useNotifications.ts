import { useEffect, useRef } from 'react'
import { TimeBlock } from '../types'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function savePushSubscription(sub: PushSubscription) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const json = sub.toJSON()
  await supabase.from('push_subscriptions').upsert(
    { user_id: session.user.id, endpoint: sub.endpoint, subscription: json },
    { onConflict: 'endpoint' }
  )
}

async function subscribeToPush(reg: ServiceWorkerRegistration) {
  if (!VAPID_PUBLIC_KEY) return
  try {
    const existing = await reg.pushManager.getSubscription()
    if (existing) { await savePushSubscription(existing); return }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    await savePushSubscription(sub)
  } catch (e) {
    console.warn('Push subscription failed', e)
  }
}

export function useNotifications(blocks: TimeBlock[]) {
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null)
  const blocksRef = useRef<TimeBlock[]>(blocks)
  blocksRef.current = blocks

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return
    const stored = localStorage.getItem('notif-permission')
    if (stored === 'denied' || stored === 'dismissed') return

    navigator.serviceWorker.ready.then(reg => {
      swRegRef.current = reg
      if (Notification.permission === 'granted' && localStorage.getItem('notif-paused') !== 'true') {
        // Schedule via SW interval (works while tab is open)
        if (blocksRef.current.length > 0) {
          reg.active?.postMessage({ type: 'SCHEDULE', blocks: blocksRef.current })
        }
        // Subscribe to Web Push (works in background)
        subscribeToPush(reg)
      }
    }).catch(e => console.warn('SW ready failed', e))

    navigator.serviceWorker.register('/sw.js').catch(e => {
      console.warn('SW registration failed', e)
    })
  }, [])

  // Re-schedule whenever blocks change
  useEffect(() => {
    if (!swRegRef.current?.active) return
    if (Notification.permission !== 'granted' || blocks.length === 0) return
    if (localStorage.getItem('notif-paused') === 'true') return
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
      await subscribeToPush(reg)
    }
    return result
  }

  return {
    requestPermission,
    supported: 'Notification' in window && 'serviceWorker' in navigator,
  }
}
