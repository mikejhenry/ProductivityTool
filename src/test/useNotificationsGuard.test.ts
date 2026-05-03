import { renderHook } from '@testing-library/react'
import { useNotifications } from '../hooks/useNotifications'
import type { TimeBlock } from '../types'

const mockPostMessage = vi.fn()
const mockReg = {
  active: { postMessage: mockPostMessage },
  pushManager: {
    getSubscription: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockResolvedValue({ toJSON: vi.fn().mockReturnValue({}) }),
  },
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
