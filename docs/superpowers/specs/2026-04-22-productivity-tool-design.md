# Productivity Tool — Design Spec
**Date:** 2026-04-22  
**Status:** Approved

---

## 1. Product Overview

A hybrid task manager + weekly timetable that helps users plan their time realistically and adapt when plans change. No gamification, no visible AI features. Minimal, low-friction UI with flexible planning at its core.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Styling | Tailwind CSS (`darkMode: 'class'`) |
| Routing | React Router v6 |
| Server state | React Query |
| Drag-and-drop | @dnd-kit |
| Backend / Auth / DB | Supabase (PostgreSQL + RLS) |
| Notifications | Service Worker + Web Notifications API + IndexedDB |
| PWA | `manifest.json` for iOS home screen support |

---

## 3. Authentication

### Signup flow
- Email is **optional** at signup
- If no email provided: a silent placeholder (`user_<uuid>@noreply.timeblock.app`) is generated for Supabase auth internally — the user never sees it
- Email confirmation is **disabled globally** in Supabase dashboard settings
- If email is skipped, a non-blocking warning is shown: *"Without an email, you won't be able to recover your account if you forget your password."*
- `user_metadata.has_real_email` is set to `true` only when a real email is provided

### Password reset
- Only available if `has_real_email === true`
- Reset page checks this flag — if false, shows: *"No recovery email on file — you can add one in Settings."*
- Reset email sent via Supabase's built-in flow (one email per user, on demand only)

### Email management post-signup
- Users can add or update their email in Settings at any time
- Adding an email sends a single confirmation email at that point
- Minimises Supabase email usage to password resets and optional email confirmations only

### Session persistence
- Supabase JS client handles session refresh automatically
- Protected routes redirect to `/login` if no active session

### Routes
| Path | Page | Protected |
|---|---|---|
| `/login` | Login | No |
| `/signup` | Signup | No |
| `/reset-password` | ResetPassword | No |
| `/app` | Main app (timetable + tasks) | Yes |
| `/app/settings` | Settings | Yes |

---

## 4. Database Schema

```sql
-- User preferences
CREATE TABLE profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme          text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  email          text,
  has_real_email boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  type           text NOT NULL CHECK (type IN ('daily', 'flexible')),
  preferred_time time,
  repeat_days    int[] DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Time blocks
CREATE TABLE time_blocks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id          uuid REFERENCES tasks(id) ON DELETE SET NULL,
  title            text NOT NULL,
  start_time       timestamptz NOT NULL,
  end_time         timestamptz NOT NULL,
  type             text NOT NULL CHECK (type IN ('soft', 'hard')),
  status           text NOT NULL DEFAULT 'planned'
                     CHECK (status IN ('planned','completed','moved','skipped')),
  reminder_minutes int[] DEFAULT '{}',
  color            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON tasks(user_id);
CREATE INDEX ON time_blocks(user_id);
CREATE INDEX ON time_blocks(start_time);
CREATE INDEX ON time_blocks(task_id);
```

### Row Level Security

```sql
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile"  ON profiles    USING (id = auth.uid())         WITH CHECK (id = auth.uid());
CREATE POLICY "own tasks"    ON tasks       USING (user_id = auth.uid())    WITH CHECK (user_id = auth.uid());
CREATE POLICY "own blocks"   ON time_blocks USING (user_id = auth.uid())    WITH CHECK (user_id = auth.uid());
```

---

## 5. Frontend Structure

```
src/
├── main.tsx
├── App.tsx
├── sw.ts                        # Service worker (compiled separately by Vite)
│
├── lib/
│   ├── supabase.ts              # Supabase client singleton
│   └── queryClient.ts           # React Query client config
│
├── hooks/
│   ├── useAuth.ts               # session, signIn, signUp, signOut
│   ├── useProfile.ts            # theme, email, has_real_email
│   ├── useTasks.ts              # CRUD for tasks
│   ├── useTimeBlocks.ts         # CRUD + fetch by week (date range)
│   └── useNotifications.ts      # SW registration, permission, scheduling
│
├── components/
│   ├── layout/
│   │   └── Navbar.tsx           # Logo, week nav, jump-to-now, theme toggle, logout
│   ├── timetable/
│   │   ├── TimetableGrid.tsx    # Outer grid, DndContext wrapper
│   │   ├── DayColumn.tsx        # Single day column, droppable
│   │   ├── TimeBlock.tsx        # Draggable block, resize handle, status menu
│   │   └── BlockModal.tsx       # Create/edit block (title, type, color, reminders)
│   ├── tasks/
│   │   ├── TaskList.tsx         # Sidebar task list
│   │   ├── TaskItem.tsx         # Draggable task → drop on grid creates block
│   │   └── TaskModal.tsx        # Create/edit task
│   └── summary/
│       └── WeeklySummary.tsx    # Stat row: planned/completed/moved/skipped/rate
│
├── pages/
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── ResetPassword.tsx
│   ├── Settings.tsx             # Email management, theme toggle
│   └── AppPage.tsx              # Protected: Navbar + grid + task sidebar
│
└── types/
    └── index.ts                 # Task, TimeBlock, Profile TypeScript interfaces
```

**State management:**
- React Query owns all server state (tasks, blocks, profile)
- React Context owns current week start date (`Date`) and auth session
- All block mutations optimistically update React Query cache; roll back on error with a toast

---

## 6. Timetable Grid

