# Notifications Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an enable/disable toggle to the Settings page Notifications section, backed by an app-level `notif-paused` localStorage flag.

**Architecture:** A new `useNotificationSettings` hook owns permission state and the pause flag; a new `ToggleSwitch` component renders the switch; `useNotifications` gains a one-line guard in each scheduling effect; `SettingsPage` wires the hook and component together.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, @testing-library/react, @testing-library/user-event

---

### Task 1: `useNotificationSettings` hook

**Files:**
- Create: `src/hooks/useNotificationSettings.ts`
- Create: `src/test/useNotificationSettings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/test/useNotificationSettings.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { useNotificationSettings } from '../hooks/useNotificationSettings'

// jsdom doesn't include Notification — define it once for all tests
const mockRequestPermission = vi.fn<[], Promise<NotificationPermission>>()

beforeAll(() => {
  Object.defineProperty(window, 'Notification', {
    value: { permission: 'default', requestPermission: mockRequestPermission },
    writable: true,
    configurable: true,
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {},
    configurable: true,
  })
})

beforeEach(() => {
  localStorage.clear()
  mockRequestPermission.mockReset()
  ;(window.Notification as any).permission = 'default'
})

describe('useNotificationSettings', () => {
  it('supported is true when Notification and serviceWorker are present', () => {
    const { result } = renderHook(() => useNotificationSettings())
    expect(result.current.supported).toBe(true)
  })

  it('initialises permission from Notification.permission', () => {
    ;(window.Notification as any).permission = 'granted'
    const { result } = renderHook(() => useNotificationSettings())
    expect(result.current.permission).toBe('granted')
  })

  it('paused is false when notif-paused is absent', () => {
    const { result } = renderHook(() => useNotificationSettings())
    expect(result.current.paused).toBe(false)
  })

  it('paused is true when notif-paused is "true" in localStorage', () => {
    localStorage.setItem('notif-paused', 'true')
    const { result } = renderHook(() => useNotificationSettings())
    expect(result.current.paused).toBe(true)
  })

  it('enabled is true when permission is granted and not paused', () => {
    ;(window.Notification as any).permission = 'granted'
    const { result } = renderHook(() => useNotificationSettings())
    expect(result.current.enabled).toBe(true)
  })

  it('enabled is false when permission is granted but paused', () => {
    ;(window.Notification as any).permission = 'granted'
    localStorage.setItem('notif-paused', 'true')
    const { result } = renderHook(() => useNotificationSettings())
    expect(result.current.enabled).toBe(false)
  })

  it('enabled is false when permission is default', () => {
    const { result } = renderHook(() => useNotificationSettings())
    expect(result.current.enabled).toBe(false)
  })

  it('setPaused(true) writes notif-paused to localStorage and updates state', () => {
    const { result } = renderHook(() => useNotificationSettings())
    act(() => result.current.setPaused(true))
    expect(localStorage.getItem('notif-paused')).toBe('true')
    expect(result.current.paused).toBe(true)
  })

  it('setPaused(false) removes notif-paused from localStorage and updates state', () => {
    localStorage.setItem('notif-paused', 'true')
    const { result } = renderHook(() => useNotificationSettings())
    act(() => result.current.setPaused(false))
    expect(localStorage.getItem('notif-paused')).toBeNull()
    expect(result.current.paused).toBe(false)
  })

  it('requestPermission calls browser API and updates permission state', async () => {
    mockRequestPermission.mockResolvedValue('granted')
    const { result } = renderHook(() => useNotificationSettings())
    await act(() => result.current.requestPermission())
    expect(result.current.permission).toBe('granted')
    expect(localStorage.getItem('notif-permission')).toBe('granted')
  })

  it('requestPermission returns denied without throwing when Notification is absent', async () => {
    const saved = (window as any).Notification
    delete (window as any).Notification
    const { result } = renderHook(() => useNotificationSettings())
    const perm = await act(() => result.current.requestPermission())
    expect(perm).toBe('denied')
    ;(window as any).Notification = saved
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/useNotificationSettings.test.ts
```

Expected: FAIL — module `../hooks/useNotificationSettings` not found.

- [ ] **Step 3: Create `src/hooks/useNotificationSettings.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/useNotificationSettings.test.ts
```

Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNotificationSettings.ts src/test/useNotificationSettings.test.ts
git commit -m "feat: add useNotificationSettings hook"
```

---

### Task 2: `ToggleSwitch` component

**Files:**
- Create: `src/components/settings/ToggleSwitch.tsx`
- Create: `src/test/ToggleSwitch.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/test/ToggleSwitch.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToggleSwitch } from '../components/settings/ToggleSwitch'

