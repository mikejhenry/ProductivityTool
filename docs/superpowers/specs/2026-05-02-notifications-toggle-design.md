# Notifications Toggle Design

## Overview

Add an enable/disable toggle to the Settings page Notifications section. Users can turn notifications on (requesting browser permission) and off (pausing at the app level) without leaving the app. Since browsers don't allow programmatic permission revocation, "off" is implemented as an app-level pause flag in localStorage.

---

## Data Layer

### localStorage keys

| Key | Values | Meaning |
|---|---|---|
| `notif-permission` | `'granted'` \| `'denied'` \| `'dismissed'` | Existing key — browser permission result cache |
| `notif-paused` | `'true'` \| absent | New key — app-level pause flag |

No Supabase changes. Notifications are per-device; a local flag is the right scope.

### Computed state

`enabled = Notification.permission === 'granted' && notif-paused !== 'true'`

---

## New Hook: `useNotificationSettings`

**File:** `src/hooks/useNotificationSettings.ts`

Owns permission state and the paused flag. Used by SettingsPage.

**Returns:**

| Name | Type | Description |
|---|---|---|
| `permission` | `NotificationPermission` | Live browser permission state (`'default'` \| `'granted'` \| `'denied'`) |
| `paused` | `boolean` | True when `notif-paused === 'true'` in localStorage |
| `enabled` | `boolean` | `permission === 'granted' && !paused` |
| `supported` | `boolean` | `'Notification' in window && 'serviceWorker' in navigator` |
| `requestPermission` | `() => Promise<NotificationPermission>` | Calls browser API, writes `notif-permission` to localStorage |
| `setPaused` | `(v: boolean) => void` | Writes `notif-paused` to localStorage, triggers re-render |

`requestPermission` is a parallel implementation of the same logic as in `useNotifications` (same browser API call, same `notif-permission` localStorage write). `useNotifications` keeps its own copy — callers such as TodayPage are unaffected.

---

## Changes to `useNotifications`

**File:** `src/hooks/useNotifications.ts`

Both scheduling effects add a paused guard before posting to the service worker:

```ts
if (localStorage.getItem('notif-paused') === 'true') return
```

- Startup effect: skip `postMessage({ type: 'SCHEDULE', ... })` when paused
- Blocks-change effect: skip re-schedule when paused

When paused is turned back off, the next blocks change naturally re-triggers the blocks-change effect, restoring scheduling.

---

## New Component: `ToggleSwitch`

**File:** `src/components/settings/ToggleSwitch.tsx`

A `<button role="switch">` styled with Tailwind. No third-party library.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `checked` | `boolean` | Whether the toggle is on |
| `disabled` | `boolean?` | Reduces opacity to 40%, prevents interaction |
| `onChange` | `() => void` | Called on click |

**Visual:** Indigo (`bg-indigo-600`) track when on, gray (`bg-gray-200 dark:bg-slate-600`) when off. White circular knob slides via `translate-x`. Focus ring via `focus:ring-indigo-500`.

---

## SettingsPage Changes

**File:** `src/pages/SettingsPage.tsx`

Replace the static Notifications `<p>` with a row containing the toggle and status text.

### Toggle states

| Browser permission | Paused | Toggle | Status text |
|---|---|---|---|
| `default` | — | off, enabled | "Click to enable notifications" |
| `granted` | false | on, enabled | "Notifications are on" |
| `granted` | true | off, enabled | "Notifications are paused" |
| `denied` | — | off, disabled | "Blocked in browser — enable in browser settings" |
| not supported | — | off, disabled | "Not supported in this browser" |

### Toggle handler logic

```ts
async function handleToggle() {
  if (permission === 'default') {
    const result = await requestPermission()
    if (result === 'granted') setPaused(false)
  } else if (permission === 'granted') {
    setPaused(!paused)
  }
  // 'denied': toggle is disabled, handler never fires
}
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| User dismisses browser permission prompt | `requestPermission()` returns `'default'` or `'denied'`; toggle stays off; status text updates |
| `requestPermission()` throws | Caught, permission stays `'default'`, no state change |
| localStorage unavailable | `setPaused` wrapped in try/catch; fails silently; toggle reflects browser permission |
| `notif-paused` set but permission is `'denied'` | `enabled` is `false` regardless — paused flag is irrelevant |
| Second click while permission prompt is open | Browser prompt is modal; second click cannot fire |

---

## Files Affected

| File | Change |
|---|---|
| `src/hooks/useNotificationSettings.ts` | **Create** — permission state + paused flag |
| `src/components/settings/ToggleSwitch.tsx` | **Create** — accessible toggle switch component |
| `src/hooks/useNotifications.ts` | **Modify** — add paused guard to both scheduling effects |
| `src/pages/SettingsPage.tsx` | **Modify** — replace static text with toggle UI |
