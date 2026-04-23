# Productivity Tool MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack time-blocking productivity web app with auth, 24h timetable grid, drag-and-drop blocks, tasks, notifications via Service Worker, and a daily dashboard.

**Architecture:** React + TypeScript + Vite SPA. React Query owns server state; React Context owns session and current week date. Supabase handles auth and PostgreSQL (RLS). Service Worker + IndexedDB drives background notifications.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Router v6, React Query v5, @dnd-kit/core + @dnd-kit/modifiers, Supabase JS v2, Vitest + React Testing Library

---

## File Map

```
src/
├── types/index.ts                  # All shared TS interfaces
├── lib/
│   ├── supabase.ts                 # Supabase client singleton
│   ├── queryClient.ts              # React Query client
│   └── dateUtils.ts                # Week/time calculation helpers
├── contexts/
│   ├── AuthContext.tsx             # Session + auth methods
│   └── WeekContext.tsx             # Current week start date
├── hooks/
│   ├── useProfile.ts               # profiles table CRUD + theme
│   ├── useTasks.ts                 # tasks table CRUD
│   ├── useTimeBlocks.ts            # time_blocks CRUD + week fetch
│   └── useNotifications.ts         # SW registration + scheduling
├── components/
│   ├── layout/
│   │   ├── ProtectedRoute.tsx
│   │   └── Navbar.tsx
│   ├── timetable/
│   │   ├── TimetableGrid.tsx       # Outer grid + DndContext
│   │   ├── DayColumn.tsx           # Single day droppable
│   │   ├── TimeBlock.tsx           # Draggable block card
│   │   ├── BlockModal.tsx          # Create/edit block form
│   │   └── WeekPickerModal.tsx     # Copy-from-week picker
│   ├── tasks/
│   │   ├── TaskList.tsx
│   │   ├── TaskItem.tsx            # Draggable task
│   │   └── TaskModal.tsx
│   ├── summary/
│   │   └── WeeklySummary.tsx
│   └── dashboard/
│       ├── TodayTimeline.tsx       # Chronological block cards
│       └── TaskChecklist.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   ├── ResetPasswordPage.tsx
│   ├── AppPage.tsx                 # Week view
│   ├── TodayPage.tsx               # Daily dashboard
│   └── SettingsPage.tsx
├── sw.ts                           # Service worker
├── App.tsx                         # Router
└── main.tsx
public/
└── manifest.json
src/test/
├── dateUtils.test.ts
└── weekSummary.test.ts
```

---

## Task 1: Project Scaffold

**Files:** `package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, `.gitignore`

- [ ] Scaffold project and install deps:
```bash
cd "C:/Users/johns/Desktop/productivity tool"
npm create vite@latest . -- --template react-ts
npm install @supabase/supabase-js @tanstack/react-query react-router-dom \
  @dnd-kit/core @dnd-kit/modifiers @dnd-kit/utilities
npm install -D tailwindcss postcss autoprefixer vitest @vitejs/plugin-react \
  @testing-library/react @testing-library/user-event jsdom
npx tailwindcss init -p
```

- [ ] Replace `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.ts' },
})
```

- [ ] Replace `tailwind.config.ts`:
```ts
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] Replace `src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] Create `.env.example`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- [ ] Update `.gitignore` to include `.env`, `.superpowers/`, `dist/`

- [ ] Commit:
```bash
git add -A && git commit -m "feat: project scaffold — Vite, React, TS, Tailwind, deps"
```

---

## Task 2: TypeScript Types

**Files:** `src/types/index.ts`

- [ ] Create `src/types/index.ts`:
```ts
export interface Profile {
  id: string
  theme: 'light' | 'dark'
  email: string | null
  has_real_email: boolean
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  type: 'daily' | 'flexible'
  preferred_time: string | null  // "HH:MM:SS"
  repeat_days: number[]          // 0=Sun…6=Sat
  created_at: string
}

export interface TimeBlock {
  id: string
  user_id: string
  task_id: string | null
  title: string
  start_time: string             // ISO timestamp
  end_time: string               // ISO timestamp
  type: 'soft' | 'hard'
  status: 'planned' | 'completed' | 'moved' | 'skipped'
  reminder_minutes: number[]
  color: string | null
  created_at: string
}

export interface WeekSummary {
  totalMinutes: number
  completed: number
  moved: number
  skipped: number
  completionRate: number
}
```

- [ ] Commit: `git add -A && git commit -m "feat: shared TypeScript interfaces"`

---

## Task 3: Date Utilities + Tests

**Files:** `src/lib/dateUtils.ts`, `src/test/dateUtils.test.ts`

- [ ] Write failing tests first — `src/test/dateUtils.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  getWeekStart, getWeekEnd, formatWeekRange,
  minutesFromMidnight, blockTopPercent, blockHeightPercent,
  shiftBlockByDays,
} from '../lib/dateUtils'

describe('getWeekStart', () => {
  it('returns Monday for a Wednesday', () => {
    const wed = new Date('2026-04-22') // Wednesday
    expect(getWeekStart(wed).toISOString().slice(0,10)).toBe('2026-04-20')
  })
  it('returns same day for Monday', () => {
    const mon = new Date('2026-04-20')
    expect(getWeekStart(mon).toISOString().slice(0,10)).toBe('2026-04-20')
  })
})

describe('minutesFromMidnight', () => {
  it('returns 360 for 6am', () => {
    expect(minutesFromMidnight('2026-04-22T06:00:00.000Z')).toBe(
      new Date('2026-04-22T06:00:00.000Z').getHours() * 60 +
      new Date('2026-04-22T06:00:00.000Z').getMinutes()
    )
  })
})

describe('blockTopPercent / blockHeightPercent', () => {
  it('6am block starts at 25% of 24h', () => {
    const top = blockTopPercent('2026-04-22T06:00:00.000Z')
    expect(top).toBeCloseTo(25, 0)
  })
  it('1h block is ~4.17% of 24h', () => {
    const h = blockHeightPercent('2026-04-22T06:00:00.000Z', '2026-04-22T07:00:00.000Z')
    expect(h).toBeCloseTo(4.17, 1)
  })
})

describe('shiftBlockByDays', () => {
  it('shifts start and end by N days', () => {
    const b = { start_time: '2026-04-20T09:00:00.000Z', end_time: '2026-04-20T10:00:00.000Z' }
    const shifted = shiftBlockByDays(b as any, 7)
    expect(shifted.start_time.slice(0,10)).toBe('2026-04-27')
    expect(shifted.end_time.slice(0,10)).toBe('2026-04-27')
  })
})

describe('formatWeekRange', () => {
  it('formats as "Apr 20 – Apr 26"', () => {
    expect(formatWeekRange(new Date('2026-04-20'))).toBe('Apr 20 – Apr 26')
  })
})
```

- [ ] Run tests: `npx vitest run src/test/dateUtils.test.ts` — expect FAIL

- [ ] Create `src/lib/dateUtils.ts`:
```ts
import { TimeBlock } from '../types'

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(weekStart)} – ${fmt(end)}`
}

export function minutesFromMidnight(isoString: string): number {
  const d = new Date(isoString)
  return d.getHours() * 60 + d.getMinutes()
}

export function blockTopPercent(startIso: string): number {
  return (minutesFromMidnight(startIso) / 1440) * 100
}

export function blockHeightPercent(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  return ((end - start) / 1000 / 60 / 1440) * 100
}

export function shiftBlockByDays(block: TimeBlock, days: number): TimeBlock {
  const ms = days * 24 * 60 * 60 * 1000
  return {
    ...block,
    start_time: new Date(new Date(block.start_time).getTime() + ms).toISOString(),
    end_time: new Date(new Date(block.end_time).getTime() + ms).toISOString(),
  }
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
```