### Layout
- **Classic 7-day grid:** columns = Mon–Sun, rows = 30-minute slots
- **24-hour range:** midnight to midnight (48 slots total)
- Grid is **vertically scrollable** within a fixed-height container
- On load, auto-scrolls to **6am** as the default viewport position
- **"Jump to now"** button in navbar snaps scroll to the current hour

### Block positioning
- Blocks positioned absolutely within `DayColumn` via `top` + `height` calculated from `start_time`/`end_time` relative to midnight
- **Overnight blocks** (e.g. sleep 11pm–7am) split across the bottom of one day column and the top of the next, matching Google Calendar behaviour

### Drag-and-drop interactions

| Interaction | Behaviour |
|---|---|
| Click + drag on empty cell | Creates new block — opens `BlockModal` on drop |
| Drag existing block | Moves to new day/time — optimistic update + Supabase mutation |
| Drag resize handle (bottom) | Extends/shrinks end time in 15-min snaps |
| Drag task from TaskList | Creates a new block linked to that `task_id` |

### Week navigation
- `‹` / `›` arrows in navbar move backward/forward one week
- Current week stored in React Context; changing it triggers `useTimeBlocks(weekStart)` refetch
- React Query caches each week independently — navigating back is instant after first load

### Copy from a previous week
- *"Copy from previous week"* button always visible in navbar
- Opens a **week picker modal** listing the last 12 weeks with date range + block count per week
- User selects a week → sees a preview of blocks to be copied → confirms
- Copied blocks: status reset to `"planned"`, timestamps shifted +7n days to target week
- Existing blocks in the target week are preserved (no overwrite)

---

## 7. Task System

### Task types
| Type | Behaviour |
|---|---|
| `daily` | Repeats on selected days (`repeat_days`). Shown as suggested blocks in timetable if `preferred_time` set. |
| `flexible` | No fixed schedule. Lives in the task sidebar until manually dragged or scheduled. |

### Suggested blocks
- Daily tasks with `preferred_time` appear as faint suggestion overlays in the timetable on their repeat days
- Clicking a suggestion promotes it to a real block

---

## 8. Block Behaviour

- No "failure" states — missed blocks are not highlighted as failures
- Status options accessible via right-click or block menu: `completed`, `moved`, `skipped`
- `planned` is the default — blocks stay planned until the user changes them
- Easy rescheduling via drag-and-drop at any time

---

## 9. Notification System

### Permission flow
- On first login: non-intrusive banner — *"Enable notifications to get reminders for your time blocks"*
- Clicking Enable triggers `Notification.requestPermission()`
- Permission state stored in `localStorage`; if denied, banner is hidden permanently
- Re-enable available via Settings

### Scheduling
1. `useNotifications` sends each block's `start_time` + `reminder_minutes` to the SW via `postMessage`
2. SW stores scheduled reminders in **IndexedDB** (persists across tab switches and minimize)
3. SW checks every 30s via `setInterval` — fires `showNotification()` when a reminder time is reached
4. Notification includes: block title, time, and two actions — *"Mark complete"* and *"Snooze 10 min"*
5. Clicking notification opens/focuses the app and scrolls to the block
6. On block update or delete, SW is notified to cancel that block's reminders from IndexedDB

### Per-block reminders
- Each block has a `reminder_minutes` array (e.g. `[30, 10, 5]`)
- Configured in `BlockModal` — users add/remove reminder offsets freely
- No app-wide default; reminder list starts empty

### Cross-platform support

| Platform | Support | Notes |
|---|---|---|
| Chrome / Edge desktop | Full | Background + minimized |
| Firefox desktop | Full | Background notifications |
| Safari macOS 16+ | Full | |
| Android Chrome | Full | Works minimized |
| iOS Safari 16.4+ | Full | Requires PWA (add to home screen) |
| Older iOS / unsupported | Graceful degradation | Banner shown, no notifications |

A `manifest.json` is included to enable PWA installation on iOS.

---

## 10. Weekly Summary

Displayed as a stat row above the timetable grid (or in a collapsible panel):

| Metric | Definition |
|---|---|
| Total planned hours | Sum of all block durations for the week |
| Completed | Count + hours of `completed` blocks |
| Moved | Count of `moved` blocks |
| Skipped | Count of `skipped` blocks |
| Completion rate | `completed ÷ (completed + moved + skipped)` as % |

Available for any week — current or past — scoped to the visible week's blocks.

---

## 11. Theme System

- Tailwind `darkMode: 'class'` strategy — toggling adds/removes `dark` on `<html>`
- Toggle button (sun/moon icon) in navbar
- Selected theme persisted in `profiles.theme`
- **Light theme:** white background, soft indigo / amber / green block accents
- **Dark theme:** slate background, same accent colors (vibrant against dark)
- Block colors consistent across themes — only background and text shift
- Theme loaded from `profiles` on session start to prevent flash

---

## 12. Version Control

- Git repository initialised at project root
- `.gitignore` includes `node_modules`, `.env`, `.supabase`, `.superpowers/`
- Hosted on GitHub

---

## 13. Local Setup Instructions

```bash
# 1. Clone repo
git clone <repo-url>
cd productivity-tool

# 2. Install dependencies
npm install

# 3. Create .env
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project

# 4. Apply database schema
# Run the SQL in docs/schema.sql in your Supabase SQL editor

# 5. Configure Supabase
# - Disable email confirmation: Auth > Settings > Email Confirmations > OFF
# - Enable RLS policies (included in schema.sql)

# 6. Run dev server
npm run dev
```
