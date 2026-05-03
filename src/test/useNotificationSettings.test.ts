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