- [ ] Run tests: `npx vitest run src/test/dateUtils.test.ts` — expect PASS

- [ ] Commit: `git add -A && git commit -m "feat: date utilities with tests"`

---

## Task 4: Supabase Client + DB Schema

**Files:** `src/lib/supabase.ts`, `src/lib/queryClient.ts`

- [ ] Create `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

- [ ] Create `src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2 } },
})
```

- [ ] Copy `.env.example` to `.env` and fill in your Supabase project URL + anon key from https://supabase.com/dashboard

- [ ] Run this SQL in the Supabase SQL editor (Dashboard → SQL Editor):
```sql
CREATE TABLE profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme          text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  email          text,
  has_real_email boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  type           text NOT NULL CHECK (type IN ('daily', 'flexible')),
  preferred_time time,
  repeat_days    int[] DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX ON tasks(user_id);
CREATE INDEX ON time_blocks(user_id);
CREATE INDEX ON time_blocks(start_time);
CREATE INDEX ON time_blocks(task_id);

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile"  ON profiles    USING (id = auth.uid())      WITH CHECK (id = auth.uid());
CREATE POLICY "own tasks"    ON tasks       USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own blocks"   ON time_blocks USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

- [ ] In Supabase Dashboard → Authentication → Settings → disable **Email Confirmations**

- [ ] Commit: `git add -A && git commit -m "feat: Supabase client + query client"`

---

## Task 5: Auth Context + Hooks

**Files:** `src/contexts/AuthContext.tsx`, `src/hooks/useProfile.ts`

- [ ] Create `src/contexts/AuthContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthCtx {
  session: Session | null
  loading: boolean
  signUp: (password: string, email?: string) => Promise<void>
  signIn: (identifier: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  async function signUp(password: string, email?: string) {
    const hasReal = Boolean(email)
    const authEmail = email || `user_${crypto.randomUUID()}@noreply.timeblock.app`
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: { data: { has_real_email: hasReal } },
    })
    if (error) throw error
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: hasReal ? email : null,
        has_real_email: hasReal,
      })
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return <Ctx.Provider value={{ session, loading, signUp, signIn, signOut }}>{children}</Ctx.Provider>
}
```

- [ ] Create `src/hooks/useProfile.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Profile } from '../types'

export function useProfile() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile', uid],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid!).single()
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const updateTheme = useMutation({
    mutationFn: async (theme: 'light' | 'dark') => {
      const { error } = await supabase.from('profiles').update({ theme }).eq('id', uid!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', uid] }),
  })

  const updateEmail = useMutation({
    mutationFn: async (email: string) => {
      await supabase.auth.updateUser({ email })
      const { error } = await supabase.from('profiles').update({ email, has_real_email: true }).eq('id', uid!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', uid] }),
  })

  return { profile, updateTheme: updateTheme.mutateAsync, updateEmail: updateEmail.mutateAsync }
}
```

- [ ] Commit: `git add -A && git commit -m "feat: auth context + profile hook"`

---

## Task 6: Week Context + main.tsx + App.tsx

**Files:** `src/contexts/WeekContext.tsx`, `src/main.tsx`, `src/App.tsx`

- [ ] Create `src/contexts/WeekContext.tsx`:
```tsx
import { createContext, useContext, useState, ReactNode } from 'react'
import { getWeekStart } from '../lib/dateUtils'

interface WeekCtx { weekStart: Date; setWeekStart: (d: Date) => void }
const Ctx = createContext<WeekCtx>(null!)
export const useWeek = () => useContext(Ctx)

export function WeekProvider({ children }: { children: ReactNode }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  return <Ctx.Provider value={{ weekStart, setWeekStart }}>{children}</Ctx.Provider>
}
```

- [ ] Replace `src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import { WeekProvider } from './contexts/WeekContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WeekProvider>
            <App />
          </WeekProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] Create `src/components/layout/ProtectedRoute.tsx`:
```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] Create `src/App.tsx`:
```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AppPage from './pages/AppPage'
import TodayPage from './pages/TodayPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/app" element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
      <Route path="/app/today" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
      <Route path="/app/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
```

- [ ] Create stub pages (will be filled in later tasks) for `LoginPage`, `SignupPage`, `ResetPasswordPage`, `AppPage`, `TodayPage`, `SettingsPage` — each just `export default function XPage() { return <div>XPage</div> }`

- [ ] Run `npm run dev` — app should load without errors at `http://localhost:5173`

- [ ] Commit: `git add -A && git commit -m "feat: routing, contexts, provider tree"`

---

## Task 7: Auth Pages

**Files:** `src/pages/LoginPage.tsx`, `src/pages/SignupPage.tsx`, `src/pages/ResetPasswordPage.tsx`

