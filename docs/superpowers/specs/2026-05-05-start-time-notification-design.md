# Start-Time Notification Design

## Overview

Add a notification that fires at the exact start time of each time block, in addition to the existing reminder notifications. The notification body reads "Starting now" to distinguish it from pre-event reminders ("Starting soon").

---

## Scope

One file changes: `src/sw.ts`. No changes to the React layer, data model, or Supabase schema.

---

## Changes to `src/sw.ts`

### 1. Add `body` field to `Reminder` interface

```ts
interface Reminder {
  id: string
  blockId: string
  blockTitle: string
  body: string      // new field
  fireAt: number
}
```

### 2. SCHEDULE message handler

After building reminders from `reminder_minutes` (with `body: 'Starting soon'`), push one additional reminder per block at `start_time`:

```ts
// existing reminder_minutes loop
for (const mins of (block.reminder_minutes as number[])) {
  const fireAt = new Date(block.start_time as string).getTime() - mins * 60 * 1000
  if (fireAt > Date.now()) {
    reminders.push({
      id: `${block.id}-${mins}`,
      blockId: block.id as string,
      blockTitle: block.title as string,
      body: 'Starting soon',
      fireAt,
    })
  }
}

// new: start-time reminder
const startFireAt = new Date(block.start_time as string).getTime()
if (startFireAt > Date.now()) {
  reminders.push({
    id: `${block.id}-start`,
    blockId: block.id as string,
    blockTitle: block.title as string,
    body: 'Starting now',
    fireAt: startFireAt,
  })
}
```

### 3. Notification display

Replace the hardcoded `body: 'Starting soon'` in `showNotification` with `r.body`:

```ts
await self.registration.showNotification(r.blockTitle, {
  body: r.body,    // was: 'Starting soon'
  icon: '/icons/icon-192.png',
  tag: r.id,
  actions: [
    { action: 'complete', title: 'Mark complete' },
    { action: 'snooze', title: 'Snooze 10 min' },
  ],
})
```

---

## Behaviour

| Reminder type | ID format | `fireAt` | Body |
|---|---|---|---|
| Pre-event (e.g. 15 min) | `${blockId}-15` | `start_time - 15 min` | "Starting soon" |
| Pre-event (e.g. 5 min) | `${blockId}-5` | `start_time - 5 min` | "Starting soon" |
| Start-time | `${blockId}-start` | `start_time` | "Starting now" |

The same `fireAt > Date.now()` guard applies to the start-time reminder — past events do not get a notification.

The existing polling loop (every 30 s), IndexedDB store, and deduplication by `id` all work unchanged.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Block with no `reminder_minutes` | Start-time reminder still fires |
| Block already started when scheduled | `fireAt > Date.now()` guard skips it |
| SW updates while old reminders exist in IndexedDB | Old reminders lack `body` field — `showNotification` receives `undefined` as body. One-time edge case; resolved after next SCHEDULE message overwrites them |
| Block `reminder_minutes` contains `0` | Creates a pre-event reminder with `id: '${blockId}-0'` at `fireAt = start_time`. Distinct ID from start-time reminder `'${blockId}-start'` — both fire, which produces a duplicate notification. This is unlikely (no UI sets `0` in `reminder_minutes`) but if it occurs, the duplicate is harmless |

---

## Files Affected

| File | Change |
|---|---|
| `src/sw.ts` | Add `body` to `Reminder` interface; set `body` on existing reminders; add start-time reminder per block; use `r.body` in `showNotification` |
