# Start-Time Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fire a "Starting now" notification at the exact start time of each time block, in addition to existing pre-event reminder notifications.

**Architecture:** Extract the reminder-building logic from `sw.ts` into a pure, testable function in `src/lib/buildReminders.ts`. The function adds a start-time reminder (body: "Starting now", id: `${blockId}-start`) for each block alongside the existing pre-event reminders (body: "Starting soon"). `sw.ts` imports the function and uses `r.body` instead of the hardcoded string in `showNotification`.

**Tech Stack:** TypeScript, Vitest, Service Worker API, IndexedDB

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/buildReminders.ts` | Create | Pure function: converts blocks → reminder objects; owns `Reminder` interface |
| `src/test/buildReminders.test.ts` | Create | Unit tests for `buildReminders` |
| `src/sw.ts` | Modify | Import `buildReminders`; remove local `Reminder` interface; use `r.body` in `showNotification` |

---

### Task 1: `buildReminders` pure function

**Files:**
- Create: `src/lib/buildReminders.ts`
- Create: `src/test/buildReminders.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/test/buildReminders.test.ts`:

```ts
import { buildReminders } from '../lib/buildReminders'

// Fixed point in time so tests are deterministic
const NOW = 1_000_000_000_000

const futureBlock = {
  id: 'b1',
  title: 'Morning standup',
  start_time: new Date(NOW + 60 * 60 * 1000).toISOString(), // 1 hour from NOW
  reminder_minutes: [5, 15],
}

describe('buildReminders', () => {
  it('creates pre-event reminders with body "Starting soon"', () => {
    const reminders = buildReminders([futureBlock], NOW)
    const pre = reminders.filter(r => r.id !== 'b1-start')
    expect(pre).toHaveLength(2)
    expect(pre.every(r => r.body === 'Starting soon')).toBe(true)
  })

  it('creates a start-time reminder with body "Starting now"', () => {
    const reminders = buildReminders([futureBlock], NOW)
    const start = reminders.find(r => r.id === 'b1-start')
    expect(start).toBeDefined()
    expect(start!.body).toBe('Starting now')
  })

  it('start-time reminder fireAt equals block start_time in ms', () => {
    const reminders = buildReminders([futureBlock], NOW)
    const start = reminders.find(r => r.id === 'b1-start')
    expect(start!.fireAt).toBe(new Date(futureBlock.start_time).getTime())
  })

  it('start-time reminder has correct blockId and blockTitle', () => {
    const reminders = buildReminders([futureBlock], NOW)
    const start = reminders.find(r => r.id === 'b1-start')
    expect(start!.blockId).toBe('b1')
    expect(start!.blockTitle).toBe('Morning standup')
  })

  it('skips start-time reminder when block start_time is in the past', () => {
    const pastBlock = {
      id: 'b2',
      title: 'Past event',
      start_time: new Date(NOW - 1000).toISOString(), // 1 second ago
      reminder_minutes: [],
    }
    const reminders = buildReminders([pastBlock], NOW)
    expect(reminders.find(r => r.id === 'b2-start')).toBeUndefined()
  })

  it('creates start-time reminder even when reminder_minutes is empty', () => {
    const noPreBlock = {
      id: 'b3',
      title: 'No reminders',
      start_time: new Date(NOW + 30 * 60 * 1000).toISOString(),
      reminder_minutes: [],
    }
    const reminders = buildReminders([noPreBlock], NOW)
    expect(reminders).toHaveLength(1)
    expect(reminders[0].id).toBe('b3-start')
    expect(reminders[0].body).toBe('Starting now')
  })

  it('skips pre-event reminders whose fireAt is in the past', () => {
    const lateBlock = {
      id: 'b4',
      title: 'Almost started',
      // starts in 3 minutes — the 5-min reminder would be 2 minutes ago
      start_time: new Date(NOW + 3 * 60 * 1000).toISOString(),
      reminder_minutes: [5, 2],
    }
    const reminders = buildReminders([lateBlock], NOW)
    // 5-min reminder is in the past (NOW - 2 min), 2-min is future, start is future
    const ids = reminders.map(r => r.id)
    expect(ids).not.toContain('b4-5')
    expect(ids).toContain('b4-2')
    expect(ids).toContain('b4-start')
  })

  it('handles multiple blocks independently', () => {
    const block2 = {
      id: 'b5',
      title: 'Lunch',
      start_time: new Date(NOW + 2 * 60 * 60 * 1000).toISOString(),
      reminder_minutes: [10],
    }
    const reminders = buildReminders([futureBlock, block2], NOW)
    const startIds = reminders.filter(r => r.id.endsWith('-start')).map(r => r.blockId)
    expect(startIds).toContain('b1')
    expect(startIds).toContain('b5')
  })

  it('returns empty array for empty blocks input', () => {
    expect(buildReminders([], NOW)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/buildReminders.test.ts
```

Expected: FAIL — module `../lib/buildReminders` not found.

- [ ] **Step 3: Create `src/lib/buildReminders.ts`**

```ts
export interface Reminder {
  id: string
  blockId: string
  blockTitle: string
  body: string
  fireAt: number
}

export interface ReminderBlock {
  id: string
  title: string
  start_time: string       // ISO timestamp
  reminder_minutes: number[]
}

export function buildReminders(blocks: ReminderBlock[], now: number): Reminder[] {
  const reminders: Reminder[] = []
  for (const block of blocks) {
    for (const mins of block.reminder_minutes) {
      const fireAt = new Date(block.start_time).getTime() - mins * 60 * 1000
      if (fireAt > now) {
        reminders.push({
          id: `${block.id}-${mins}`,
          blockId: block.id,
          blockTitle: block.title,
          body: 'Starting soon',
          fireAt,
        })
      }
    }
    const startFireAt = new Date(block.start_time).getTime()
    if (startFireAt > now) {
      reminders.push({
        id: `${block.id}-start`,
        blockId: block.id,
        blockTitle: block.title,
        body: 'Starting now',
        fireAt: startFireAt,
      })
    }
  }
  return reminders
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/buildReminders.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Run full suite to confirm no regressions**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/buildReminders.ts src/test/buildReminders.test.ts
git commit -m "feat: extract buildReminders pure function with start-time reminder support"
```

---

### Task 2: Update `sw.ts` to use `buildReminders` and `r.body`

**Files:**
- Modify: `src/sw.ts`

`sw.ts` is excluded from the main `tsconfig.json` (see the `"exclude"` array) and has no Vitest tests — it runs in a browser service worker context. The logic is now tested via `buildReminders`. This task wires everything together.

- [ ] **Step 1: Replace `src/sw.ts` with the updated version**

The changes are:
1. Add `import { buildReminders, type Reminder } from '../lib/buildReminders'`
2. Remove the local `Reminder` interface (now imported)
3. Replace the SCHEDULE handler's loop with a call to `buildReminders`
4. Replace `body: 'Starting soon'` with `body: r.body` in `showNotification`

Write the complete file:

```ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

import { buildReminders, type Reminder } from '../lib/buildReminders'

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
```

- [ ] **Step 2: Verify the build compiles without errors**

```bash
npx vite build 2>&1 | tail -20
```

Expected: build completes with no TypeScript errors. The output should include both `dist/assets/main-*.js` and `dist/sw.js`.

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests PASS (the new tests from Task 1 continue to pass; no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/sw.ts
git commit -m "feat: use buildReminders in service worker, fire notification at block start time"
```