describe('ToggleSwitch', () => {
  it('renders with role="switch"', () => {
    render(<ToggleSwitch checked={false} onChange={() => {}} />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('sets aria-checked="true" when checked=true', () => {
    render(<ToggleSwitch checked={true} onChange={() => {}} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('sets aria-checked="false" when checked=false', () => {
    render(<ToggleSwitch checked={false} onChange={() => {}} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ToggleSwitch checked={false} onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not call onChange when disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ToggleSwitch checked={false} disabled={true} onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<ToggleSwitch checked={false} disabled={true} onChange={() => {}} />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/ToggleSwitch.test.tsx
```

Expected: FAIL — module `../components/settings/ToggleSwitch` not found.

- [ ] **Step 3: Create `src/components/settings/ToggleSwitch.tsx`**

```tsx
interface Props {
  checked: boolean
  disabled?: boolean
  onChange: () => void
}

export function ToggleSwitch({ checked, disabled = false, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/ToggleSwitch.test.tsx
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/ToggleSwitch.tsx src/test/ToggleSwitch.test.tsx
git commit -m "feat: add ToggleSwitch component"
```

---

### Task 3: Add paused guard to `useNotifications`

**Files:**
- Modify: `src/hooks/useNotifications.ts`
- Create: `src/test/useNotificationsGuard.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/test/useNotificationsGuard.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { useNotifications } from '../hooks/useNotifications'
import type { TimeBlock } from '../types'

const mockPostMessage = vi.fn()
const mockReg = {
  active: { postMessage: mockPostMessage },
  pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
}

beforeAll(() => {
  Object.defineProperty(window, 'Notification', {
    value: { permission: 'granted', requestPermission: vi.fn() },
    writable: true,
    configurable: true,
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve(mockReg),
      register: vi.fn().mockResolvedValue(mockReg),
    },
    configurable: true,
  })
})

beforeEach(() => {
  localStorage.clear()
  mockPostMessage.mockClear()
})

const block: TimeBlock = {
  id: 'b1',
  user_id: 'u1',
  task_id: null,
  title: 'Test block',
  start_time: new Date(Date.now() + 60_000).toISOString(),
  end_time: new Date(Date.now() + 3_600_000).toISOString(),
  type: 'soft',
  status: 'planned',
  reminder_minutes: [5],
  color: null,
  created_at: new Date().toISOString(),
}

describe('useNotifications paused guard', () => {
  it('does not post SCHEDULE on mount when notif-paused is "true"', async () => {
    localStorage.setItem('notif-paused', 'true')
    localStorage.setItem('notif-permission', 'granted')
    renderHook(() => useNotifications([block]))
    // Wait for the serviceWorker.ready promise and postMessage to have had a chance to fire
    await new Promise(r => setTimeout(r, 50))
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('posts SCHEDULE on mount when notif-paused is absent', async () => {
    localStorage.setItem('notif-permission', 'granted')
    renderHook(() => useNotifications([block]))
    await new Promise(r => setTimeout(r, 50))
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SCHEDULE', blocks: [block] })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/useNotificationsGuard.test.ts
```

Expected: The first test ("does not post SCHEDULE when paused") FAILS because the guard is not yet present. The second test may pass or fail.

- [ ] **Step 3: Add the paused guard to both scheduling effects in `src/hooks/useNotifications.ts`**

Open `src/hooks/useNotifications.ts`. Make two edits:

**Edit 1** — In the startup `useEffect`, change the permission check on the line that currently reads:

```ts
      if (Notification.permission === 'granted') {
```

to:

```ts
      if (Notification.permission === 'granted' && localStorage.getItem('notif-paused') !== 'true') {
```

**Edit 2** — In the blocks-change `useEffect`, add one line. The full effect after the edit:

```ts
  // Re-schedule whenever blocks change
  useEffect(() => {
    if (!swRegRef.current?.active) return
    if (Notification.permission !== 'granted' || blocks.length === 0) return
    if (localStorage.getItem('notif-paused') === 'true') return
    swRegRef.current.active.postMessage({ type: 'SCHEDULE', blocks })
  }, [blocks])
```

- [ ] **Step 4: Run the new tests to verify they pass**

```bash
npx vitest run src/test/useNotificationsGuard.test.ts
```

Expected: Both tests PASS.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useNotifications.ts src/test/useNotificationsGuard.test.ts
git commit -m "feat: skip notification scheduling when app-level pause flag is set"
```

---

### Task 4: Wire toggle into `SettingsPage`

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Create: `src/test/SettingsPageNotifications.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/test/SettingsPageNotifications.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../pages/SettingsPage'

// Mutable state object — each test sets what it needs in beforeEach or at the top of the test
let mockState = {
  permission: 'default' as NotificationPermission,
  paused: false,
  enabled: false,
  supported: true,
}
const mockSetPaused = vi.fn()
const mockRequestPermission = vi.fn()

vi.mock('../components/layout/Navbar', () => ({
  Navbar: () => <div data-testid="navbar" />,
}))

vi.mock('../hooks/useProfile', () => ({
  useProfile: () => ({
    profile: { email: 'test@example.com', has_real_email: true },
    updateEmail: vi.fn().mockResolvedValue(undefined),
  }),
}))

// vi.mock is hoisted — the factory runs each time the module is imported by a test,
// so referencing the mutable mockState object here picks up per-test values.
vi.mock('../hooks/useNotificationSettings', () => ({
  useNotificationSettings: () => ({
    ...mockState,
    requestPermission: mockRequestPermission,
    setPaused: mockSetPaused,
  }),
}))

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState = { permission: 'default', paused: false, enabled: false, supported: true }
})

describe('SettingsPage notifications toggle', () => {
  it('renders a toggle switch in the Notifications section', () => {
    renderSettings()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('toggle is on (aria-checked=true) when enabled=true', () => {
    mockState = { permission: 'granted', paused: false, enabled: true, supported: true }
    renderSettings()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('toggle is off (aria-checked=false) when enabled=false', () => {
    renderSettings()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('toggle is disabled when permission is denied', () => {
    mockState = { permission: 'denied', paused: false, enabled: false, supported: true }
    renderSettings()
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('shows "Blocked in browser" status text when permission is denied', () => {
    mockState = { permission: 'denied', paused: false, enabled: false, supported: true }
    renderSettings()
    expect(screen.getByText(/blocked in browser/i)).toBeInTheDocument()
  })

  it('shows "Notifications are paused" when granted and paused', () => {
    mockState = { permission: 'granted', paused: true, enabled: false, supported: true }
    renderSettings()
    expect(screen.getByText(/notifications are paused/i)).toBeInTheDocument()
  })

  it('shows "Notifications are on" when granted and not paused', () => {
    mockState = { permission: 'granted', paused: false, enabled: true, supported: true }
    renderSettings()
    expect(screen.getByText(/notifications are on/i)).toBeInTheDocument()
  })

  it('calls requestPermission when toggled from default state', async () => {
    const user = userEvent.setup()
    mockRequestPermission.mockResolvedValue('granted')
    renderSettings()
    await user.click(screen.getByRole('switch'))
    expect(mockRequestPermission).toHaveBeenCalled()
  })

  it('calls setPaused(true) when toggled off from granted+enabled state', async () => {
    const user = userEvent.setup()
    mockState = { permission: 'granted', paused: false, enabled: true, supported: true }
    renderSettings()
    await user.click(screen.getByRole('switch'))
    expect(mockSetPaused).toHaveBeenCalledWith(true)
  })

  it('calls setPaused(false) when toggled on from granted+paused state', async () => {
    const user = userEvent.setup()
    mockState = { permission: 'granted', paused: true, enabled: false, supported: true }
    renderSettings()
    await user.click(screen.getByRole('switch'))
    expect(mockSetPaused).toHaveBeenCalledWith(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/SettingsPageNotifications.test.tsx
```

Expected: FAIL — SettingsPage has no toggle switch yet.

- [ ] **Step 3: Replace `src/pages/SettingsPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useNotificationSettings } from '../hooks/useNotificationSettings'
import { ToggleSwitch } from '../components/settings/ToggleSwitch'
import { Navbar } from '../components/layout/Navbar'

export default function SettingsPage() {
  const { profile, updateEmail } = useProfile()
  const [email, setEmail] = useState(profile?.email ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const { permission, paused, enabled, supported, requestPermission, setPaused } =
    useNotificationSettings()

  async function handleSaveEmail() {
    setError('')
    try {
      await updateEmail(email)
      setSaved(true)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleToggle() {
    if (permission === 'default') {
      const result = await requestPermission()
      if (result === 'granted') setPaused(false)
    } else if (permission === 'granted') {
      setPaused(!paused)
    }
    // 'denied': toggle is disabled, handler never fires
  }

  function notifStatusText(): string {
    if (!supported) return 'Not supported in this browser'
    if (permission === 'denied') return 'Blocked in browser — enable in browser settings'
    if (permission === 'granted' && paused) return 'Notifications are paused'
    if (permission === 'granted') return 'Notifications are on'
    return 'Click to enable notifications'
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="mx-auto mt-8 w-full max-w-md rounded-xl bg-white p-4 shadow dark:bg-slate-800 sm:p-6">
        <h1 className="mb-6 text-lg font-bold text-gray-900 dark:text-white sm:text-xl">Settings</h1>

        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Recovery Email</h2>
          {!profile?.has_real_email && (
            <p className="mb-2 text-xs text-amber-600">No recovery email set. Add one to enable password reset.</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <button
              className="w-full rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 sm:w-auto"
              onClick={handleSaveEmail}
            >
              Save
            </button>
          </div>
          {saved && <p className="mt-1 text-xs text-green-600">Saved! Check your email to confirm.</p>}
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Notifications</h2>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{notifStatusText()}</p>
            <ToggleSwitch
              checked={enabled}
              disabled={permission === 'denied' || !supported}
              onChange={handleToggle}
            />
          </div>
        </div>

        <Link to="/app/today" className="text-sm text-indigo-600 underline dark:text-indigo-400">
          ← Back to app
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/SettingsPageNotifications.test.tsx
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SettingsPage.tsx src/test/SettingsPageNotifications.test.tsx
git commit -m "feat: add notifications toggle to settings page"
```