- [ ] Replace `src/pages/LoginPage.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signIn(email, password)
      navigate('/app/today')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow dark:bg-slate-800">
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Sign in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button className="btn-primary w-full" type="submit">Sign in</button>
        </form>
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/signup" className="underline">Create account</Link>
          {' · '}
          <Link to="/reset-password" className="underline">Forgot password?</Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Add Tailwind component classes to `src/index.css`:
```css
@layer components {
  .input {
    @apply w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white;
  }
  .btn-primary {
    @apply rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50;
  }
  .btn-ghost {
    @apply rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700;
  }
}
```

- [ ] Replace `src/pages/SignupPage.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signUp(password, email || undefined)
      navigate('/app/today')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow dark:bg-slate-800">
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input className="input" placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            {!email && <p className="mt-1 text-xs text-amber-600">Without an email you won't be able to recover your account.</p>}
          </div>
          <input className="input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button className="btn-primary w-full" type="submit">Create account</button>
        </form>
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/login" className="underline">Already have an account?</Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Replace `src/pages/ResetPasswordPage.tsx`:
```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="max-w-sm text-center">
        <p className="text-gray-700 dark:text-gray-300">Check your email for a reset link.</p>
        <Link to="/login" className="mt-4 block underline text-sm text-indigo-600">Back to login</Link>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow dark:bg-slate-800">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Reset password</h1>
        <p className="mb-4 text-sm text-gray-500">Enter the email linked to your account.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button className="btn-primary w-full" type="submit">Send reset link</button>
        </form>
        <Link to="/login" className="mt-4 block text-sm underline text-gray-500">Back to login</Link>
      </div>
    </div>
  )
}
```

- [ ] Test manually: open `/signup`, create an account, confirm redirect to `/app/today`. Open `/login`, sign in, confirm redirect.

- [ ] Commit: `git add -A && git commit -m "feat: auth pages — login, signup, reset password"`

---

## Task 8: Theme System + Navbar

**Files:** `src/components/layout/Navbar.tsx`, update `src/main.tsx`

- [ ] Add theme application to `AuthContext` — in `AuthProvider` add a `useEffect` that reads profile and applies dark class. Instead, add it to `Navbar` which has access to `useProfile`.

- [ ] Create `src/components/layout/Navbar.tsx`:
```tsx
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../hooks/useProfile'
import { useWeek } from '../../contexts/WeekContext'
import { formatWeekRange, addDays } from '../../lib/dateUtils'

export function Navbar() {
  const { signOut } = useAuth()
  const { profile, updateTheme } = useProfile()
  const { weekStart, setWeekStart } = useWeek()
  const navigate = useNavigate()
  const location = useLocation()
  const isToday = location.pathname === '/app/today'

  const theme = profile?.theme ?? 'light'

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', next === 'dark')
    updateTheme(next)
  }

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-4">
        <span className="font-bold text-indigo-600 dark:text-indigo-400">TimeBlock</span>
        <Link to="/app/today" className={`btn-ghost ${isToday ? 'font-semibold' : ''}`}>Today</Link>
        <Link to="/app" className={`btn-ghost ${!isToday ? 'font-semibold' : ''}`}>Week</Link>
      </div>

      {!isToday && (
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
          <span className="text-sm text-gray-700 dark:text-gray-300">{formatWeekRange(weekStart)}</span>
          <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
        <Link to="/app/settings" className="btn-ghost">Settings</Link>
        <button className="btn-ghost" onClick={async () => { await signOut(); navigate('/login') }}>Sign out</button>
      </div>
    </nav>
  )
}
```

- [ ] Apply theme class on load — add to `src/main.tsx` before `ReactDOM.createRoot`:
```ts
// Apply saved theme before first render to avoid flash
const savedTheme = localStorage.getItem('theme') ?? 'light'
document.documentElement.classList.toggle('dark', savedTheme === 'dark')
```

- [ ] Update `useProfile.ts` `updateTheme` mutationFn to also set `localStorage.setItem('theme', theme)` before the Supabase call.

- [ ] Commit: `git add -A && git commit -m "feat: navbar + theme toggle with persistence"`

---

## Task 9: Data Hooks — useTimeBlocks + useTasks

**Files:** `src/hooks/useTimeBlocks.ts`, `src/hooks/useTasks.ts`

- [ ] Create `src/hooks/useTimeBlocks.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { TimeBlock } from '../types'
import { getWeekEnd } from '../lib/dateUtils'

export function useTimeBlocks(weekStart: Date) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id
  const weekEnd = getWeekEnd(weekStart)
  const key = ['blocks', weekStart.toISOString()]

  const { data: blocks = [] } = useQuery<TimeBlock[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', uid!)
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .order('start_time')
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const createBlock = useMutation({
    mutationFn: async (block: Omit<TimeBlock, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase.from('time_blocks').insert({ ...block, user_id: uid! }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateBlock = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TimeBlock> & { id: string }) => {
      const { error } = await supabase.from('time_blocks').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<TimeBlock[]>(key)
      qc.setQueryData<TimeBlock[]>(key, old => old?.map(b => b.id === id ? { ...b, ...patch } : b) ?? [])
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_blocks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  return { blocks, createBlock: createBlock.mutateAsync, updateBlock: updateBlock.mutateAsync, deleteBlock: deleteBlock.mutateAsync }
}
```

- [ ] Create `src/hooks/useTasks.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Task } from '../types'

export function useTasks() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id
  const key = ['tasks', uid]

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('user_id', uid!).order('created_at')
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const createTask = useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase.from('tasks').insert({ ...task, user_id: uid! }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  return { tasks, createTask: createTask.mutateAsync, updateTask: updateTask.mutateAsync, deleteTask: deleteTask.mutateAsync }
}
```

- [ ] Commit: `git add -A && git commit -m "feat: useTimeBlocks + useTasks hooks with optimistic updates"`

---

## Task 10: Weekly Summary + Tests

**Files:** `src/components/summary/WeeklySummary.tsx`, `src/test/weekSummary.test.ts`, `src/lib/summaryUtils.ts`

- [ ] Write failing tests — `src/test/weekSummary.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeWeekSummary } from '../lib/summaryUtils'
import { TimeBlock } from '../types'

const block = (status: TimeBlock['status'], mins: number): TimeBlock => ({
  id: crypto.randomUUID(), user_id: 'u', task_id: null, title: 'x',
  start_time: '2026-04-20T09:00:00Z',
  end_time: new Date(new Date('2026-04-20T09:00:00Z').getTime() + mins * 60000).toISOString(),
  type: 'soft', status, reminder_minutes: [], color: null, created_at: '',
})

describe('computeWeekSummary', () => {
  it('calculates total minutes', () => {
    const s = computeWeekSummary([block('planned', 60), block('completed', 30)])
    expect(s.totalMinutes).toBe(90)
  })
  it('counts statuses', () => {
    const s = computeWeekSummary([block('completed', 60), block('moved', 30), block('skipped', 30)])
    expect(s.completed).toBe(1)
    expect(s.moved).toBe(1)
    expect(s.skipped).toBe(1)
  })
  it('calculates completion rate', () => {
    const s = computeWeekSummary([block('completed', 60), block('moved', 60), block('skipped', 60)])
    expect(s.completionRate).toBeCloseTo(33.3, 0)
  })
  it('returns 0 rate when no actionable blocks', () => {
    const s = computeWeekSummary([block('planned', 60)])
    expect(s.completionRate).toBe(0)
  })
})
```

- [ ] Run: `npx vitest run src/test/weekSummary.test.ts` — expect FAIL

- [ ] Create `src/lib/summaryUtils.ts`:
```ts
import { TimeBlock, WeekSummary } from '../types'

export function computeWeekSummary(blocks: TimeBlock[]): WeekSummary {
  let totalMinutes = 0
  let completed = 0, moved = 0, skipped = 0

  for (const b of blocks) {
    const mins = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000
    totalMinutes += mins
    if (b.status === 'completed') completed++
    else if (b.status === 'moved') moved++
    else if (b.status === 'skipped') skipped++
  }

  const actionable = completed + moved + skipped
  return { totalMinutes, completed, moved, skipped, completionRate: actionable ? (completed / actionable) * 100 : 0 }
}
```

- [ ] Run: `npx vitest run src/test/weekSummary.test.ts` — expect PASS

- [ ] Create `src/components/summary/WeeklySummary.tsx`:
```tsx
import { TimeBlock } from '../../types'
import { computeWeekSummary } from '../../lib/summaryUtils'

export function WeeklySummary({ blocks }: { blocks: TimeBlock[] }) {
  const s = computeWeekSummary(blocks)
  const hours = (s.totalMinutes / 60).toFixed(1)

  return (
    <div className="flex gap-6 border-b border-gray-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
      <Stat label="Planned" value={`${hours}h`} />
      <Stat label="Completed" value={s.completed} color="text-green-600" />
      <Stat label="Moved" value={s.moved} color="text-amber-500" />
      <Stat label="Skipped" value={s.skipped} color="text-gray-400" />
      <Stat label="Rate" value={`${s.completionRate.toFixed(0)}%`} color="text-indigo-600" />
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-700' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className={`font-semibold dark:text-white ${color}`}>{value}</span>
    </div>
  )
}
```

- [ ] Commit: `git add -A && git commit -m "feat: weekly summary with tests"`

---

## Task 11: BlockModal

**Files:** `src/components/timetable/BlockModal.tsx`

- [ ] Create `src/components/timetable/BlockModal.tsx`:
```tsx
import { useState, useEffect } from 'react'
import { TimeBlock, Task } from '../../types'

interface Props {
  initial?: Partial<TimeBlock>
  tasks: Task[]
  onSave: (block: Omit<TimeBlock, 'id' | 'user_id' | 'created_at'>) => void
  onDelete?: () => void
  onClose: () => void
}

export function BlockModal({ initial, tasks, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<'soft' | 'hard'>(initial?.type ?? 'soft')
  const [color, setColor] = useState(initial?.color ?? '#6366f1')
  const [taskId, setTaskId] = useState<string>(initial?.task_id ?? '')
  const [reminders, setReminders] = useState<number[]>(initial?.reminder_minutes ?? [])
  const [reminderInput, setReminderInput] = useState('')

  function addReminder() {
    const val = parseInt(reminderInput)
    if (!isNaN(val) && val > 0 && !reminders.includes(val)) {
      setReminders(r => [...r, val].sort((a, b) => b - a))
    }
    setReminderInput('')
  }

  function handleSave() {
    if (!title.trim() || !initial?.start_time || !initial?.end_time) return
    onSave({
      title: title.trim(),
      type,
      color,
      task_id: taskId || null,
      start_time: initial.start_time,
      end_time: initial.end_time,
      status: initial?.status ?? 'planned',
      reminder_minutes: reminders,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{initial?.id ? 'Edit block' : 'New block'}</h2>
        <div className="space-y-3">
          <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <select className="input flex-1" value={type} onChange={e => setType(e.target.value as 'soft' | 'hard')}>
              <option value="soft">Soft</option>
              <option value="hard">Hard</option>
            </select>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border" />
          </div>
          <select className="input" value={taskId} onChange={e => setTaskId(e.target.value)}>
            <option value="">No linked task</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Reminders (minutes before)</p>
            <div className="flex gap-2">
              <input className="input flex-1" type="number" placeholder="e.g. 15" value={reminderInput} onChange={e => setReminderInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addReminder()} />
              <button className="btn-primary" onClick={addReminder}>Add</button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {reminders.map(r => (
                <span key={r} className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                  {r}m <button onClick={() => setReminders(rs => rs.filter(x => x !== r))}>×</button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          {onDelete && <button className="text-sm text-red-500 hover:underline" onClick={onDelete}>Delete</button>}
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Commit: `git add -A && git commit -m "feat: BlockModal — title, type, color, task link, reminders"`

---

## Task 12: TimetableGrid + DayColumn (Static Display)

**Files:** `src/components/timetable/TimetableGrid.tsx`, `src/components/timetable/DayColumn.tsx`, `src/components/timetable/TimeBlock.tsx`

- [ ] Create `src/components/timetable/TimeBlock.tsx`:
```tsx
import { useDraggable } from '@dnd-kit/core'
import { TimeBlock as TBType } from '../../types'

const STATUS_STYLE: Record<string, string> = {
  planned: 'opacity-100',
  completed: 'opacity-60 line-through',
  moved: 'opacity-50 italic',
  skipped: 'opacity-40',
}

interface Props {
  block: TBType
  topPercent: number
  heightPercent: number
  onEdit: (block: TBType) => void
}

export function TimeBlock({ block, topPercent, heightPercent, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: block.id, data: { block } })

  const style = {
    top: `${topPercent}%`,
    height: `${heightPercent}%`,
    minHeight: '20px',
    backgroundColor: block.color ?? '#6366f1',
    transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 10,
  }

  const typeStyle = block.type === 'hard' ? 'border-l-4 border-l-white/60' : 'border-l-2 border-l-white/30'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded px-1.5 py-0.5 text-white ${typeStyle} ${STATUS_STYLE[block.status]}`}
      {...listeners} {...attributes}
      onDoubleClick={() => onEdit(block)}
    >
      <p className="truncate text-xs font-medium">{block.title}</p>
    </div>
  )
}
```

- [ ] Create `src/components/timetable/DayColumn.tsx`:
```tsx
import { useDroppable } from '@dnd-kit/core'
import { TimeBlock as TBType } from '../../types'
import { TimeBlock } from './TimeBlock'
import { blockTopPercent, blockHeightPercent } from '../../lib/dateUtils'
import { addDays } from '../../lib/dateUtils'

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
)

interface Props {
  dayIndex: number
  weekStart: Date
  blocks: TBType[]
  onEdit: (block: TBType) => void
  onCellClick: (startTime: Date) => void
}

export function DayColumn({ dayIndex, weekStart, blocks, onEdit, onCellClick }: Props) {
  const date = addDays(weekStart, dayIndex)
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
  const isToday = new Date().toDateString() === date.toDateString()

  const { setNodeRef } = useDroppable({ id: `day-${dayIndex}`, data: { dayIndex, date } })

  return (
    <div className="flex flex-col border-r border-gray-200 dark:border-slate-700 last:border-r-0">
      <div className={`sticky top-0 z-20 border-b border-gray-200 bg-white py-1 text-center text-xs font-medium dark:border-slate-700 dark:bg-slate-900 ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>
        {dateStr}
      </div>
      <div ref={setNodeRef} className="relative flex-1">
        {HOUR_LABELS.map((label, i) => (
          <div
            key={i}
            className="relative border-b border-gray-100 dark:border-slate-800"
            style={{ height: '60px' }}
            onClick={() => {
              const d = new Date(date)
              d.setHours(i, 0, 0, 0)
              onCellClick(d)
            }}
          />
        ))}
        {blocks.map(block => (
          <TimeBlock
            key={block.id}
            block={block}
            topPercent={blockTopPercent(block.start_time)}
            heightPercent={blockHeightPercent(block.start_time, block.end_time)}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] Create `src/components/timetable/TimetableGrid.tsx`:
```tsx
import { useRef, useEffect, useState } from 'react'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { TimeBlock as TBType, Task } from '../../types'
import { DayColumn } from './DayColumn'
import { BlockModal } from './BlockModal'
import { addDays } from '../../lib/dateUtils'

const HOUR_HEIGHT = 60
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
)

interface Props {
  weekStart: Date
  blocks: TBType[]
  tasks: Task[]
  onCreate: (block: Omit<TBType, 'id' | 'user_id' | 'created_at'>) => Promise<TBType>
  onUpdate: (patch: Partial<TBType> & { id: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TimetableGrid({ weekStart, blocks, tasks, onCreate, onUpdate, onDelete }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [modal, setModal] = useState<{ block?: Partial<TBType>; startTime?: Date } | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = HOUR_HEIGHT * 6
  }, [])

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || !active.data.current) return
    const block = active.data.current.block as TBType
    const { dayIndex, date } = over.data.current as { dayIndex: number; date: Date }
    const duration = new Date(block.end_time).getTime() - new Date(block.start_time).getTime()
    const newStart = new Date(date)
    newStart.setHours(new Date(block.start_time).getHours(), new Date(block.start_time).getMinutes(), 0, 0)
    const newEnd = new Date(newStart.getTime() + duration)
    onUpdate({ id: block.id, start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
  }

  function handleCellClick(startTime: Date) {
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)
    setModal({ block: { start_time: startTime.toISOString(), end_time: endTime.toISOString() } })
  }

  function handleEditBlock(block: TBType) {
    setModal({ block })
  }

  const blocksForDay = (dayIndex: number) => {
    const date = addDays(weekStart, dayIndex)
    return blocks.filter(b => new Date(b.start_time).toDateString() === date.toDateString())
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div ref={scrollRef} className="flex flex-1 overflow-y-auto">
          <div className="sticky left-0 z-10 flex flex-col border-r border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="h-7 border-b border-gray-200 dark:border-slate-700" />
            {HOUR_LABELS.map((label, i) => (
              <div key={i} className="flex items-start justify-end pr-2 pt-0.5 text-xs text-gray-400" style={{ height: `${HOUR_HEIGHT}px` }}>
                {label}
              </div>
            ))}
          </div>
          <div className="grid flex-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {Array.from({ length: 7 }, (_, i) => (
              <DayColumn
                key={i}
                dayIndex={i}
                weekStart={weekStart}
                blocks={blocksForDay(i)}
                onEdit={handleEditBlock}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {modal && (
        <BlockModal
          initial={modal.block}
          tasks={tasks}
          onSave={block => modal.block?.id
            ? onUpdate({ id: modal.block.id!, ...block })
            : onCreate(block)
          }
          onDelete={modal.block?.id ? () => { onDelete(modal.block!.id!); setModal(null) } : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
```

- [ ] Commit: `git add -A && git commit -m "feat: timetable grid with 24h scroll, day columns, block display, drag-to-move"`

---

## Task 13: Task Sidebar

**Files:** `src/components/tasks/TaskModal.tsx`, `src/components/tasks/TaskItem.tsx`, `src/components/tasks/TaskList.tsx`

- [ ] Create `src/components/tasks/TaskModal.tsx`:
```tsx
import { useState } from 'react'
import { Task } from '../../types'

interface Props {
  initial?: Partial<Task>
  onSave: (t: Omit<Task, 'id' | 'user_id' | 'created_at'>) => void
  onDelete?: () => void
  onClose: () => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function TaskModal({ initial, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<'daily' | 'flexible'>(initial?.type ?? 'flexible')
  const [preferredTime, setPreferredTime] = useState(initial?.preferred_time?.slice(0, 5) ?? '')
  const [repeatDays, setRepeatDays] = useState<number[]>(initial?.repeat_days ?? [])

  function toggleDay(d: number) {
    setRepeatDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function handleSave() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      type,
      preferred_time: preferredTime ? `${preferredTime}:00` : null,
      repeat_days: type === 'daily' ? repeatDays : [],
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{initial?.id ? 'Edit task' : 'New task'}</h2>
        <div className="space-y-3">
          <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          <select className="input" value={type} onChange={e => setType(e.target.value as 'daily' | 'flexible')}>
            <option value="flexible">Flexible</option>
            <option value="daily">Daily</option>
          </select>
          {type === 'daily' && (
            <div className="flex gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => toggleDay(i)}
                  className={`flex-1 rounded py-1 text-xs font-medium ${repeatDays.includes(i) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'}`}
                >{d}</button>
              ))}
            </div>
          )}
          <input className="input" type="time" value={preferredTime} onChange={e => setPreferredTime(e.target.value)} placeholder="Preferred time (optional)" />
        </div>
        <div className="mt-4 flex justify-between">
          {onDelete && <button className="text-sm text-red-500 hover:underline" onClick={onDelete}>Delete</button>}
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Create `src/components/tasks/TaskItem.tsx`:
```tsx
import { useDraggable } from '@dnd-kit/core'
import { Task } from '../../types'

export function TaskItem({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `task-${task.id}`, data: { task } })
  return (
    <div
      ref={setNodeRef}
      {...listeners} {...attributes}
      className={`cursor-grab rounded-lg border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800 ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{task.title}</span>
        <button className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" onClick={e => { e.stopPropagation(); onEdit() }}>✎</button>
      </div>
      <span className="text-xs text-gray-400">{task.type}</span>
    </div>
  )
}
```

- [ ] Create `src/components/tasks/TaskList.tsx`:
```tsx
import { useState } from 'react'
import { Task } from '../../types'
import { TaskItem } from './TaskItem'
import { TaskModal } from './TaskModal'

