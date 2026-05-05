/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

import { buildReminders, type Reminder } from './lib/buildReminders'

const DB_NAME = 'timeblock-sw'
const STORE = 'reminders'

async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveReminders(reminders: Reminder[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  reminders.forEach(r => tx.objectStore(STORE).put(r))
  return new Promise(res => { tx.oncomplete = () => res() })
}

async function deleteRemindersForBlock(blockId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const all: Reminder[] = await new Promise(res => {
    const r = store.getAll()
    r.onsuccess = () => res(r.result as Reminder[])
  })
  all.filter(r => r.blockId === blockId).forEach(r => store.delete(r.id))
  return new Promise(res => { tx.oncomplete = () => res() })
}

async function getDueReminders(): Promise<Reminder[]> {
  const db = await getDB()
  const all: Reminder[] = await new Promise(res => {
    const tx = db.transaction(STORE, 'readonly')
    const r = tx.objectStore(STORE).getAll()
    r.onsuccess = () => res(r.result as Reminder[])
  })
  const now = Date.now()
  return all.filter(r => r.fireAt <= now + 5000 && r.fireAt > now - 60000)
}

async function deleteFiredReminders(ids: string[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  ids.forEach(id => tx.objectStore(STORE).delete(id))
  return new Promise(res => { tx.oncomplete = () => res() })
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('message', async (e: ExtendableMessageEvent) => {
  if (e.data.type === 'SCHEDULE') {
    const reminders = buildReminders(e.data.blocks, Date.now())
    await saveReminders(reminders)
  }
  if (e.data.type === 'CANCEL') {
    await deleteRemindersForBlock(e.data.blockId as string)
  }
})

setInterval(async () => {
  const due = await getDueReminders()
  for (const r of due) {
    await self.registration.showNotification(r.blockTitle, {
      body: r.body,
      icon: '/icons/icon-192.png',
      tag: r.id,
      actions: [
        { action: 'complete', title: 'Mark complete' },
        { action: 'snooze', title: 'Snooze 10 min' },
      ],
    })
  }
  if (due.length > 0) await deleteFiredReminders(due.map(r => r.id))
}, 30_000) as unknown as number

// Handle server-sent push notifications
self.addEventListener('push', (e: PushEvent) => {
  const data = e.data?.json() ?? {}
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'TimeBlock', {
      body: data.body ?? 'You have an upcoming block',
      icon: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url ?? '/app/today' },
      actions: [
        { action: 'open', title: 'Open app' },
      ],
    })
  )
})

self.addEventListener('notificationclick', (e: NotificationEvent) => {
  e.notification.close()
  if (e.action === 'snooze') return
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) return clients[0].focus()
      return self.clients.openWindow('/app/today')
    })
  )
})
