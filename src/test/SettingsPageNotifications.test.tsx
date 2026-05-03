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