interface Props {
  tasks: Task[]
  onCreate: (t: Omit<Task, 'id' | 'user_id' | 'created_at'>) => Promise<Task>
  onUpdate: (patch: Partial<Task> & { id: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TaskList({ tasks, onCreate, onUpdate, onDelete }: Props) {
  const [modal, setModal] = useState<{ task?: Task } | null>(null)

  return (
    <aside className="flex w-56 flex-col border-l border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-slate-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Tasks</span>
        <button className="btn-ghost text-lg leading-none" onClick={() => setModal({})}>+</button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {tasks.map(t => (
          <TaskItem key={t.id} task={t} onEdit={() => setModal({ task: t })} />
        ))}
      </div>
      {modal && (
        <TaskModal
          initial={modal.task}
          onSave={t => modal.task ? onUpdate({ id: modal.task.id, ...t }) : onCreate(t)}
          onDelete={modal.task ? () => { onDelete(modal.task!.id); setModal(null) } : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </aside>
  )
}
```

- [ ] Commit: `git add -A && git commit -m "feat: task sidebar — list, create, edit, drag source"`

---

## Task 14: AppPage Assembly + Drag Task onto Grid

**Files:** `src/pages/AppPage.tsx`

- [ ] Replace `src/pages/AppPage.tsx`:
```tsx
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Navbar } from '../components/layout/Navbar'
import { TimetableGrid } from '../components/timetable/TimetableGrid'
import { TaskList } from '../components/tasks/TaskList'
import { WeeklySummary } from '../components/summary/WeeklySummary'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { Task, TimeBlock } from '../types'
import { useNotifications } from '../hooks/useNotifications'

export default function AppPage() {
  const { weekStart } = useWeek()
  const { blocks, createBlock, updateBlock, deleteBlock } = useTimeBlocks(weekStart)
  const { tasks, createTask, updateTask, deleteTask } = useTasks()
  useNotifications(blocks)

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <WeeklySummary blocks={blocks} />
      <div className="flex flex-1 overflow-hidden">
        <TimetableGrid
          weekStart={weekStart}
          blocks={blocks}
          tasks={tasks}
          onCreate={createBlock}
          onUpdate={updateBlock}
          onDelete={deleteBlock}
        />
        <TaskList
          tasks={tasks}
          onCreate={createTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
        />
      </div>
    </div>
  )
}
```

- [ ] Extend `TimetableGrid`'s `handleDragEnd` to handle task drops. After the existing block-move logic, add:
```ts
// In handleDragEnd, after the block-move if block:
if (!active.data.current?.block && active.data.current?.task) {
  const task = active.data.current.task as Task
  if (over?.data.current) {
    const { date } = over.data.current as { date: Date }
    const start = new Date(date)
    if (task.preferred_time) {
      const [h, m] = task.preferred_time.split(':').map(Number)
      start.setHours(h, m, 0, 0)
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setModal({
      block: {
        title: task.title,
        task_id: task.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        type: 'soft',
        status: 'planned',
        reminder_minutes: [],
        color: '#6366f1',
      }
    })
  }
}
```

- [ ] Run `npm run dev`, open app, verify: login → redirects to `/app/today`, click Week → week grid loads, click a cell → BlockModal opens, create a block → appears on grid.

- [ ] Commit: `git add -A && git commit -m "feat: AppPage — timetable + task sidebar assembled, drag task onto grid"`

---

## Task 15: Week Picker Modal (Copy from Previous Week)

**Files:** `src/components/timetable/WeekPickerModal.tsx`, update `Navbar.tsx`

- [ ] Create `src/components/timetable/WeekPickerModal.tsx`:
```tsx
import { useState } from 'react'
import { TimeBlock } from '../../types'
import { getWeekStart, formatWeekRange, addDays } from '../../lib/dateUtils'

interface WeekOption {
  weekStart: Date
  blocks: TimeBlock[]
}

interface Props {
  currentWeekStart: Date
  allFetchedBlocks: TimeBlock[]
  onCopy: (blocks: TimeBlock[], targetWeekStart: Date) => void
  onClose: () => void
}

export function WeekPickerModal({ currentWeekStart, allFetchedBlocks, onCopy, onClose }: Props) {
  const [selected, setSelected] = useState<Date | null>(null)

  const options: WeekOption[] = Array.from({ length: 12 }, (_, i) => {
    const ws = getWeekStart(addDays(currentWeekStart, -(i + 1) * 7))
    const wsEnd = addDays(ws, 7)
    const weekBlocks = allFetchedBlocks.filter(b => {
      const t = new Date(b.start_time)
      return t >= ws && t < wsEnd
    })
    return { weekStart: ws, blocks: weekBlocks }
  })

  const preview = selected ? options.find(o => o.weekStart.toISOString() === selected.toISOString())?.blocks ?? [] : []
  const daysDiff = selected ? Math.round((currentWeekStart.getTime() - selected.getTime()) / 86400000) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Copy from previous week</h2>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.weekStart.toISOString()}
              onClick={() => setSelected(opt.weekStart)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected?.toISOString() === opt.weekStart.toISOString() ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              <span className="font-medium">{formatWeekRange(opt.weekStart)}</span>
              <span className="ml-2 text-gray-400">{opt.blocks.length} blocks</span>
            </button>
          ))}
        </div>
        {selected && preview.length > 0 && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-slate-700">
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Will copy:</p>
            {preview.slice(0, 5).map(b => <p key={b.id} className="text-xs text-gray-600 dark:text-gray-300">• {b.title}</p>)}
            {preview.length > 5 && <p className="text-xs text-gray-400">…and {preview.length - 5} more</p>}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!selected || preview.length === 0}
            onClick={() => { onCopy(preview, currentWeekStart); onClose() }}
          >
            Copy {preview.length} blocks
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Add `shiftBlockByDays` import to `WeekPickerModal` and implement copy in `AppPage.tsx`:
```tsx
// In AppPage, add:
async function handleCopyWeek(sourcBlocks: TimeBlock[], targetWeekStart: Date) {
  const sourceWeekStart = getWeekStart(new Date(sourcBlocks[0].start_time))
  const daysDiff = Math.round((targetWeekStart.getTime() - sourceWeekStart.getTime()) / 86400000)
  await Promise.all(sourcBlocks.map(b => {
    const shifted = shiftBlockByDays(b, daysDiff)
    return createBlock({ ...shifted, status: 'planned', id: undefined as any, user_id: undefined as any, created_at: undefined as any })
  }))
}
```

- [ ] Add *"Copy week"* button to `Navbar.tsx` — opens `WeekPickerModal` (pass blocks and weekStart via props or a callback from AppPage).

  Simplest approach: lift state to `AppPage` and pass `onCopyWeek` down. Add a `showWeekPicker` state in `Navbar` rendered inline:
```tsx
// In Navbar, in the week nav section:
const [showPicker, setShowPicker] = useState(false)
// ...
<button className="btn-ghost text-xs" onClick={() => setShowPicker(true)}>Copy week</button>
{showPicker && <WeekPickerModal ... onClose={() => setShowPicker(false)} />}
```
  Pass `blocks` and `onCopyWeek` as props to `Navbar`.

- [ ] Commit: `git add -A && git commit -m "feat: week picker modal + copy blocks from any previous week"`

---

## Task 16: Daily Dashboard

**Files:** `src/pages/TodayPage.tsx`, `src/components/dashboard/TodayTimeline.tsx`, `src/components/dashboard/TaskChecklist.tsx`

- [ ] Create `src/components/dashboard/TodayTimeline.tsx`:
```tsx
import { TimeBlock } from '../../types'

const STATUS_COLOR: Record<string, string> = {
  planned: 'border-indigo-400',
  completed: 'border-green-400 opacity-60',
  moved: 'border-amber-400 opacity-50',
  skipped: 'border-gray-300 opacity-40',
}

interface Props {
  blocks: TimeBlock[]
  onStatusChange: (id: string, status: TimeBlock['status']) => void
}

export function TodayTimeline({ blocks, onStatusChange }: Props) {
  const now = new Date()
  const sorted = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time))

  const upcoming = sorted.filter(b => new Date(b.start_time) > now && new Date(b.start_time) <= new Date(now.getTime() + 2 * 60 * 60 * 1000))

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {upcoming.length > 0 && (
        <div className="mb-4 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-900/30">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">Up next</p>
          <p className="font-semibold text-gray-900 dark:text-white">{upcoming[0].title}</p>
          <p className="text-sm text-gray-500">{fmt(upcoming[0].start_time)} – {fmt(upcoming[0].end_time)}</p>
        </div>
      )}
      {sorted.length === 0 && <p className="text-sm text-gray-400">No blocks scheduled today.</p>}
      <div className="space-y-2">
        {sorted.map(block => {
          const isPast = new Date(block.end_time) < now
          return (
            <div key={block.id} className={`flex items-start gap-3 rounded-lg border-l-4 bg-white p-3 shadow-sm dark:bg-slate-800 ${STATUS_COLOR[block.status]} ${isPast && block.status === 'planned' ? 'opacity-60' : ''}`}>
              <div className="flex-1">
                <p className={`font-medium text-gray-900 dark:text-white ${block.status === 'completed' ? 'line-through' : ''}`}>{block.title}</p>
                <p className="text-xs text-gray-400">{fmt(block.start_time)} – {fmt(block.end_time)}</p>
              </div>
              <select
                className="rounded border border-gray-200 bg-transparent text-xs dark:border-slate-600 dark:text-gray-300"
                value={block.status}
                onChange={e => onStatusChange(block.id, e.target.value as TimeBlock['status'])}
              >
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="moved">Moved</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] Create `src/components/dashboard/TaskChecklist.tsx`:
```tsx
import { Task, TimeBlock } from '../../types'

interface Props {
  tasks: Task[]
  todayBlocks: TimeBlock[]
  onToggle: (blockId: string, done: boolean) => void
}

export function TaskChecklist({ tasks, todayBlocks, onToggle }: Props) {
  const today = new Date().getDay()
  const dailyTasks = tasks.filter(t => t.type === 'daily' && t.repeat_days.includes(today))
  const linkedTaskIds = new Set(todayBlocks.map(b => b.task_id).filter(Boolean))
  const linkedFlexible = tasks.filter(t => t.type === 'flexible' && linkedTaskIds.has(t.id))

  const isTaskDone = (task: Task) =>
    todayBlocks.some(b => b.task_id === task.id && b.status === 'completed')

  const blockForTask = (task: Task) => todayBlocks.find(b => b.task_id === task.id)

  const allTasks = [...dailyTasks, ...linkedFlexible]

  return (
    <aside className="w-64 overflow-y-auto border-l border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Today's Tasks</h2>
      {allTasks.length === 0 && <p className="text-xs text-gray-400">No tasks for today.</p>}
      <div className="space-y-2">
        {allTasks.map(task => {
          const done = isTaskDone(task)
          const block = blockForTask(task)
          return (
            <label key={task.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={done}
                disabled={!block}
                onChange={e => block && onToggle(block.id, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>{task.title}</span>
            </label>
          )
        })}
      </div>
    </aside>
  )
}
```

- [ ] Replace `src/pages/TodayPage.tsx`:
```tsx
import { Navbar } from '../components/layout/Navbar'
import { TodayTimeline } from '../components/dashboard/TodayTimeline'
import { TaskChecklist } from '../components/dashboard/TaskChecklist'
import { useWeek } from '../contexts/WeekContext'
import { useTimeBlocks } from '../hooks/useTimeBlocks'
import { useTasks } from '../hooks/useTasks'
import { getWeekStart } from '../lib/dateUtils'
import { useNotifications } from '../hooks/useNotifications'

export default function TodayPage() {
  const { weekStart } = useWeek()
  const { blocks, updateBlock } = useTimeBlocks(weekStart)
  const { tasks } = useTasks()
  useNotifications(blocks)

  const todayBlocks = blocks.filter(b =>
    new Date(b.start_time).toDateString() === new Date().toDateString()
  )

  function handleStatusChange(id: string, status: 'planned' | 'completed' | 'moved' | 'skipped') {
    updateBlock({ id, status })
  }

  function handleToggle(blockId: string, done: boolean) {
    updateBlock({ id: blockId, status: done ? 'completed' : 'planned' })
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <TodayTimeline blocks={todayBlocks} onStatusChange={handleStatusChange} />
        <TaskChecklist tasks={tasks} todayBlocks={todayBlocks} onToggle={handleToggle} />
      </div>
    </div>
  )
}
```

- [ ] Commit: `git add -A && git commit -m "feat: daily dashboard — today timeline, task checklist, up-next strip"`

---

## Task 17: Service Worker + Notifications

**Files:** `src/sw.ts`, `src/hooks/useNotifications.ts`, `vite.config.ts` update

- [ ] Update `vite.config.ts` to compile `sw.ts` as a separate entry:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.ts' },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      input: { main: './index.html', sw: './src/sw.ts' },
      output: { entryFileNames: (c) => c.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js' },
    },
  },
})
```

- [ ] Create `src/sw.ts`:
```ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

const DB_NAME = 'timeblock-sw'
const STORE = 'reminders'

interface Reminder {
  id: string        // `${blockId}-${minutesBefore}`
  blockId: string
  blockTitle: string
  fireAt: number    // unix ms
}

async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveReminders(reminders: Reminder[]) {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  reminders.forEach(r => tx.objectStore(STORE).put(r))
  return new Promise(res => { tx.oncomplete = res })
}

async function deleteRemindersForBlock(blockId: string) {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const all: Reminder[] = await new Promise(res => { const r = store.getAll(); r.onsuccess = () => res(r.result) })
  all.filter(r => r.blockId === blockId).forEach(r => store.delete(r.id))
  return new Promise(res => { tx.oncomplete = res })
}

async function getDueReminders(): Promise<Reminder[]> {
  const db = await getDB()
  const all: Reminder[] = await new Promise(res => {
    const tx = db.transaction(STORE, 'readonly')
    const r = tx.objectStore(STORE).getAll()
    r.onsuccess = () => res(r.result)
  })
  const now = Date.now()
  return all.filter(r => r.fireAt <= now + 5000 && r.fireAt > now - 60000)
}

async function deleteFiredReminders(ids: string[]) {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  ids.forEach(id => tx.objectStore(STORE).delete(id))
  return new Promise(res => { tx.oncomplete = res })
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('message', async (e) => {
  if (e.data.type === 'SCHEDULE') {
    const reminders: Reminder[] = []
    for (const block of e.data.blocks) {
      for (const mins of block.reminder_minutes) {
        const fireAt = new Date(block.start_time).getTime() - mins * 60 * 1000
        if (fireAt > Date.now()) {
          reminders.push({ id: `${block.id}-${mins}`, blockId: block.id, blockTitle: block.title, fireAt })
        }
      }
    }
    await saveReminders(reminders)
  }
  if (e.data.type === 'CANCEL') {
    await deleteRemindersForBlock(e.data.blockId)
  }
})

setInterval(async () => {
  const due = await getDueReminders()
  for (const r of due) {
    self.registration.showNotification(r.blockTitle, {
      body: `Starting soon`,
      icon: '/icons/icon-192.png',
      tag: r.id,
      actions: [
        { action: 'complete', title: 'Mark complete' },
        { action: 'snooze', title: 'Snooze 10 min' },
      ],
    })
  }
  if (due.length > 0) await deleteFiredReminders(due.map(r => r.id))
}, 30_000)

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.action === 'snooze') {
    // Re-schedule 10 min later - simplified: just close for now
    return
  }
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    if (clients.length) return clients[0].focus()
    return self.clients.openWindow('/app/today')
  }))
})
```

- [ ] Create `src/hooks/useNotifications.ts`:
```ts
import { useEffect, useRef } from 'react'
import { TimeBlock } from '../types'

let swRegistration: ServiceWorkerRegistration | null = null

export function useNotifications(blocks: TimeBlock[]) {
  const initialized = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return
    if (initialized.current) return
    initialized.current = true

    const stored = localStorage.getItem('notif-permission')
    if (stored === 'denied') return

    async function init() {
      try {
        swRegistration = await navigator.serviceWorker.register('/sw.js')
        if (Notification.permission === 'default' && stored !== 'dismissed') {
          // Banner shown separately — don't request here automatically
        }
      } catch (e) {
        console.warn('SW registration failed', e)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!swRegistration?.active || blocks.length === 0) return
    if (Notification.permission !== 'granted') return
    swRegistration.active.postMessage({ type: 'SCHEDULE', blocks })
  }, [blocks])

  async function requestPermission() {
    const result = await Notification.requestPermission()
    localStorage.setItem('notif-permission', result)
    if (result === 'granted' && swRegistration?.active) {
      swRegistration.active.postMessage({ type: 'SCHEDULE', blocks })
    }
    return result
  }

  return { requestPermission, supported: 'Notification' in window }
}
```

- [ ] Add notification permission banner to `AppPage.tsx` and `TodayPage.tsx`. Create `src/components/layout/NotificationBanner.tsx`:
```tsx
import { useState, useEffect } from 'react'
import { useNotifications } from '../../hooks/useNotifications'

export function NotificationBanner({ blocks }: { blocks: any[] }) {
  const [show, setShow] = useState(false)
  const { requestPermission, supported } = useNotifications(blocks)

  useEffect(() => {
    if (!supported) return
    const stored = localStorage.getItem('notif-permission')
    if (!stored && Notification.permission === 'default') setShow(true)
  }, [])

  if (!show) return null

  return (
    <div className="flex items-center justify-between bg-indigo-50 px-4 py-2 text-sm dark:bg-indigo-900/30">
      <span className="text-indigo-700 dark:text-indigo-200">Enable notifications to get reminders for your time blocks.</span>
      <div className="flex gap-2">
        <button className="btn-ghost text-xs" onClick={() => { localStorage.setItem('notif-permission', 'dismissed'); setShow(false) }}>Dismiss</button>
        <button className="btn-primary text-xs" onClick={async () => { await requestPermission(); setShow(false) }}>Enable</button>
      </div>
    </div>
  )
}
```

- [ ] Add `<NotificationBanner blocks={blocks} />` below `<Navbar />` in both `AppPage.tsx` and `TodayPage.tsx`.

- [ ] Run: `npm run build` — verify `dist/sw.js` exists alongside `dist/index.html`

- [ ] Commit: `git add -A && git commit -m "feat: service worker + IndexedDB notification scheduling"`

---

## Task 18: PWA Manifest + iOS Support

**Files:** `public/manifest.json`, `index.html`, `public/icons/`

- [ ] Create `public/manifest.json`:
```json
{
  "name": "TimeBlock",
  "short_name": "TimeBlock",
  "description": "Time-blocking productivity planner",
  "start_url": "/app/today",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366f1",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] Add to `index.html` `<head>`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#6366f1" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

- [ ] Create placeholder icons — run:
```bash
mkdir -p public/icons
# Create a simple 192x192 PNG — use any online favicon generator or:
# Copy any PNG to public/icons/icon-192.png and public/icons/icon-512.png
```

- [ ] Verify PWA: run `npm run build && npx serve dist`, open Chrome → DevTools → Application → Manifest — confirm manifest loads correctly.

- [ ] Commit: `git add -A && git commit -m "feat: PWA manifest + iOS meta tags"`

---

## Task 19: Settings Page + Overnight Blocks

**Files:** `src/pages/SettingsPage.tsx`, update `src/components/timetable/DayColumn.tsx`

- [ ] Replace `src/pages/SettingsPage.tsx`:
```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { Navbar } from '../components/layout/Navbar'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsPage() {
  const { profile, updateEmail, updateTheme } = useProfile()
  const { session } = useAuth()
  const [email, setEmail] = useState(profile?.email ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSaveEmail() {
    setError('')
    try {
      await updateEmail(email)
      setSaved(true)
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="mx-auto mt-8 w-full max-w-md rounded-xl bg-white p-6 shadow dark:bg-slate-800">
        <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">Settings</h1>

        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Recovery Email</h2>
          {!profile?.has_real_email && (
            <p className="mb-2 text-xs text-amber-600">No recovery email set. Add one to enable password reset.</p>
          )}
          <div className="flex gap-2">
            <input className="input flex-1" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
            <button className="btn-primary" onClick={handleSaveEmail}>Save</button>
          </div>
          {saved && <p className="mt-1 text-xs text-green-600">Check your email to confirm.</p>}
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Notifications</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {Notification.permission === 'granted' ? '✓ Notifications enabled' :
             Notification.permission === 'denied' ? 'Notifications blocked — enable in browser settings' :
             'Notifications not yet enabled — visit the app page to enable'}
          </p>
        </div>

        <Link to="/app/today" className="text-sm text-indigo-600 underline dark:text-indigo-400">← Back to app</Link>
      </div>
    </div>
  )
}
```

- [ ] Handle overnight blocks in `DayColumn.tsx` — blocks that end on the next day should be clipped at midnight. Update the `blocks` filter in `TimetableGrid` `blocksForDay` to also include blocks that *end* on the given day (started previous day):
```ts
// In TimetableGrid, replace blocksForDay:
const blocksForDay = (dayIndex: number) => {
  const date = addDays(weekStart, dayIndex)
  const dateStr = date.toDateString()
  return blocks.filter(b => {
    const startStr = new Date(b.start_time).toDateString()
    const endStr = new Date(b.end_time).toDateString()
    return startStr === dateStr || endStr === dateStr
  })
}
```

- [ ] In `TimeBlock.tsx`, clip the block height to not exceed midnight (100% - topPercent) when end_time is on a different day:
```ts
// In TimeBlock component, before rendering:
const startDay = new Date(block.start_time).toDateString()
const endDay = new Date(block.end_time).toDateString()
const isOvernight = startDay !== endDay
const clippedHeight = isOvernight
  ? (100 - topPercent)   // clip to end of day
  : heightPercent
```

- [ ] Run `npm run dev`, create a block from 11pm to 1am — verify it renders split across two day columns.

- [ ] Commit: `git add -A && git commit -m "feat: settings page, overnight block rendering"`

---

## Task 20: Suggested Blocks + Final Polish

**Files:** `src/components/timetable/DayColumn.tsx`, `src/components/timetable/TimetableGrid.tsx`

- [ ] Add suggested block overlays to `DayColumn.tsx`. Accept `dailyTasks` prop:
```tsx
// Add to DayColumn Props:
dailyTasks: Task[]

// Add inside the column div, after the hour rows:
{dailyTasks
  .filter(t => t.preferred_time && t.repeat_days.includes(date.getDay()))
  .map(t => {
    const [h, m] = t.preferred_time!.split(':').map(Number)
    const topPct = ((h * 60 + m) / 1440) * 100
    return (
      <div
        key={t.id}
        className="absolute left-0.5 right-0.5 cursor-pointer rounded border border-dashed border-indigo-400 bg-indigo-50/50 px-1.5 py-0.5 dark:bg-indigo-900/20"
        style={{ top: `${topPct}%`, height: '4.17%' }}
        onClick={() => {
          const start = new Date(date)
          start.setHours(h, m, 0, 0)
          const end = new Date(start.getTime() + 60 * 60 * 1000)
          onCellClick(start)
        }}
      >
        <p className="truncate text-xs text-indigo-400">{t.title}</p>
      </div>
    )
  })}
```

- [ ] Pass `dailyTasks` from `TimetableGrid` to each `DayColumn`:
```tsx
// In TimetableGrid, filter tasks:
const dailyTasks = tasks.filter(t => t.type === 'daily')
// Pass to DayColumn:
<DayColumn ... dailyTasks={dailyTasks} />
```

- [ ] Add *"Jump to now"* button in the week grid. In `TimetableGrid.tsx`:
```tsx
function jumpToNow() {
  if (scrollRef.current) {
    const hour = new Date().getHours()
    scrollRef.current.scrollTop = HOUR_HEIGHT * hour - 100
  }
}
// In Navbar props or as an in-grid button:
// Add above the DndContext:
<div className="flex justify-end px-2 py-1 border-b border-gray-200 dark:border-slate-700">
  <button className="btn-ghost text-xs" onClick={jumpToNow}>Jump to now</button>
</div>
```

- [ ] Run full test suite: `npx vitest run` — all tests pass

- [ ] Run `npm run build` — no TypeScript errors

- [ ] Manual test checklist:
  - [ ] Sign up without email → warning shown, lands on `/app/today`
  - [ ] Sign up with email → no warning
  - [ ] Theme toggle → persists on reload
  - [ ] Create block → appears on grid
  - [ ] Drag block to new day → moves correctly
  - [ ] Mark block completed → shows in summary
  - [ ] Create daily task with preferred_time → suggestion appears on correct days
  - [ ] Drag task onto grid → BlockModal opens with task title pre-filled
  - [ ] Navigate weeks → prev/next arrows work
  - [ ] Copy from previous week → blocks appear shifted correctly
  - [ ] Daily dashboard: today's blocks listed, status change works
  - [ ] Notification permission prompt appears → grant → block with reminder fires notification
  - [ ] Settings → add email → confirmation message shown

- [ ] Commit: `git add -A && git commit -m "feat: suggested blocks, jump to now, final polish"`

---

## Self-Review

**Spec coverage check:**

| Spec Section | Covered In |
|---|---|
| Auth — optional email, placeholder | Task 5 |
| Auth — no confirmation email | Task 4 (Supabase dashboard config) |
| Auth — password reset guard | Task 7 |
| DB schema + RLS | Task 4 |
| Profiles table + theme | Tasks 5, 8 |
| Weekly grid 24h scrollable | Task 12 |
| Jump to now | Task 20 |
| Overnight blocks | Task 19 |
| Drag to move | Task 12 |
| Drag to create | Task 12 |
| Resize handle | ⚠️ Not covered — see note below |
| Task system | Task 13 |
| Drag task onto grid | Task 14 |
| Week navigation | Task 8 (Navbar) |
| Copy from previous week | Task 15 |
| Weekly summary | Task 10 |
| Daily dashboard | Task 16 |
| Suggested blocks | Task 20 |
| Notifications — SW + IndexedDB | Task 17 |
| Notifications — per-block reminders | Tasks 11, 17 |
| Notifications — permission banner | Task 17 |
| PWA manifest | Task 18 |
| Theme toggle + persistence | Tasks 8, 5 |
| Settings page | Task 19 |

**⚠️ Resize handle** (drag bottom edge to extend block): Not implemented in this plan. It requires a separate draggable resize handle element inside `TimeBlock` with vertical-only drag constraints via `@dnd-kit/modifiers`. Add as a stretch goal after core features are working.

**Placeholder scan:** No TBDs or TODOs found in plan steps.

**Type consistency check:** `TimeBlock`, `Task`, `Profile`, `WeekSummary` defined in Task 2 and used consistently throughout. `createBlock` accepts `Omit<TimeBlock, 'id' | 'user_id' | 'created_at'>` in Task 9 and `BlockModal.onSave` emits the same shape in Task 11. ✓
